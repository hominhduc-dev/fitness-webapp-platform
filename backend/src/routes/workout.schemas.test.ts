import { describe, expect, it } from "vitest"

import { createWorkoutLogSchema, logRangeQuery, personalWorkoutSchema, swapExerciseSchema } from "./workout.schemas"

describe("personalWorkoutSchema", () => {
  it("defaults an omitted exercise list to empty", () => {
    expect(personalWorkoutSchema.parse({ name: "Push A" }).exercises).toEqual([])
  })

  it("keeps a valid exercise entry intact", () => {
    const parsed = personalWorkoutSchema.parse({
      exercises: [{ reps: 8, sets: 4, variationId: "var-1", weight: 60 }],
      name: "Push A",
    })

    expect(parsed.exercises[0]).toMatchObject({ reps: 8, sets: 4, variationId: "var-1", weight: 60 })
  })

  it("rejects a non-numeric rep count instead of silently writing 0", () => {
    // The previous hand-rolled parser coerced anything non-numeric to 0, so a typo
    // in the client produced a workout of "0 reps" rather than an error.
    const result = personalWorkoutSchema.safeParse({
      exercises: [{ reps: "eight", sets: 4, variationId: "var-1" }],
      name: "Push A",
    })

    expect(result.success).toBe(false)
  })

  it("rejects physically impossible values", () => {
    const base = { name: "Push A", variationId: "var-1" }

    expect(
      personalWorkoutSchema.safeParse({ ...base, exercises: [{ reps: -1, sets: 4, variationId: "var-1" }] }).success,
    ).toBe(false)
    expect(
      personalWorkoutSchema.safeParse({ ...base, exercises: [{ reps: 8, sets: 4, variationId: "var-1", weight: 5000 }] })
        .success,
    ).toBe(false)
  })

  it("keeps scheduledDay inside a week", () => {
    expect(personalWorkoutSchema.safeParse({ name: "A", scheduledDay: 6 }).success).toBe(true)
    expect(personalWorkoutSchema.safeParse({ name: "A", scheduledDay: 7 }).success).toBe(false)
    expect(personalWorkoutSchema.safeParse({ name: "A", scheduledDay: -1 }).success).toBe(false)
  })

  it("caps the exercise list", () => {
    const exercise = { reps: 8, sets: 3, variationId: "var-1" }

    expect(personalWorkoutSchema.safeParse({ exercises: Array(100).fill(exercise), name: "A" }).success).toBe(true)
    expect(personalWorkoutSchema.safeParse({ exercises: Array(101).fill(exercise), name: "A" }).success).toBe(false)
  })

  it("allows kind and notes to be explicitly null", () => {
    expect(personalWorkoutSchema.safeParse({ kind: null, name: "A", notes: null }).success).toBe(true)
  })
})

describe("logRangeQuery", () => {
  it("requires both ends of the range", () => {
    expect(logRangeQuery.safeParse({ from: "2026-08-01", to: "2026-08-31" }).success).toBe(true)
    expect(logRangeQuery.safeParse({ from: "2026-08-01" }).success).toBe(false)
  })

  it("rejects a non-ISO date", () => {
    expect(logRangeQuery.safeParse({ from: "01/08/2026", to: "2026-08-31" }).success).toBe(false)
  })

  it("requires programId to be a uuid when present", () => {
    expect(logRangeQuery.safeParse({ from: "2026-08-01", programId: "abc", to: "2026-08-31" }).success).toBe(false)
    expect(
      logRangeQuery.safeParse({
        from: "2026-08-01",
        programId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        to: "2026-08-31",
      }).success,
    ).toBe(true)
  })
})

describe("createWorkoutLogSchema", () => {
  it("defaults exercises to an empty array", () => {
    expect(createWorkoutLogSchema.parse({}).exercises).toEqual([])
  })

  it("rejects a timestamp that is not parseable", () => {
    expect(createWorkoutLogSchema.safeParse({ completedAt: "yesterday" }).success).toBe(false)
    expect(createWorkoutLogSchema.safeParse({ completedAt: "2026-08-14T10:00:00.000Z" }).success).toBe(true)
  })

  it("bounds the exercise payload", () => {
    expect(createWorkoutLogSchema.safeParse({ exercises: Array(101).fill({}) }).success).toBe(false)
  })
})

describe("swapExerciseSchema", () => {
  it("requires a non-empty variationId", () => {
    expect(swapExerciseSchema.safeParse({ variationId: "" }).success).toBe(false)
    expect(swapExerciseSchema.safeParse({}).success).toBe(false)
    expect(swapExerciseSchema.safeParse({ variationId: "var-1" }).success).toBe(true)
  })
})
