import { describe, expect, it } from "vitest"

import { buildOverloadRecommendation, isLowerBodyExercise, type OverloadSetInput } from "./progressive-overload"

/** `targetRir: null` is a set the coach left without one, which is what lets the goal's default apply. */
function sets(
  previous: Array<{ reps: number; rir?: number; weight?: number }>,
  range = { min: 8, max: 10 },
  targetRir: number | null = 2,
): OverloadSetInput[] {
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

  it("lets the goal decide what counts as a grind, where the coach said nothing", () => {
    // Top of the range, but every set taken to failure. A cut asks for RIR 3,
    // so that was harder than planned and the load holds; a bulk asks for RIR 1
    // and reads the same sets as the effort it wanted, so weight goes on.
    const toFailure = sets([{ reps: 10, rir: 0 }, { reps: 10, rir: 0 }, { reps: 10, rir: 0 }], { min: 8, max: 10 }, null)

    expect(buildOverloadRecommendation({ defaultTargetRir: 3, loadIncrementKg: 2.5, sets: toFailure }))
      .toMatchObject({ action: "maintain", reasons: ["top_of_range_too_hard"] })
    expect(buildOverloadRecommendation({ defaultTargetRir: 1, loadIncrementKg: 2.5, sets: toFailure }))
      .toMatchObject({ action: "add_load", reasons: ["top_of_range_reached"] })
  })

  it("lets the coach's own RIR on a set outrank the goal's", () => {
    const coached = sets([{ reps: 10, rir: 0 }, { reps: 10, rir: 0 }, { reps: 10, rir: 0 }], { min: 8, max: 10 }, 1)

    expect(buildOverloadRecommendation({ defaultTargetRir: 3, loadIncrementKg: 2.5, sets: coached }).action)
      .toBe("add_load")
  })

  it("falls back to the hypertrophy-typical effort when nothing names one", () => {
    // Pinned against RIR 2 rather than an action, so the fallback cannot drift
    // to another value while still happening to produce the same decision.
    const toFailure = sets([{ reps: 10, rir: 0 }, { reps: 10, rir: 0 }, { reps: 10, rir: 0 }], { min: 8, max: 10 }, null)

    expect(buildOverloadRecommendation({ loadIncrementKg: 2.5, sets: toFailure }))
      .toEqual(buildOverloadRecommendation({ defaultTargetRir: 2, loadIncrementKg: 2.5, sets: toFailure }))
  })

  it("does not progress off a weight carried over from other training", () => {
    // A trainee who benched 80kg elsewhere starts a new program: the weight is
    // worth showing, but nothing here was earned under this prescription, so it
    // must read as no baseline rather than as three sets at the top of the range.
    const carriedOver = sets([{ reps: 10 }, { reps: 10 }, { reps: 10 }])
      .map((set) => ({ ...set, previous: { ...set.previous, carriedOver: true } }))

    expect(buildOverloadRecommendation({ sets: carriedOver }))
      .toEqual({ action: "establish_baseline", reasons: ["no_history"], sets: [] })
  })

  it("progresses on this program's own sets even when another is carried over", () => {
    const mixed = sets([{ reps: 10 }, { reps: 10 }])
    mixed[1] = { ...mixed[1], previous: { ...mixed[1].previous, carriedOver: true } }

    const result = buildOverloadRecommendation({ loadIncrementKg: 2.5, sets: mixed })

    expect(result.action).toBe("add_load")
    expect(result.sets.map((set) => set.setNumber)).toEqual([1])
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

describe("a changed prescription", () => {
  const history = (reps: number, prescription?: { repMax: number; repMin: number; targetRir: number | null }) =>
    [1, 2, 3].map((setNumber) => ({
      previous: { prescription, reps, rir: 2, weight: 80 },
      setNumber,
      targetReps: 20,
      targetRepsMin: 15,
    }))

  it("sets a new baseline instead of reading the old block's reps against the new range", () => {
    expect(buildOverloadRecommendation({ sets: history(10, { repMax: 10, repMin: 8, targetRir: 2 }) }))
      .toEqual({ action: "establish_baseline", reasons: ["prescription_changed"], sets: [] })
  })

  it("still progresses a set whose range only moved a little, and older history with no prescription", () => {
    const close = [1, 2, 3].map((setNumber) => ({
      previous: { prescription: { repMax: 10, repMin: 8, targetRir: 2 }, reps: 10, rir: 2, weight: 80 },
      setNumber,
      targetReps: 12,
      targetRepsMin: 10,
    }))
    expect(buildOverloadRecommendation({ sets: close }).action).toBe("add_reps")
    expect(buildOverloadRecommendation({ sets: history(20) }).action).toBe("add_load")
  })
})
