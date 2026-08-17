import { describe, expect, it } from "vitest"

import { enrichExerciseSnapshot } from "./workout-muscle-snapshot"

describe("workout muscle snapshot", () => {
  it("adds profile fields without removing legacy snapshot data", () => {
    const snapshot = [{
      exercise: { muscleGroup: "Legs", name: "Hip Thrust" },
      sets: [{ actualReps: 10, weight: 100 }],
      variation: { id: "variation-1", muscleGroup: "Legs", name: "Hip Thrust" },
    }]
    const result = enrichExerciseSnapshot(snapshot, new Map([["variation-1", {
      activityType: "strength",
      primaryMuscles: ["gluteal"],
      secondaryMuscles: ["hamstring"],
    }]]))
    expect(result.changed).toBe(true)
    expect(result.snapshot).toEqual([expect.objectContaining({
      exercise: { muscleGroup: "Legs", name: "Hip Thrust" },
      sets: [{ actualReps: 10, weight: 100 }],
      variation: expect.objectContaining({
        activityType: "strength",
        muscleGroup: "Legs",
        primaryMuscles: ["gluteal"],
        secondaryMuscles: ["hamstring"],
      }),
    })])
    expect(enrichExerciseSnapshot(result.snapshot, new Map([["variation-1", {
      activityType: "strength",
      primaryMuscles: ["gluteal"],
      secondaryMuscles: ["hamstring"],
    }]]))).toEqual({ changed: false, snapshot: result.snapshot })
  })

  it("leaves malformed and unmatched legacy snapshots unchanged", () => {
    const snapshot = [{ variation: { id: "unknown", muscleGroup: "Back" } }]
    expect(enrichExerciseSnapshot(snapshot, new Map())).toEqual({ changed: false, snapshot })
  })
})
