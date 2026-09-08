import { describe, expect, it } from "vitest"

import { normalizeAIWorkoutOutput } from "./workout-output"

const normalize = (value: unknown) => normalizeAIWorkoutOutput(value as Parameters<typeof normalizeAIWorkoutOutput>[0])
const output = (exercise: unknown) => ({ workouts: [{ exercises: [exercise] }] })

describe("normalizeAIWorkoutOutput", () => {
  it("recovers missing reps from the supplied minimum without mutating stored JSON", () => {
    const stored = output({ sets: 3, repsMin: 30, variationId: "v1" })
    expect(normalize(stored).workouts[0].exercises[0]).toEqual({ sets: 3, reps: 30, repsMin: 30, variationId: "v1" })
    expect(stored.workouts[0].exercises[0]).not.toHaveProperty("reps")
  })

  it("preserves valid ranges and normalizes integer strings", () => {
    expect(normalize(output({ sets: "3", reps: "12", repsMin: "8" })).workouts[0].exercises[0])
      .toEqual({ sets: 3, reps: 12, repsMin: 8 })
  })

  it.each([
    { sets: 3 }, { sets: 3, reps: 0 }, { sets: 3, reps: -2 },
    { sets: 3, reps: "30 giây" }, { sets: 3, reps: "8-12" },
    { sets: 3, reps: 1.5 }, { sets: 3, reps: Infinity },
    { sets: 3, reps: 2_147_483_648 }, { sets: 3, reps: 8, repsMin: 12 },
    { sets: 3, reps: false }, { sets: 3, reps: "", repsMin: 30 },
    { sets: 3, repsMin: -1 }, { sets: 51, reps: 10 }, { reps: 10 },
  ])("rejects invalid set/rep values: %j", (exercise) => {
    expect(() => normalize(output(exercise))).toThrow(expect.objectContaining({ status: 422 }))
  })

  it.each([null, {}, { workouts: [] }, { workouts: [null] }, output(null), { workouts: [{ exercises: [] }] }])("rejects malformed collections: %j", (value) => {
      expect(() => normalize(value)).toThrow(expect.objectContaining({ status: 422 }))
    })
})
