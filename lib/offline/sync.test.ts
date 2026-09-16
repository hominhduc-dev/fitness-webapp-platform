import "fake-indexeddb/auto"

import { QueryClient } from "@tanstack/react-query"
import { IDBFactory } from "fake-indexeddb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/auth/api"
import { queryKeys } from "@/lib/queries/keys"
import { resetOfflineDatabaseForTests } from "./db"
import { getOfflineSyncStatus, retryFailedOfflineMutations, startOfflineSync } from "./sync"
import {
  createClientLogId,
  listOfflineMutations,
  queueWorkoutLog,
  queueWorkoutSessionDraft,
} from "./workout-log-queue"

const mocks = vi.hoisted(() => ({
  client: null as import("@tanstack/react-query").QueryClient | null,
  createWorkoutLog: vi.fn(),
  deleteWorkoutSessionDraft: vi.fn(),
  token: "token-1" as string | null,
  upsertWorkoutSessionDraft: vi.fn(),
}))

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: null }) }))
vi.mock("@/lib/queries/token", () => ({ getAccessToken: async () => mocks.token }))
vi.mock("@/lib/queries/client", () => ({ getQueryClient: () => mocks.client }))
vi.mock("@/lib/fitness/api", () => ({
  createWorkoutLog: mocks.createWorkoutLog,
  deleteWorkoutSessionDraft: mocks.deleteWorkoutSessionDraft,
  upsertWorkoutSessionDraft: mocks.upsertWorkoutSessionDraft,
}))

const draft = { currentExerciseIndex: 0, exercises: [], startedAt: "2026-09-16T08:00:00.000Z" }
let stop: (() => void) | null = null

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetOfflineDatabaseForTests()
  mocks.client = new QueryClient()
  mocks.token = "token-1"
  // reset, not clear: a persistent rejection from one test must not leak into the next.
  vi.resetAllMocks()
})

afterEach(() => {
  stop?.()
  stop = null
})

async function waitForQueue(userId: string, length: number) {
  await vi.waitFor(async () => {
    expect(await listOfflineMutations(userId)).toHaveLength(length)
    expect(getOfflineSyncStatus().isSyncing).toBe(false)
  })
}

describe("offline sync", () => {
  it("sends a queued workout, then removes its draft, in order", async () => {
    const calls: string[] = []
    mocks.createWorkoutLog.mockImplementation(async () => { calls.push("log") })
    mocks.deleteWorkoutSessionDraft.mockImplementation(async () => { calls.push("delete-draft") })
    const invalidate = vi.spyOn(mocks.client!, "invalidateQueries")
    const clientLogId = createClientLogId()
    await queueWorkoutLog("user-a", "w1", { clientLogId, exercises: [] })

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 0)

    expect(calls).toEqual(["log", "delete-draft"])
    expect(mocks.createWorkoutLog).toHaveBeenCalledWith("token-1", "w1", expect.objectContaining({ clientLogId }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.workouts.all })
    expect(getOfflineSyncStatus()).toMatchObject({ failed: 0, pending: 0 })
    expect(getOfflineSyncStatus().lastSyncedAt).not.toBeNull()
  })

  it("keeps everything queued when the request never reaches the server", async () => {
    mocks.createWorkoutLog.mockRejectedValue(new ApiError("Unable to reach the API server.", 503, { isNetworkError: true }))
    await queueWorkoutLog("user-a", "w1", { clientLogId: createClientLogId(), exercises: [] })

    stop = startOfflineSync("user-a")
    await vi.waitFor(() => expect(mocks.createWorkoutLog).toHaveBeenCalledTimes(1))
    await waitForQueue("user-a", 2)

    const records = await listOfflineMutations("user-a")
    expect(records.every((record) => record.status === "pending" && record.attempts === 0)).toBe(true)
    expect(mocks.deleteWorkoutSessionDraft).not.toHaveBeenCalled()
    expect(getOfflineSyncStatus()).toMatchObject({ failed: 0, hasBacklog: true, pending: 2 })
  })

  it("keeps routine draft uploads quiet while online", async () => {
    mocks.upsertWorkoutSessionDraft.mockResolvedValue(null)
    await queueWorkoutSessionDraft("user-a", "w1", draft)

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 0)

    expect(mocks.upsertWorkoutSessionDraft).toHaveBeenCalledTimes(1)
    expect(getOfflineSyncStatus()).toMatchObject({ hasBacklog: false, lastSyncedAt: null })
  })

  it("surfaces a rejected workout as failed, keeps it, and retries on request", async () => {
    mocks.createWorkoutLog.mockRejectedValueOnce(new ApiError("Workout not found.", 404))
    await queueWorkoutLog("user-a", "w1", { clientLogId: createClientLogId(), exercises: [] })

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 1)

    expect((await listOfflineMutations("user-a"))[0]).toMatchObject({
      lastError: "Workout not found.",
      status: "failed",
      type: "workout-log.create",
    })
    expect(getOfflineSyncStatus()).toMatchObject({ failed: 1, pending: 0 })

    await retryFailedOfflineMutations("user-a")
    await waitForQueue("user-a", 0)
    expect(mocks.createWorkoutLog).toHaveBeenCalledTimes(2)
  })

  it("drops a draft the server refuses instead of blocking the queue", async () => {
    mocks.upsertWorkoutSessionDraft.mockRejectedValue(new ApiError("Workout not found.", 404))
    await queueWorkoutSessionDraft("user-a", "w1", draft)

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 0)

    expect(getOfflineSyncStatus()).toMatchObject({ failed: 0, pending: 0 })
  })

  it("stores the uploaded draft under the owner's query key", async () => {
    mocks.upsertWorkoutSessionDraft.mockResolvedValue({ ...draft, updatedAt: "now", workoutId: "w1" })
    await queueWorkoutSessionDraft("user-a", "w1", draft)

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 0)

    expect(mocks.client!.getQueryData([...queryKeys.workouts.sessionDraft("w1"), { userId: "user-a" }]))
      .toMatchObject({ workoutId: "w1" })
  })

  it("never sends another user's queue", async () => {
    await queueWorkoutSessionDraft("user-b", "w1", draft)

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 0)

    expect(mocks.upsertWorkoutSessionDraft).not.toHaveBeenCalled()
    expect(await listOfflineMutations("user-b")).toHaveLength(1)
  })

  it("waits for a token rather than failing records", async () => {
    mocks.token = null
    await queueWorkoutSessionDraft("user-a", "w1", draft)

    stop = startOfflineSync("user-a")
    await waitForQueue("user-a", 1)

    expect(mocks.upsertWorkoutSessionDraft).not.toHaveBeenCalled()
    expect((await listOfflineMutations("user-a"))[0]).toMatchObject({ attempts: 0, status: "pending" })
  })
})
