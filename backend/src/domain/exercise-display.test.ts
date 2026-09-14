import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { buildExerciseDisplayName } from "./exercise-display"

type LabelCase = {
  expected: string
  exerciseName: string
  isDefault?: boolean
  name: string
  variationName: string
}

// The case table lives outside backend/src because the frontend mirror
// (lib/exercise-display.ts) is pinned to the same expectations, and the two
// tsconfigs cannot import each other. Read it off disk rather than import it.
const CASES_PATH = resolve(__dirname, "../../../lib/exercise-display.cases.json")
const labelCases = (JSON.parse(readFileSync(CASES_PATH, "utf8")) as { cases: LabelCase[] }).cases

describe("buildExerciseDisplayName", () => {
  it("reads the shared case table", () => {
    expect(labelCases.length).toBeGreaterThan(0)
  })

  it.each(labelCases)("$name", ({ exerciseName, expected, isDefault, variationName }) => {
    expect(buildExerciseDisplayName({ exerciseName, isDefault, variationName })).toBe(expected)
  })
})
