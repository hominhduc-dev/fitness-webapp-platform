import "fake-indexeddb/auto"

import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"

import { resetOfflineDatabaseForTests } from "./db"
import {
  createClientLogId,
  getUnsyncedWorkoutSessionDraft,
  listOfflineMutations,
  queueWorkoutLog,
  queueWorkoutSessionDraft,
  queueWorkoutSessionDraftDelete,
  recordOfflineMutationError,
  requeueFailedOfflineMutations,
  settleOfflineMutation,
} from "./workout-log-queue"
import type { StoredWorkoutSession } from "@/lib/workout/session-storage"

function session(completed: boolean): StoredWorkoutSession {
  return {
    currentExerciseIndex: 0,
    exercises: [{ id: "we-1", sets: [{ completed, id: "set-1", weight: 60 }] }],
    startedAt: "2026-09-16T08:00:00.000Z",
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetOfflineDatabaseForTests()
})

describe("offline workout queue", () => {
  it("keeps only the newest draft per workout", async () => {
    await queueWorkoutSessionDraft("user-a", "w1", session(false))
    await queueWorkoutSessionDraft("user-a", "w1", session(true))

    const records = await listOfflineMutations("user-a")
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ payload: session(true), type: "workout-session-draft.upsert" })
    expect(await getUnsyncedWorkoutSessionDraft("user-a", "w1")).toEqual(session(true))
  })

  it("reports a queued delete so a stale server draft is not restored", async () => {
    await queueWorkoutSessionDraft("user-a", "w1", session(true))
    await queueWorkoutSessionDraftDelete("user-a", "w1")

    expect(await getUnsyncedWorkoutSessionDraft("user-a", "w1")).toBe("deleted")
    expect(await getUnsyncedWorkoutSessionDraft("user-a", "w2")).toBeNull()
  })

  it("orders a finished workout before the removal of its draft", async () => {
    await queueWorkoutSessionDraft("user-a", "w1", session(true))
    const clientLogId = createClientLogId()
    await queueWorkoutLog("user-a", "w1", { clientLogId, exercises: [] }, "Push A")

    const records = await listOfflineMutations("user-a")
    expect(records.map((record) => record.type)).toEqual(["workout-log.create", "workout-session-draft.delete"])
    expect(records[0]).toMatchObject({ id: `log:${clientLogId}`, workoutName: "Push A" })
  })

  it("does not settle a draft that was re-queued while its upload was in flight", async () => {
    await queueWorkoutSessionDraft("user-a", "w1", session(false))
    const [inFlight] = await listOfflineMutations("user-a")
    await queueWorkoutSessionDraft("user-a", "w1", session(true))

    await settleOfflineMutation(inFlight)
    await recordOfflineMutationError(inFlight, "late failure", "failed")

    const records = await listOfflineMutations("user-a")
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ attempts: 0, payload: session(true), status: "pending" })
  })

  it("puts failed records back in line", async () => {
    await queueWorkoutLog("user-a", "w1", { clientLogId: createClientLogId(), exercises: [] })
    const [log] = await listOfflineMutations("user-a")
    await recordOfflineMutationError(log, "Rejected", "failed")

    await requeueFailedOfflineMutations("user-a")

    expect((await listOfflineMutations("user-a"))[0]).toMatchObject({ attempts: 1, lastError: "Rejected", status: "pending" })
  })

  it("keeps each user's records apart", async () => {
    await queueWorkoutSessionDraft("user-a", "w1", session(true))
    await queueWorkoutSessionDraft("user-b", "w1", session(false))

    expect(await listOfflineMutations("user-a")).toHaveLength(1)
    expect(await getUnsyncedWorkoutSessionDraft("user-b", "w1")).toEqual(session(false))
  })

  it("mints RFC 4122 v4 ids", () => {
    expect(createClientLogId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
