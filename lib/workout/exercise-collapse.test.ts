import { describe, expect, it } from "vitest"
import { nextExerciseCollapsed } from "./exercise-collapse"

describe("exercise collapse transitions", () => {
  it("collapses on completion and reopens on undo after auto-advance", () => {
    expect(nextExerciseCollapsed(false, true, false)).toBe(true)
    expect(nextExerciseCollapsed(true, false, false)).toBe(false)
  })

  it("preserves manual expansion of an incomplete non-current exercise", () => {
    expect(nextExerciseCollapsed(false, false, false)).toBeUndefined()
  })

  it("opens the next active exercise", () => {
    expect(nextExerciseCollapsed(false, false, true)).toBe(false)
  })
})
