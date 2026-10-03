import { describe, expect, it } from "vitest"

import {
  classifyCompliance,
  classifyNextSessionOutcome,
  summarizeExecution,
  summarizeSuggestion,
  type ComplianceInput,
  type OverallCompliance,
  type PerformedSet,
} from "./recommendation-compliance"

/** Bench 80 × 10 last time; the engine says 82.5 × 8 @ 2 RIR for three sets. */
const addLoad = {
  action: "add_load",
  loadIncrementKg: 2.5,
  previousReps: 10,
  previousWeight: 80,
  programmedWorkingSets: 3,
  setDelta: 0,
  suggestedReps: 8,
  suggestedRir: 2,
  suggestedSets: 3,
  suggestedWeight: 82.5,
  swapped: false,
} satisfies Omit<ComplianceInput, "execution">

const sets = (weight: number | null, reps: number[], rir: number | null = 2): PerformedSet[] =>
  reps.map((value) => ({ reps: value, rir, weight }))

function classify(input: Partial<ComplianceInput> & { performed?: PerformedSet[] | null }) {
  const { performed, ...rest } = input
  return classifyCompliance({
    ...addLoad,
    execution: performed === null ? null : summarizeExecution(performed ?? sets(82.5, [8, 8, 8])),
    ...rest,
  })
}

describe("summarizing", () => {
  it("reads the suggestion's top set and the sets it asks for", () => {
    expect(summarizeSuggestion({
      programmedWorkingSets: 3,
      setDelta: 1,
      sets: [
        { previousReps: 10, previousWeight: 80, reps: 8, setNumber: 1, weight: 82.5 },
        { previousReps: 9, previousWeight: 80, reps: 8, setNumber: 2, weight: 82.5 },
      ],
    })).toEqual({ previousReps: 9, previousWeight: 80, suggestedReps: 8, suggestedSets: 4, suggestedWeight: 82.5 })
  })

  it("takes the fewest reps at the heaviest load, and averages the logged RIR", () => {
    expect(summarizeExecution([
      { reps: 12, rir: null, weight: 60 },
      { reps: 8, rir: 2, weight: 82.5 },
      { reps: 7, rir: 1, weight: 82.5 },
    ])).toEqual({ actualReps: 7, actualRir: 1.5, actualSets: 3, actualWeight: 82.5 })
  })
})

describe("add_load", () => {
  it("is followed when the load went up and the reps held", () => {
    expect(classify({})).toEqual({
      loadCompliance: "followed",
      overallCompliance: "followed",
      repCompliance: "followed",
      rirCompliance: "followed",
      setCompliance: "followed",
    })
  })

  it("is modified when the trainee stayed at the old load, though it is within one step", () => {
    expect(classify({ performed: sets(80, [10, 10, 10]) })).toMatchObject({ loadCompliance: "modified", overallCompliance: "modified" })
  })

  it("is partial when the load went up but the reps fell short", () => {
    expect(classify({ performed: sets(82.5, [8, 6, 5]) })).toMatchObject({
      loadCompliance: "followed",
      overallCompliance: "partial",
      repCompliance: "partial",
    })
  })

  it("is partial when weight and reps were right but the effort was not", () => {
    expect(classify({ performed: sets(82.5, [8, 8, 8], 0) })).toMatchObject({
      loadCompliance: "followed",
      overallCompliance: "partial",
      repCompliance: "followed",
      rirCompliance: "modified",
    })
  })

  it("is partial when the load went up by less than suggested", () => {
    expect(classify({ loadIncrementKg: 2.5, performed: sets(82.5, [8, 8, 8]), suggestedWeight: 85 }))
      .toMatchObject({ loadCompliance: "partial", overallCompliance: "partial" })
  })

  it("leaves RIR unjudged when none was logged", () => {
    expect(classify({ performed: sets(82.5, [8, 8, 8], null) })).toMatchObject({ overallCompliance: "followed", rirCompliance: null })
  })
})

describe("other actions", () => {
  const addReps = { action: "add_reps" as const, previousReps: 8, previousWeight: 80, suggestedReps: 9, suggestedWeight: 80 }

  it("add_reps needs the extra rep: the same reps as last time is partial", () => {
    expect(classify({ ...addReps, performed: sets(80, [9, 9, 9]) })).toMatchObject({ overallCompliance: "followed" })
    expect(classify({ ...addReps, performed: sets(80, [8, 8, 8]) })).toMatchObject({ overallCompliance: "partial", repCompliance: "partial" })
    expect(classify({ ...addReps, performed: sets(80, [6, 6, 6]) })).toMatchObject({ overallCompliance: "modified", repCompliance: "modified" })
    expect(classify({ ...addReps, performed: sets(85, [9, 9, 9]) })).toMatchObject({ loadCompliance: "modified", overallCompliance: "modified" })
  })

  it("reduce_load counts any load at or below the suggestion, and a smaller cut as partial", () => {
    const reduce = { action: "reduce_load" as const, previousWeight: 80, suggestedReps: 8, suggestedWeight: 72.5 }
    expect(classify({ ...reduce, performed: sets(70, [8, 8, 8]) })).toMatchObject({ loadCompliance: "followed" })
    expect(classify({ ...reduce, performed: sets(77.5, [8, 8, 8]) })).toMatchObject({ loadCompliance: "partial" })
    expect(classify({ ...reduce, performed: sets(80, [8, 8, 8]) })).toMatchObject({ overallCompliance: "modified" })
  })

  it("judges an added or dropped set by the direction asked for", () => {
    const increase = { setDelta: 1, suggestedSets: 4 }
    expect(classify({ ...increase, performed: sets(82.5, [8, 8, 8, 8]) })).toMatchObject({ setCompliance: "followed" })
    expect(classify({ ...increase, performed: sets(82.5, [8, 8, 8]) })).toMatchObject({ overallCompliance: "modified", setCompliance: "modified" })

    const deload = { action: "reduce_load" as const, setDelta: -1, suggestedSets: 2, suggestedWeight: 72.5 }
    expect(classify({ ...deload, performed: sets(72.5, [8, 8]) })).toMatchObject({ overallCompliance: "followed", setCompliance: "followed" })
    expect(classify({ ...deload, performed: sets(72.5, [8, 8, 8]) })).toMatchObject({ overallCompliance: "modified", setCompliance: "modified" })
  })

  it("treats bodyweight work as on load while nothing was added", () => {
    const bodyweight = { action: "add_reps" as const, suggestedReps: 13, suggestedWeight: null, previousWeight: null }
    expect(classify({ ...bodyweight, performed: sets(null, [13, 13, 13]) })).toMatchObject({ loadCompliance: "followed" })
  })
})

describe("not attempted and swapped", () => {
  it("keeps a skipped exercise apart from one done differently", () => {
    expect(classify({ performed: null })).toMatchObject({ loadCompliance: null, overallCompliance: "not_attempted" })
    expect(classify({ performed: [] })).toMatchObject({ overallCompliance: "not_attempted" })
    expect(classify({ swapped: true })).toMatchObject({ loadCompliance: null, overallCompliance: "modified" })
  })
})

describe("next session outcome", () => {
  const previous: { overallCompliance: OverallCompliance; reps: number; weight: number } = { overallCompliance: "followed", reps: 8, weight: 82.5 }
  const outcome = (next: { reps: number | null; weight: number | null }, overrides: Partial<typeof previous> = {}) =>
    classifyNextSessionOutcome({ loadIncrementKg: 2.5, next, previous: { ...previous, ...overrides } })

  it("reads progress, holding, slipping and going back", () => {
    expect(outcome({ reps: 9, weight: 82.5 })).toBe("successful")
    expect(outcome({ reps: 6, weight: 85 })).toBe("successful")
    expect(outcome({ reps: 8, weight: 82.5 })).toBe("maintained")
    expect(outcome({ reps: 7, weight: 82.5 })).toBe("maintained")
    expect(outcome({ reps: 5, weight: 82.5 })).toBe("regressed")
    expect(outcome({ reps: 10, weight: 80 })).toBe("rolled_back")
  })

  it("has nothing to say about a suggestion that was never tried", () => {
    expect(outcome({ reps: 8, weight: 82.5 }, { overallCompliance: "not_attempted" })).toBe("insufficient_data")
    expect(outcome({ reps: null, weight: null })).toBe("insufficient_data")
  })
})
