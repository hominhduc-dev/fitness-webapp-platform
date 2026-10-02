import { describe, expect, it } from "vitest"

import { buildOverloadRecommendation, isLowerBodyExercise, type OverloadSetInput } from "./progressive-overload"

function sets(previous: Array<{ reps: number; rir?: number; weight?: number }>, range = { min: 8, max: 10 }, targetRir = 2): OverloadSetInput[] {
  return previous.map((entry, index) => ({
    previous: { reps: entry.reps, rir: entry.rir ?? null, weight: entry.weight ?? 80 },
    setNumber: index + 1,
    targetReps: range.max,
    targetRepsMin: range.min,
    targetRir,
  }))
}

describe("progressive overload", () => {
  it("asks for a baseline when the exercise has no history", () => {
    expect(buildOverloadRecommendation({ sets: [{ setNumber: 1, targetReps: 10 }] }))
      .toEqual({ action: "establish_baseline", reasons: ["no_history"], sets: [] })
  })

  it("adds reps at the same load while inside the range", () => {
    const result = buildOverloadRecommendation({ sets: sets([{ reps: 9 }, { reps: 8 }, { reps: 8 }]) })

    expect(result.action).toBe("add_reps")
    expect(result.sets).toEqual([
      { previousReps: 9, previousWeight: 80, reps: 10, setNumber: 1, weight: 80 },
      { previousReps: 8, previousWeight: 80, reps: 9, setNumber: 2, weight: 80 },
      { previousReps: 8, previousWeight: 80, reps: 9, setNumber: 3, weight: 80 },
    ])
  })

  it("adds load and resets reps once every set reached the top at the target effort", () => {
    const upper = buildOverloadRecommendation({ sets: sets([{ reps: 10, rir: 2 }, { reps: 10, rir: 1 }]) })
    const lower = buildOverloadRecommendation({ lowerBody: true, sets: sets([{ reps: 10, rir: 2, weight: 100 }]) })

    expect(upper).toMatchObject({ action: "add_load", reasons: ["top_of_range_reached"] })
    expect(upper.sets[0]).toMatchObject({ reps: 8, setNumber: 1, weight: 82.5 })
    expect(lower.sets[0]).toMatchObject({ reps: 8, setNumber: 1, weight: 105 })
  })

  it("keeps the load when the top of the range took a grind past the target RIR", () => {
    const result = buildOverloadRecommendation({ sets: sets([{ reps: 10, rir: 0 }, { reps: 10, rir: 2 }]) })

    expect(result).toMatchObject({ action: "maintain", reasons: ["top_of_range_too_hard"] })
  })

  it("holds when a set fell short and takes weight off when most did at a grind", () => {
    expect(buildOverloadRecommendation({ sets: sets([{ reps: 9 }, { reps: 9 }, { reps: 7 }]) }).action).toBe("maintain")

    const reduced = buildOverloadRecommendation({ sets: sets([{ reps: 6, rir: 0 }, { reps: 6, rir: 0 }, { reps: 9 }]) })
    expect(reduced).toMatchObject({ action: "reduce_load", reasons: ["mostly_below_range"] })
    expect(reduced.sets[0]).toMatchObject({ previousWeight: 80, reps: 8, setNumber: 1, weight: 72.5 })
  })

  it("steps down one level on a low-readiness day", () => {
    expect(buildOverloadRecommendation({ readinessScore: 40, sets: sets([{ reps: 10, rir: 2 }]) }))
      .toMatchObject({ action: "add_reps", reasons: ["top_of_range_reached", "readiness_low"] })
    expect(buildOverloadRecommendation({ readinessScore: 40, sets: sets([{ reps: 9 }]) }))
      .toMatchObject({ action: "maintain", reasons: ["inside_range", "readiness_low"] })
  })

  it("ignores warm-up sets", () => {
    const input = [
      { isWarmup: true, previous: { reps: 3, weight: 40 }, setNumber: 1, targetReps: 10, targetRepsMin: 8 },
      ...sets([{ reps: 9 }]).map((set) => ({ ...set, setNumber: 2 })),
    ]

    expect(buildOverloadRecommendation({ sets: input })).toMatchObject({ action: "add_reps", sets: [{ setNumber: 2 }] })
  })

  it("treats leg-dominant exercises as lower body", () => {
    expect(isLowerBodyExercise(["quadriceps", "gluteal"])).toBe(true)
    expect(isLowerBodyExercise(["chest", "triceps"])).toBe(false)
    expect(isLowerBodyExercise([])).toBe(false)
  })

  it("lands every suggested load on the equipment's grid", () => {
    const top = [{ reps: 10, rir: 2, weight: 50 }]

    // A barbell cannot add 1.25 kg in total: the jump is a pair of 1.25s.
    expect(buildOverloadRecommendation({ loadIncrementKg: 2.5, sets: sets(top) }).sets[0].weight).toBe(52.5)
    // Dumbbells move in 2 kg pairs: 22 → 24, never 22.5.
    expect(buildOverloadRecommendation({ loadIncrementKg: 2, sets: sets([{ reps: 10, rir: 2, weight: 22 }]) }).sets[0].weight).toBe(24)
    // A pin-loaded machine moves in 5 kg.
    expect(buildOverloadRecommendation({ loadIncrementKg: 5, lowerBody: true, sets: sets(top) }).sets[0].weight).toBe(55)
    // Taking weight off stays on the grid too.
    const reduced = buildOverloadRecommendation({ loadIncrementKg: 5, sets: sets([{ reps: 5, rir: 0, weight: 50 }, { reps: 5, rir: 0, weight: 50 }]) })
    expect(reduced.sets[0].weight).toBe(45)
  })

  it("progresses a loadless exercise on reps past the top of the range", () => {
    const result = buildOverloadRecommendation({ loadIncrementKg: null, sets: sets([{ reps: 10, rir: 2, weight: 0 }]) })

    expect(result).toMatchObject({ action: "add_reps", reasons: ["top_of_range_reached", "no_load_increment"] })
    expect(result.sets[0].reps).toBe(11)
  })
})
