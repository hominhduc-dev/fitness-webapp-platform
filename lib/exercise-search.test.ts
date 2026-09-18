import { describe, expect, it } from "vitest"

import {
  compileExerciseSearch,
  createExerciseSearchDocument,
  matchesExerciseSearch,
  matchesExerciseSearchDocument,
  sortByExerciseRelevance,
} from "./exercise-search"

describe("exercise search", () => {
  it("matches all tokens across name, muscle and equipment", () => {
    expect(matchesExerciseSearch(["Incline Bench Press", "Chest", "Dumbbell"], "bench dumbbell")).toBe(true)
    expect(matchesExerciseSearch(["Incline Bench Press", "Chest", "Dumbbell"], "bench cable")).toBe(false)
  })

  it("ignores punctuation, whitespace and hyphens", () => {
    const document = createExerciseSearchDocument(["Close-Grip Push-Up"])

    expect(matchesExerciseSearchDocument(document, compileExerciseSearch("close grip"))).toBe(true)
    expect(matchesExerciseSearchDocument(document, compileExerciseSearch("pushup"))).toBe(true)
  })

  it("is accent-insensitive for Vietnamese input", () => {
    expect(matchesExerciseSearch(["Duỗi đùi với máy", "Đùi trước"], "dui truoc")).toBe(true)
  })

  it("keeps exact and prefix name matches ahead of loose matches", () => {
    const exercises = ["Incline Bench Press", "Bench", "Dumbbell Bench Press"]

    expect(sortByExerciseRelevance(exercises, "bench", (name) => name)).toEqual([
      "Bench",
      "Incline Bench Press",
      "Dumbbell Bench Press",
    ])
  })
})
