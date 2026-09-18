import "fake-indexeddb/auto"

import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Workout } from "@/lib/types"
import { resetOfflineDatabaseForTests } from "./db"
import {
  clearOfflineWorkoutSnapshots,
  deleteOfflineWorkoutSnapshot,
  getOfflineWorkoutSnapshot,
  saveOfflineWorkoutSnapshot,
} from "./workout-snapshot"

function workout(id: string): Workout {
  return {
    id,
    name: `Workout ${id}`,
    exercises: [],
    scheduledDate: new Date("2026-09-18T00:00:00.000Z"),
  } as Workout
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetOfflineDatabaseForTests()
  vi.restoreAllMocks()
})

describe("offline workout snapshots", () => {
  it("restores a complete structured-clone workout for the same user", async () => {
    const snapshot = workout("w1")
    await saveOfflineWorkoutSnapshot("user-a", snapshot)

    const restored = await getOfflineWorkoutSnapshot("user-a", "w1")
    expect(restored).toEqual(snapshot)
    expect(restored?.scheduledDate).toBeInstanceOf(Date)
    expect(await getOfflineWorkoutSnapshot("user-b", "w1")).toBeNull()
  })

  it("deletes a finished snapshot", async () => {
    await saveOfflineWorkoutSnapshot("user-a", workout("w1"))
    await deleteOfflineWorkoutSnapshot("user-a", "w1")
    expect(await getOfflineWorkoutSnapshot("user-a", "w1")).toBeNull()
  })

  it("clears private snapshots when the account changes", async () => {
    await saveOfflineWorkoutSnapshot("user-a", workout("w1"))
    await saveOfflineWorkoutSnapshot("user-b", workout("w2"))
    await clearOfflineWorkoutSnapshots()

    expect(await getOfflineWorkoutSnapshot("user-a", "w1")).toBeNull()
    expect(await getOfflineWorkoutSnapshot("user-b", "w2")).toBeNull()
  })

  it("keeps only the eight most recently prepared workouts per user", async () => {
    let now = 1_000
    vi.spyOn(Date, "now").mockImplementation(() => now++)
    for (let index = 0; index < 10; index += 1) {
      await saveOfflineWorkoutSnapshot("user-a", workout(`w${index}`))
    }

    expect(await getOfflineWorkoutSnapshot("user-a", "w0")).toBeNull()
    expect(await getOfflineWorkoutSnapshot("user-a", "w1")).toBeNull()
    expect(await getOfflineWorkoutSnapshot("user-a", "w9")).toMatchObject({ id: "w9" })
  })
})
