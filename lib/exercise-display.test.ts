import { describe, expect, it } from "vitest"

import { buildExerciseDisplayName } from "./exercise-display"

describe("buildExerciseDisplayName", () => {
  it("prefixes equipment-style variations before the exercise name", () => {
    expect(buildExerciseDisplayName({
      exerciseName: "Bench Press",
      variationName: "Barbell",
    })).toBe("Barbell Bench Press")

    expect(buildExerciseDisplayName({
      exerciseName: "Bicep Curl",
      variationName: "Dumbbell",
    })).toBe("Dumbbell Bicep Curl")

    expect(buildExerciseDisplayName({
      exerciseName: "Squat",
      variationName: "Smith Machine",
    })).toBe("Smith Machine Squat")
  })

  it("moves parenthesized equipment before modifiers and the base exercise", () => {
    expect(buildExerciseDisplayName({
      exerciseName: "Bench Press",
      variationName: "Close Grip (Barbell)",
    })).toBe("Barbell Close Grip Bench Press")
  })

  it("normalizes dash modifiers from the exercise name", () => {
    expect(buildExerciseDisplayName({
      exerciseName: "Bench Press - Close Grip",
      variationName: "Barbell",
    })).toBe("Barbell Close Grip Bench Press")

    expect(buildExerciseDisplayName({
      exerciseName: "Bench Press - Close Grip (Barbell)",
      variationName: "Default",
    })).toBe("Barbell Close Grip Bench Press")
  })
})
