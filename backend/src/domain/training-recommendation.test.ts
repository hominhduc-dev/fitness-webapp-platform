import { describe, expect, it } from "vitest"

import type { OverloadRecommendation } from "./progressive-overload"
import { buildTrainingRecommendation, type TrainingRecommendationInput } from "./training-recommendation"

const addLoad: OverloadRecommendation = {
  action: "add_load",
  reasons: ["top_of_range_reached"],
  sets: [{ reps: 8, setNumber: 1, weight: 82.5 }],
}
const reduce: OverloadRecommendation = {
  action: "reduce_load",
  reasons: ["mostly_below_range"],
  sets: [{ reps: 8, setNumber: 1, weight: 72.5 }],
}

function input(dayAction: TrainingRecommendationInput["guidance"]["action"]): TrainingRecommendationInput {
  return {
    guidance: { action: dayAction, focusMuscles: [], reasons: [], setAdjustmentPct: 0 },
    muscles: [
      { muscleSlug: "chest", recommendation: { action: "maintain", currentSets: 12, recommendedSets: 12 } },
      { muscleSlug: "upper-back", recommendation: { action: "increase", currentSets: 9, recommendedSets: 10 } },
      { muscleSlug: "biceps", recommendation: { action: "decrease", currentSets: 18, recommendedSets: 15.3, status: "dismissed" } },
    ],
    phase: "accumulation",
    targetRir: 2,
    workout: {
      exercises: [
        { name: "Bench Press", progression: addLoad },
        { name: "Row", progression: reduce },
        { name: "Curl", progression: null },
      ],
      isCompleted: false,
      name: "Upper A",
    },
  }
}

describe("training recommendation", () => {
  it("passes each exercise's progression through on a normal day", () => {
    const result = buildTrainingRecommendation(input("proceed"))

    expect(result.workout?.exercises).toEqual([
      { action: "add_load", heldByDay: false, name: "Bench Press", reasons: ["top_of_range_reached"], sets: addLoad.sets },
      { action: "reduce_load", heldByDay: false, name: "Row", reasons: ["mostly_below_range"], sets: reduce.sets },
    ])
    expect(result.intensity).toEqual({ phase: "accumulation", targetRir: 2 })
  })

  it("holds progression back on a light day but keeps a load reduction", () => {
    const [bench, row] = buildTrainingRecommendation(input("light_session")).workout!.exercises

    expect(bench).toEqual({
      action: "maintain",
      heldByDay: true,
      name: "Bench Press",
      reasons: ["top_of_range_reached", "day_guidance"],
      sets: [],
    })
    expect(row).toMatchObject({ action: "reduce_load", heldByDay: false })
  })

  it("lists only the muscles to change, leaving out dismissed answers", () => {
    expect(buildTrainingRecommendation(input("proceed")).muscles).toEqual([
      { action: "increase", currentSets: 9, muscleSlug: "upper-back", recommendedSets: 10 },
    ])
  })

  it("has no workout part on a day without a session", () => {
    expect(buildTrainingRecommendation({ ...input("proceed"), workout: null }).workout).toBeNull()
  })
})
