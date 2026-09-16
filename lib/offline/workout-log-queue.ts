import type { WorkoutLogInput } from "@/lib/fitness/types"
import { getOfflineDatabase, type OfflineMutation } from "@/lib/offline/db"
import type { StoredWorkoutSession } from "@/lib/workout/session-storage"

let lastSequence = 0

/** `crypto.randomUUID` only exists in secure contexts; a phone testing over LAN http is not one. */
export function createClientLogId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Strictly increasing even when two records are written in the same millisecond. */
function nextSequence() {
  lastSequence = Math.max(Date.now() * 1000, lastSequence + 1)
  return lastSequence
}

function draftMutationId(userId: string, workoutId: string) {
  return `draft:${userId}:${workoutId}`
}

type OfflineMutationChange = "enqueued" | "settled"
const listeners = new Set<(change: OfflineMutationChange) => void>()

export function subscribeToOfflineMutations(listener: (change: OfflineMutationChange) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(change: OfflineMutationChange) {
  for (const listener of listeners) listener(change)
}

function baseRecord(userId: string, workoutId: string) {
  return {
    attempts: 0,
    createdAt: Date.now(),
    lastError: null,
    sequence: nextSequence(),
    status: "pending" as const,
    userId,
    workoutId,
  }
}

/**
 * Saves the in-progress session. Every tick overwrites the same record, so the
 * queue only ever replays the newest state instead of each intermediate one.
 */
export async function queueWorkoutSessionDraft(userId: string, workoutId: string, session: StoredWorkoutSession) {
  const database = await getOfflineDatabase()
  await database.put("mutations", {
    ...baseRecord(userId, workoutId),
    id: draftMutationId(userId, workoutId),
    payload: session,
    type: "workout-session-draft.upsert",
  })
  notify("enqueued")
}

/** Replaces any unsent draft for the workout: there is nothing left to upload. */
export async function queueWorkoutSessionDraftDelete(userId: string, workoutId: string) {
  const database = await getOfflineDatabase()
  await database.put("mutations", {
    ...baseRecord(userId, workoutId),
    id: draftMutationId(userId, workoutId),
    payload: null,
    type: "workout-session-draft.delete",
  })
  notify("enqueued")
}

/**
 * Queues a finished workout, then retires its draft. The log is written first
 * and sequenced first, so the server draft is only removed after the log that
 * replaces it has been accepted.
 */
export async function queueWorkoutLog(
  userId: string,
  workoutId: string,
  input: WorkoutLogInput & { clientLogId: string },
  workoutName?: string,
) {
  const database = await getOfflineDatabase()
  const transaction = database.transaction("mutations", "readwrite")
  await Promise.all([
    transaction.store.put({
      ...baseRecord(userId, workoutId),
      id: `log:${input.clientLogId}`,
      payload: input,
      type: "workout-log.create",
      workoutName,
    }),
    transaction.store.put({
      ...baseRecord(userId, workoutId),
      id: draftMutationId(userId, workoutId),
      payload: null,
      type: "workout-session-draft.delete",
    }),
    transaction.done,
  ])
  notify("enqueued")
}

export async function listOfflineMutations(userId: string): Promise<OfflineMutation[]> {
  const database = await getOfflineDatabase()
  const records = await database.getAllFromIndex("mutations", "by-user", userId)
  return records.sort((a, b) => a.sequence - b.sequence)
}

/**
 * Local session state the server has not seen yet, which therefore outranks the
 * server draft: the newest unsent draft, or "deleted" when the session was
 * finished or discarded offline and the server copy is about to be removed.
 */
export async function getUnsyncedWorkoutSessionDraft(
  userId: string,
  workoutId: string,
): Promise<StoredWorkoutSession | "deleted" | null> {
  const database = await getOfflineDatabase()
  const record = await database.get("mutations", draftMutationId(userId, workoutId))
  if (record?.type === "workout-session-draft.upsert") return record.payload
  if (record?.type === "workout-session-draft.delete") return "deleted"
  return null
}

/**
 * Deletes a record only if nothing re-queued it while its request was in
 * flight; otherwise the newer write stays queued for the next pass.
 */
export async function settleOfflineMutation(record: OfflineMutation) {
  const database = await getOfflineDatabase()
  const transaction = database.transaction("mutations", "readwrite")
  const current = await transaction.store.get(record.id)
  if (current?.sequence === record.sequence) {
    await transaction.store.delete(record.id)
  }
  await transaction.done
  notify("settled")
}

export async function recordOfflineMutationError(
  record: OfflineMutation,
  error: string,
  status: OfflineMutation["status"],
) {
  const database = await getOfflineDatabase()
  const transaction = database.transaction("mutations", "readwrite")
  const current = await transaction.store.get(record.id)
  if (current?.sequence === record.sequence) {
    await transaction.store.put({ ...current, attempts: current.attempts + 1, lastError: error, status })
  }
  await transaction.done
  notify("settled")
}

/** Puts failed records back in line, e.g. when the trainee taps "retry". */
export async function requeueFailedOfflineMutations(userId: string) {
  const database = await getOfflineDatabase()
  const transaction = database.transaction("mutations", "readwrite")
  const records = await transaction.store.index("by-user").getAll(userId)
  await Promise.all(
    records
      .filter((record) => record.status === "failed")
      .map((record) => transaction.store.put({ ...record, status: "pending" })),
  )
  await transaction.done
  notify("enqueued")
}
