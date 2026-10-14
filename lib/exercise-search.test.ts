import { describe, expect, it } from "vitest"

import {
  compileExerciseSearch,
  createExerciseSearchDocument,
  filterExerciseSearch,
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

describe("abbreviations and typo fallback", () => {
  const library = ["Dumbbell Bench Press", "Barbell Bench Press", "Romanian Deadlift", "Incline Bench Press", "Decline Bench Press"].map((name) => ({
    document: createExerciseSearchDocument([name]),
    name,
  }))
  const search = (query: string) => {
    const compiled = compileExerciseSearch(query)
    return filterExerciseSearch(library, compiled, (item, fuzzy) => matchesExerciseSearchDocument(item.document, compiled, { fuzzy }))
  }

  it("reads gym shorthand as the words it stands for", () => {
    expect(search("db bench").items.map((item) => item.name)).toEqual(["Dumbbell Bench Press"])
    expect(search("rdl").items.map((item) => item.name)).toEqual(["Romanian Deadlift"])
  })

  it("falls back to typo-tolerant matching only when nothing matches exactly", () => {
    const result = search("becnh pres")
    expect(result.fuzzy).toBe(true)
    expect(result.items.map((item) => item.name)).toContain("Barbell Bench Press")
  })

  it("matches a word still being typed with a typo", () => {
    expect(search("romaian dead").items.map((item) => item.name)).toEqual(["Romanian Deadlift"])
  })

  it("keeps exact results exact", () => {
    const result = search("incline")
    expect(result.fuzzy).toBe(false)
    expect(result.items.map((item) => item.name)).toEqual(["Incline Bench Press"])
  })

  it("does not guess for short words", () => {
    expect(search("rwo").items).toEqual([])
  })
})
