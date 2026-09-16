import { beforeEach, describe, expect, it } from "vitest"
import type { Workout } from "@/lib/types"
import { restoreWorkoutSessionExercises } from "./restore-session"
import {
  getWorkoutSessionStorageKey,
  readStoredWorkoutSession,
  scanActiveSessions,
  type StoredWorkoutSession,
} from "./session-storage"

const base = [{
  id: "bench",
  sets: [1, 2, 3].map((n) => ({
    id: `set-${n}`, setNumber: n, targetReps: 10, completed: false,
  })),
}] as Workout["exercises"]

function draft(): StoredWorkoutSession {
  return {
    currentExerciseIndex: 0,
    schemaVersion: 6,
    startedAt: "2026-09-16T09:18:00Z",
    deletedSetIds: ["set-3"],
    exercises: [{
      id: "bench",
      sets: base[0].sets.slice(0, 2).map((set) => ({
        ...set, weight: 60, actualReps: 10, rir: 2, completed: true,
      })),
    }],
  }
}

describe("resume deleted sets", () => {
  beforeEach(() => window.localStorage.clear())

  it("keeps deleted sets absent across repeated storage and resume cycles", () => {
    let session = draft()
    for (let attempt = 0; attempt < 3; attempt++) {
      window.localStorage.setItem(getWorkoutSessionStorageKey("workout"), JSON.stringify(session))
      session = readStoredWorkoutSession("workout")!
      const restored = restoreWorkoutSessionExercises(base, session.exercises, true, session.deletedSetIds)
      expect(restored[0].sets.map((s) => s.id)).toEqual(["set-1", "set-2"])
      expect(restored[0].sets.map((s) => s.setNumber)).toEqual([1, 2])
      expect(restored[0].sets[0]).toMatchObject({ weight: 60, actualReps: 10, rir: 2, completed: true })
      session = { ...session, exercises: restored }
    }
    expect(base[0].sets).toHaveLength(3)
  })

  it("retains newly added sets and renumbers after a middle deletion", () => {
    const session = draft()
    session.exercises[0].sets.push({
      id: "added", completed: false, addedDuringSession: true, clientAddedToken: "token",
    })
    const result = restoreWorkoutSessionExercises(base, session.exercises, true, ["set-2"])
    expect(result[0].sets.map((s) => s.id)).toEqual(["set-1", "set-3", "added"])
    expect(result[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3])
  })

  it("does not infer deletions from missing legacy entries", () => {
    expect(restoreWorkoutSessionExercises(base, draft().exercises, false)[0].sets).toHaveLength(3)
  })

  it("keeps a deletion-only draft visible in Resume", () => {
    const session = draft()
    session.exercises[0].sets = [{ id: "set-1", completed: false }, { id: "set-2", completed: false }]
    window.localStorage.setItem(getWorkoutSessionStorageKey("workout"), JSON.stringify(session))
    expect(scanActiveSessions()).toEqual([expect.objectContaining({ totalSets: 2, completedSets: 0 })])
  })

  it("sanitizes malformed deletion IDs", () => {
    window.localStorage.setItem(getWorkoutSessionStorageKey("workout"), JSON.stringify({
      ...draft(), deletedSetIds: ["set-3", null, 123, "set-3"],
    }))
    expect(readStoredWorkoutSession("workout")?.deletedSetIds).toEqual(["set-3"])
  })
})
