import { describe, expect, it } from "vitest"

import sharedCases from "./exercise-display.cases.json"
import { buildExerciseDisplayName } from "./exercise-display"

type LabelCase = {
  expected: string
  exerciseName: string
  isDefault?: boolean
  name: string
  variationName: string
}

// Mirrored by backend/src/domain/exercise-display.test.ts — see the case file.
const labelCases = sharedCases.cases as LabelCase[]

describe("buildExerciseDisplayName", () => {
  it.each(labelCases)("$name", ({ exerciseName, expected, isDefault, variationName }) => {
    expect(buildExerciseDisplayName({ exerciseName, isDefault, variationName })).toBe(expected)
  })

  it("prefers an explicit display name over anything composed", () => {
    expect(buildExerciseDisplayName({
      displayName: "Chest Supported Row",
      exerciseName: "Chest Supported Upperback Row",
      variationName: "Upperback Machine",
    })).toBe("Chest Supported Row")
  })
})
