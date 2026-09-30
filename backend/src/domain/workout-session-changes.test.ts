import { describe, expect, it } from "vitest"

import { collectSessionChanges } from "./workout-session-changes"

const prescribed = new Map([
  ["slot-bench", { notes: "Pause at the chest", variation: { id: "bench" } }],
  ["slot-row", { variation: { id: "row" } }],
])

describe("collectSessionChanges", () => {
  it("reports a slot logged with another variation as a swap", () => {
    const { swaps } = collectSessionChanges([
      { id: "slot-bench", variation: { id: "dumbbell-press" } },
      { id: "slot-row", variation: { id: "row" } },
    ], prescribed)

    expect(swaps).toEqual([{ newVariationId: "dumbbell-press", workoutExerciseId: "slot-bench" }])
  })

  it("ignores exercises added during the session when looking for swaps", () => {
    const { swaps } = collectSessionChanges([{ id: "added-1", variation: { id: "curl" } }], prescribed)

    expect(swaps).toEqual([])
  })

  it("keeps only notes the trainee wrote, not the coach's", () => {
    const { notes } = collectSessionChanges([
      { exercise: { name: "Bench Press" }, id: "slot-bench", notes: " Pause at the chest ", variation: { id: "bench" } },
      { exercise: { name: "Row" }, id: "slot-row", notes: "Lower back tight", variation: { displayName: "Cable Row", id: "row" } },
      { exercise: { name: "Curl" }, id: "added-1", notes: "  ", variation: { id: "curl" } },
    ], prescribed)

    expect(notes).toEqual([{ exerciseName: "Cable Row", note: "Lower back tight" }])
  })

  it("reports a rewritten coach note", () => {
    const { notes } = collectSessionChanges([
      { exercise: { name: "Bench Press" }, id: "slot-bench", notes: "Shoulder hurt on set 3", variation: { id: "bench" } },
    ], prescribed)

    expect(notes).toEqual([{ exerciseName: "Bench Press", note: "Shoulder hurt on set 3" }])
  })
})
