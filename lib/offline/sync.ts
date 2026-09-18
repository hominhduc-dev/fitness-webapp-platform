import { ApiError } from "@/lib/auth/api"
import { createWorkoutLog, deleteWorkoutSessionDraft, upsertWorkoutSessionDraft } from "@/lib/fitness/api"
import { isOfflineStorageAvailable, type OfflineMutation } from "@/lib/offline/db"
import {
  listOfflineMutations,
  recordOfflineMutationError,
  requeueFailedOfflineMutations,
  settleOfflineMutation,
  subscribeToOfflineMutations,
} from "@/lib/offline/workout-log-queue"
import { deleteOfflineWorkoutSnapshot } from "@/lib/offline/workout-snapshot"
import { getQueryClient } from "@/lib/queries/client"
import { queryKeys } from "@/lib/queries/keys"
import { userQueryKey } from "@/lib/queries/scoped"
import { getAccessToken } from "@/lib/queries/token"

export type OfflineSyncStatus = {
  failed: number
  /**
   * Work has been waiting on the network (queued offline or a pass stalled).
   * Routine draft uploads while online are not a backlog, so the badge stays
   * quiet instead of flashing on every set tick.
   */
  hasBacklog: boolean
  isOnline: boolean
  /** A visible sync is in flight: a backlog or a finished workout is being sent. */
  isSyncing: boolean
  /** Set when a pass drained the queue after sending something; cleared on new work. */
  lastSyncedAt: number | null
  pending: number
}

const SERVER_STATUS: OfflineSyncStatus = {
  failed: 0,
  hasBacklog: false,
  isOnline: true,
  isSyncing: false,
  lastSyncedAt: null,
  pending: 0,
}

/** Coalesces a burst of set ticks into one upload, like the old draft debounce. */
const ENQUEUE_SYNC_DELAY_MS = 1_200
const RETRY_BASE_DELAY_MS = 2_000
const RETRY_MAX_DELAY_MS = 60_000
const SYNC_LOCK_NAME = "yeahbuddy-offline-sync"

let status: OfflineSyncStatus = SERVER_STATUS
const statusListeners = new Set<() => void>()

let activeUserId: string | null = null
let activeFlush: Promise<void> | null = null
let flushRequestedDuringRun = false
let consecutiveFailures = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let enqueueTimer: ReturnType<typeof setTimeout> | null = null

function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false
}

function setStatus(patch: Partial<OfflineSyncStatus>) {
  status = { ...status, ...patch }
  for (const listener of statusListeners) listener()
}

export function subscribeToOfflineSyncStatus(listener: () => void) {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

export function getOfflineSyncStatus() {
  return status
}

export function getServerOfflineSyncStatus() {
  return SERVER_STATUS
}

async function refreshCounts(userId: string) {
  const records = await listOfflineMutations(userId)
  if (userId !== activeUserId) return
  setStatus({
    failed: records.filter((record) => record.status === "failed").length,
    pending: records.filter((record) => record.status === "pending").length,
  })
}

type SendOutcome = "sent" | "rejected" | "stop"

function invalidateAfterSync(record: OfflineMutation) {
  const queryClient = getQueryClient()
  if (record.type === "workout-log.create") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    return
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.sessionDrafts() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.collection() })
}

async function send(record: OfflineMutation, accessToken: string): Promise<SendOutcome> {
  const queryClient = getQueryClient()
  const draftKey = userQueryKey(queryKeys.workouts.sessionDraft(record.workoutId), record.userId)

  try {
    switch (record.type) {
      case "workout-log.create":
        await createWorkoutLog(accessToken, record.workoutId, record.payload)
        break
      case "workout-session-draft.upsert":
        queryClient.setQueryData(draftKey, await upsertWorkoutSessionDraft(accessToken, record.workoutId, record.payload))
        break
      case "workout-session-draft.delete":
        await deleteWorkoutSessionDraft(accessToken, record.workoutId)
        queryClient.setQueryData(draftKey, null)
        break
    }
  } catch (error) {
    return handleSendError(record, error)
  }

  await settleOfflineMutation(record)
  if (record.type === "workout-log.create") {
    await deleteOfflineWorkoutSnapshot(record.userId, record.workoutId).catch(() => undefined)
  }
  invalidateAfterSync(record)
  return "sent"
}

async function handleSendError(record: OfflineMutation, error: unknown): Promise<SendOutcome> {
  const message = error instanceof Error ? error.message : String(error)

  // Never reached the server, or the session needs refreshing: keep the record
  // exactly as it is and try again later, in order.
  if (error instanceof ApiError && (error.isNetworkError || error.status === 401)) {
    return "stop"
  }

  const isTransient =
    !(error instanceof ApiError) || error.status === 408 || error.status === 429 || error.status >= 500
  if (isTransient) {
    await recordOfflineMutationError(record, message, "pending")
    return "stop"
  }

  // The server refused it outright (validation, missing workout). A draft has
  // nothing worth keeping; a finished workout does, so it stays visible as failed.
  if (record.type === "workout-log.create") {
    await recordOfflineMutationError(record, message, "failed")
  } else {
    await settleOfflineMutation(record)
  }
  return "rejected"
}

function scheduleRetry(userId: string) {
  if (retryTimer) return
  const delay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** consecutiveFailures)
  consecutiveFailures += 1
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushOfflineQueue(userId)
  }, delay)
}

async function drain(userId: string) {
  let sentAny = false
  let sentLog = false
  let stopped = false

  try {
    for (;;) {
      if (!isBrowserOnline() || userId !== activeUserId) {
        stopped = true
        break
      }

      const next = (await listOfflineMutations(userId)).find((record) => record.status === "pending")
      if (!next) break
      if (status.hasBacklog || next.type === "workout-log.create") setStatus({ isSyncing: true })

      // Tokens are resolved per record: a long queue can outlive an access token.
      const accessToken = await getAccessToken()
      if (!accessToken) {
        stopped = true
        break
      }

      const outcome = await send(next, accessToken)
      if (outcome === "stop") {
        stopped = true
        break
      }
      sentAny = true
      sentLog ||= next.type === "workout-log.create"
    }
  } finally {
    setStatus({ isSyncing: false })
  }

  await refreshCounts(userId)
  // Sync stopped (sign-out, account switch) while this pass was in flight.
  if (userId !== activeUserId) return

  if (stopped && status.pending > 0) {
    setStatus({ hasBacklog: true })
    if (isBrowserOnline()) scheduleRetry(userId)
    return
  }

  consecutiveFailures = 0
  if (sentAny && status.pending === 0 && status.failed === 0 && (status.hasBacklog || sentLog)) {
    setStatus({ hasBacklog: false, lastSyncedAt: Date.now() })
  }
}

/** One pass per tab, and — where Web Locks exist — one pass across tabs. */
async function runExclusive(task: () => Promise<void>) {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (lock) await task()
    })
    return
  }
  await task()
}

export function flushOfflineQueue(userId: string): Promise<void> {
  if (!isOfflineStorageAvailable() || userId !== activeUserId) return Promise.resolve()

  if (activeFlush) {
    // Work queued mid-pass may already have been listed past; run once more.
    flushRequestedDuringRun = true
    return activeFlush
  }

  activeFlush = runExclusive(() => drain(userId))
    .catch(() => undefined)
    .finally(() => {
      activeFlush = null
      if (flushRequestedDuringRun) {
        flushRequestedDuringRun = false
        void flushOfflineQueue(userId)
      }
    })

  return activeFlush
}

export async function retryFailedOfflineMutations(userId: string) {
  await requeueFailedOfflineMutations(userId)
  consecutiveFailures = 0
  await flushOfflineQueue(userId)
}

/**
 * Starts syncing the signed-in user's queue: now, whenever the browser comes
 * back online or the app returns to the foreground, and shortly after anything
 * new is queued. Returns the teardown.
 */
export function startOfflineSync(userId: string) {
  if (!isOfflineStorageAvailable()) return () => undefined

  activeUserId = userId
  consecutiveFailures = 0
  setStatus({ ...SERVER_STATUS, isOnline: isBrowserOnline() })

  const flush = () => {
    void flushOfflineQueue(userId)
  }
  const handleOnline = () => {
    setStatus({ isOnline: true })
    consecutiveFailures = 0
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    flush()
  }
  const handleOffline = () => setStatus({ isOnline: false })
  const handleVisibility = () => {
    if (document.visibilityState === "visible") flush()
  }

  const unsubscribeQueue = subscribeToOfflineMutations((change) => {
    void refreshCounts(userId).catch(() => undefined)
    if (change !== "enqueued") return
    setStatus({ lastSyncedAt: null, ...(isBrowserOnline() ? {} : { hasBacklog: true }) })
    if (enqueueTimer) clearTimeout(enqueueTimer)
    enqueueTimer = setTimeout(() => {
      enqueueTimer = null
      flush()
    }, ENQUEUE_SYNC_DELAY_MS)
  })

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  document.addEventListener("visibilitychange", handleVisibility)
  flush()

  return () => {
    unsubscribeQueue()
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    document.removeEventListener("visibilitychange", handleVisibility)
    for (const timer of [retryTimer, enqueueTimer]) {
      if (timer) clearTimeout(timer)
    }
    retryTimer = null
    enqueueTimer = null
    if (activeUserId === userId) {
      activeUserId = null
      setStatus(SERVER_STATUS)
    }
  }
}
