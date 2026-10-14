import { describe, expect, it } from "vitest"

import { editDistance, findDuplicateExercise, normalizeExerciseName } from "./exercise-name"

describe("normalizeExerciseName", () => {
  it("treats spelling variants of one exercise as the same name", () => {
    const key = normalizeExerciseName("Incline Dumbbell Press")
    expect(normalizeExerciseName("DB incline press")).toBe(key)
    expect(normalizeExerciseName("incline-dumbbell presses")).toBe(key)
    expect(normalizeExerciseName("Dumbbell Incline Press")).toBe(key)
  })

  it("expands one-arm and single-arm the same way", () => {
    const key = normalizeExerciseName("Single Arm Cable Row")
    expect(normalizeExerciseName("1-arm cable row")).toBe(key)
    expect(normalizeExerciseName("SA Cable Row")).toBe(key)
    expect(normalizeExerciseName("one arm cable rows")).toBe(key)
  })

  it("keeps genuinely different exercises apart", () => {
    expect(normalizeExerciseName("Incline Bench Press")).not.toBe(normalizeExerciseName("Decline Bench Press"))
    expect(normalizeExerciseName("Leg Curl")).not.toBe(normalizeExerciseName("Leg Extension"))
  })

  it("strips Vietnamese diacritics", () => {
    expect(normalizeExerciseName("Đẩy ngực")).toBe(normalizeExerciseName("day nguc"))
  })

  it("does not singularise short words or double-s endings", () => {
    expect(normalizeExerciseName("Abs Press")).toBe("abs press")
    expect(normalizeExerciseName("Cross Press")).toBe("cross press")
  })
})

describe("editDistance", () => {
  it("counts a swapped pair of letters as one typo", () => {
    expect(editDistance("becnh", "bench")).toBe(1)
    expect(editDistance("sqaut", "squat")).toBe(1)
  })

  it("counts inserts, deletes and substitutions", () => {
    expect(editDistance("curl", "curls")).toBe(1)
    expect(editDistance("incline", "decline")).toBe(2)
  })

  it("stops early past the limit", () => {
    expect(editDistance("deadlift", "row", 1)).toBe(2)
  })
})

describe("findDuplicateExercise", () => {
  it("finds the library exercise a new name duplicates", () => {
    const library = [{ name: "Romanian Deadlift" }, { name: "Barbell Bench Press" }]
    expect(findDuplicateExercise("BB bench presses", library)?.name).toBe("Barbell Bench Press")
    expect(findDuplicateExercise("RDL", library)?.name).toBe("Romanian Deadlift")
    expect(findDuplicateExercise("Hack squat", library)).toBeUndefined()
  })

  it("tolerates one typo in a longer word", () => {
    const library = [{ name: "Barbell Bench Press" }, { name: "Romanian Deadlift" }]
    expect(findDuplicateExercise("Barbell Becnh Press", library)?.name).toBe("Barbell Bench Press")
    expect(findDuplicateExercise("Romanain Deadlift", library)?.name).toBe("Romanian Deadlift")
  })

  it("does not stretch typo tolerance into a different exercise", () => {
    const library = [{ name: "Decline Bench Press" }, { name: "Back Squat" }, { name: "Barbell Bench Press" }]
    expect(findDuplicateExercise("Incline Bench Press", library)).toBeUndefined()
    expect(findDuplicateExercise("Hack Squat", library)).toBeUndefined()
    expect(findDuplicateExercise("Barbel Becnh Press", library)).toBeUndefined()
  })

  it("keeps opposite movements apart even one letter away", () => {
    expect(findDuplicateExercise("Lever Seated Hip Adduction", [{ name: "Lever Seated Hip Abduction" }])).toBeUndefined()
  })

  it("prefers an exact match over a typo match", () => {
    const library = [{ name: "Cable Crosover" }, { name: "Cable Crossover" }]
    expect(findDuplicateExercise("cable crossovers", library)?.name).toBe("Cable Crossover")
  })
})
