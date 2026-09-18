/**
 * Does an offline session survive iOS evicting the PWA from memory?
 *
 * Every other offline test runs inside one process. The kill is what these add:
 * resetting the module registry drops every in-memory cache, timer and listener
 * while `globalThis.indexedDB` keeps the bytes, which is what a swipe-away
 * leaves behind.
 */
import "fake-indexeddb/auto"

import { QueryClient } from "@tanstack/react-query"
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  client: null as import("@tanstack/react-query").QueryClient | null,
  createWorkoutLog: vi.fn(),
  deleteWorkoutSessionDraft: vi.fn(),
  token: "token-1" as string | null,
  upsertWorkoutSessionDraft: vi.fn(),
}))

vi.mock("@/lib/queries/token", () => ({ getAccessToken: async () => mocks.token }))
vi.mock("@/lib/queries/client", () => ({ getQueryClient: () => mocks.client }))
vi.mock("@/lib/fitness/api", () => ({
  createWorkoutLog: mocks.createWorkoutLog,
  deleteWorkoutSessionDraft: mocks.deleteWorkoutSessionDraft,
  upsertWorkoutSessionDraft: mocks.upsertWorkoutSessionDraft,
}))

const USER = "trainee-1"
const WORKOUT = "w-1"

function setOnline(online: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, value: online })
}

/** A fresh module graph over the same IndexedDB — the app after a cold relaunch. */
async function relaunch() {
  vi.resetModules()
  return {
    queue: await import("@/lib/offline/workout-log-queue"),
    snapshot: await import("@/lib/offline/workout-snapshot"),
    sync: await import("@/lib/offline/sync"),
  }
}

const session = (sets: number) => ({
  currentExerciseIndex: 0,
  exercises: [{ id: "we-1", sets: Array.from({ length: sets }, (_, i) => ({ completed: true, id: `s${i}`, weight: 60 })) }],
  startedAt: "2026-09-18T08:00:00.000Z",
})

const workout = { exercises: [], id: WORKOUT, name: "Push A" } as never

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  mocks.client = new QueryClient()
  mocks.token = "token-1"
  vi.resetAllMocks()
  setOnline(true)
})

describe("offline session across an iOS cold restart", () => {
  it("still has the logger seed and the unsent draft after the app is killed", async () => {
    setOnline(false)
    const before = await relaunch()
    await before.snapshot.saveOfflineWorkoutSnapshot(USER, workout)
    await before.queue.queueWorkoutSessionDraft(USER, WORKOUT, session(3))

    const after = await relaunch()
    expect(await after.snapshot.getOfflineWorkoutSnapshot(USER, WORKOUT)).toMatchObject({ id: WORKOUT, name: "Push A" })
    expect(await after.queue.getUnsyncedWorkoutSessionDraft(USER, WORKOUT)).toMatchObject(session(3))
  })

  it("keeps a workout finished offline queued, and sends it on the next launch with signal", async () => {
    setOnline(false)
    const before = await relaunch()
    const clientLogId = before.queue.createClientLogId()
    await before.queue.queueWorkoutLog(USER, WORKOUT, { clientLogId, exercises: [] } as never, "Push A")

    // Nothing may be sent while there is no network.
    const stopOffline = before.sync.startOfflineSync(USER)
    await vi.waitFor(() => expect(before.sync.getOfflineSyncStatus().isSyncing).toBe(false))
    expect(mocks.createWorkoutLog).not.toHaveBeenCalled()
    expect(await before.queue.listOfflineMutations(USER)).toHaveLength(2)
    stopOffline()

    // Swipe away, still offline. Relaunch with signal back.
    const after = await relaunch()
    setOnline(true)
    mocks.createWorkoutLog.mockResolvedValue({ id: "log-1" })
    mocks.deleteWorkoutSessionDraft.mockResolvedValue(undefined)

    const stop = after.sync.startOfflineSync(USER)
    await vi.waitFor(async () => {
      expect(await after.queue.listOfflineMutations(USER)).toHaveLength(0)
    })
    expect(mocks.createWorkoutLog).toHaveBeenCalledWith("token-1", WORKOUT, expect.objectContaining({ clientLogId }))
    stop()
  })

  it("does not lose the queue when the access token cannot be refreshed offline", async () => {
    setOnline(false)
    const before = await relaunch()
    await before.queue.queueWorkoutLog(USER, WORKOUT, { clientLogId: "c1", exercises: [] } as never, "Push A")

    // Supabase returns `session: null` once the access token outlives its real
    // expiry with no network to refresh it.
    const after = await relaunch()
    setOnline(true)
    mocks.token = null

    const stop = after.sync.startOfflineSync(USER)
    await vi.waitFor(() => expect(after.sync.getOfflineSyncStatus().isSyncing).toBe(false))
    expect(mocks.createWorkoutLog).not.toHaveBeenCalled()
    expect(await after.queue.listOfflineMutations(USER)).toHaveLength(2)
    stop()
  })

  it("replays a finished workout exactly once when two launches race the same record", async () => {
    setOnline(true)
    const first = await relaunch()
    const clientLogId = first.queue.createClientLogId()
    await first.queue.queueWorkoutLog(USER, WORKOUT, { clientLogId, exercises: [] } as never, "Push A")

    mocks.createWorkoutLog.mockResolvedValue({ id: "log-1" })
    mocks.deleteWorkoutSessionDraft.mockResolvedValue(undefined)

    const stop = first.sync.startOfflineSync(USER)
    await vi.waitFor(async () => expect(await first.queue.listOfflineMutations(USER)).toHaveLength(0))
    stop()

    // A second launch must find nothing left to send.
    const second = await relaunch()
    const stopSecond = second.sync.startOfflineSync(USER)
    await vi.waitFor(() => expect(second.sync.getOfflineSyncStatus().isSyncing).toBe(false))
    expect(mocks.createWorkoutLog).toHaveBeenCalledTimes(1)
    stopSecond()
  })
})
