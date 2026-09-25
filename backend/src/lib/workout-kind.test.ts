import { describe, expect, it } from "vitest"

import { inferWorkoutKind } from "./workout-kind"

describe("inferWorkoutKind", () => {
  it("picks the split with the most exercises", () => {
    // Day 5: back work plus rear-delt shoulder moves and arms.
    expect(inferWorkoutKind(["Back", "Back", "Back", "Shoulders", "Shoulders", "Arms", "Arms"])).toBe("pull")
    expect(inferWorkoutKind(["Chest", "Chest", "Shoulders", "Arms"])).toBe("push")
    expect(inferWorkoutKind(["Legs", "Legs", "Calves", "Core"])).toBe("legs")
  })

  it("stays neutral on a tie or when no exercise says anything about the split", () => {
    expect(inferWorkoutKind(["Chest", "Back"])).toBeNull()
    expect(inferWorkoutKind(["Arms", "Core", "Cardio", null, undefined])).toBeNull()
    expect(inferWorkoutKind([])).toBeNull()
  })
})
