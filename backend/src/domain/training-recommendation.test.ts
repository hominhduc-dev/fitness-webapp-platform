import { describe, expect, it } from "vitest"

import type { OverloadRecommendation } from "./progressive-overload"
import {
  buildTrainingRecommendation,
  reconcileExerciseProgression,
  reconcileWorkoutProgressions,
  type MuscleAction,
} from "./training-recommendation"

const benchAddLoad: OverloadRecommendation = {
  action: "add_load",
  reasons: ["top_of_range_reached"],
  sets: [
    { previousReps: 10, previousWeight: 80, reps: 8, setNumber: 1, weight: 82.5 },
    { previousReps: 10, previousWeight: 80, reps: 8, setNumber: 2, weight: 82.5 },
    { previousReps: 10, previousWeight: 80, reps: 8, setNumber: 3, weight: 82.5 },
  ],
}

function reconcile(muscle: MuscleAction | null, dayAction: "light_session" | "proceed" | "rest" = "proceed") {
  return reconcileExerciseProgression({
    dayAction,
    loadIncrementKg: 2.5,
    muscleActions: new Map(muscle ? [["chest", muscle]] : []),
    ownsMuscleIncrease: true,
    primaryMuscles: ["chest"],
    progression: benchAddLoad,
    workingSets: 3,
  })
}

describe("reconciling day, muscle and exercise", () => {
  it("keeps the exercise's own progression when nothing above it objects", () => {
    expect(reconcile(null)).toMatchObject({ action: "add_load", engineAction: "add_load", heldBy: null, setDelta: 0, sets: benchAddLoad.sets })
  })

  it("holds the load and drops a set when the muscle's volume should come down", () => {
    const result = reconcile("decrease")

    expect(result).toMatchObject({
      action: "maintain",
      engineAction: "add_load",
      heldBy: "muscle",
      muscleAction: "decrease",
      muscleSlug: "chest",
      reasons: ["top_of_range_reached", "muscle_decrease"],
      setDelta: -1,
    })
    // Last session's numbers, not the pushed 82.5 × 8.
    expect(result.sets[0]).toMatchObject({ reps: 10, weight: 80 })
  })

  it("never leaves add_load standing on a muscle that needs a deload", () => {
    const result = reconcile("deload")

    expect(result).toMatchObject({ action: "reduce_load", heldBy: "muscle", muscleAction: "deload", setDelta: -1 })
    expect(result.sets.every((set) => set.weight === 72.5 && set.reps === 10)).toBe(true)
  })

  it("lets the day win over an increase, and holds the push", () => {
    expect(reconcile("increase", "light_session")).toMatchObject({ action: "maintain", heldBy: "day", setDelta: 0 })
    expect(reconcile("increase", "proceed")).toMatchObject({ action: "add_load", reasons: ["top_of_range_reached", "muscle_increase"], setDelta: 1 })
  })

  it("still deloads a muscle on a held day", () => {
    expect(reconcile("deload", "rest")).toMatchObject({ action: "reduce_load", heldBy: "day", reasons: ["top_of_range_reached", "day_guidance", "muscle_deload"] })
  })

  it("takes the strongest signal among an exercise's primary muscles", () => {
    const result = reconcileExerciseProgression({
      dayAction: "proceed",
      loadIncrementKg: 2.5,
      muscleActions: new Map<string, MuscleAction>([["chest", "increase"], ["triceps", "decrease"]]),
      ownsMuscleIncrease: true,
      primaryMuscles: ["chest", "triceps"],
      progression: benchAddLoad,
      workingSets: 3,
    })

    expect(result).toMatchObject({ action: "maintain", muscleSlug: "triceps", setDelta: -1 })
  })

  it("gives an increased muscle's extra set to its first exercise only, and ignores dismissed answers", () => {
    const [first, second, third] = reconcileWorkoutProgressions({
      dayAction: "proceed",
      exercises: [
        { loadIncrementKg: 2.5, name: "Bench", primaryMuscles: ["chest"], progression: benchAddLoad, workingSets: 3 },
        { loadIncrementKg: 2, name: "DB Press", primaryMuscles: ["chest"], progression: benchAddLoad, workingSets: 3 },
        { loadIncrementKg: 2.5, name: "Row", primaryMuscles: ["upper-back"], progression: benchAddLoad, workingSets: 3 },
      ],
      muscles: [
        { muscleSlug: "chest", recommendation: { action: "increase", currentSets: 9, recommendedSets: 10 } },
        { muscleSlug: "upper-back", recommendation: { action: "deload", currentSets: 24, recommendedSets: 14, status: "dismissed" } },
      ],
    })

    expect(first?.setDelta).toBe(1)
    expect(second?.setDelta).toBe(0)
    expect(third).toMatchObject({ action: "add_load", setDelta: 0 })
  })

  it("never drops an exercise below one set", () => {
    const result = reconcileExerciseProgression({
      dayAction: "proceed",
      loadIncrementKg: 2.5,
      muscleActions: new Map<string, MuscleAction>([["chest", "deload"]]),
      ownsMuscleIncrease: false,
      primaryMuscles: ["chest"],
      progression: benchAddLoad,
      workingSets: 1,
    })

    expect(result.setDelta).toBe(0)
  })
})

describe("training recommendation", () => {
  it("lists only the muscles to change and passes reconciled exercises through", () => {
    const reconciled = reconcile("decrease")
    const result = buildTrainingRecommendation({
      guidance: { action: "proceed", focusMuscles: [], reasons: [], setAdjustmentPct: 0 },
      muscles: [
        { muscleSlug: "chest", recommendation: { action: "decrease", currentSets: 18, recommendedSets: 15.5 } },
        { muscleSlug: "biceps", recommendation: { action: "maintain", currentSets: 10, recommendedSets: 10 } },
        { muscleSlug: "triceps", recommendation: { action: "decrease", currentSets: 18, recommendedSets: 15, status: "dismissed" } },
      ],
      phase: "accumulation",
      targetRir: 2,
      workout: { exercises: [{ name: "Bench", progression: reconciled }, { name: "Curl", progression: null }], isCompleted: false, name: "Upper A" },
    })

    expect(result.muscles).toEqual([{ action: "decrease", currentSets: 18, muscleSlug: "chest", recommendedSets: 15.5 }])
    expect(result.workout?.exercises).toEqual([{ ...reconciled, name: "Bench" }])
  })
})
