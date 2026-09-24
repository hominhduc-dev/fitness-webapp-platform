import { describe, expect, it } from "vitest"

import { isExerciseDone, nextIncompleteExercise, sessionDisplayOrder } from "./exercise-order"

const done = { sets: [{ completed: true }, { completed: true }] }
const partial = { sets: [{ completed: true }, { completed: false }] }
const fresh = { sets: [{ completed: false }] }
const empty = { sets: [] }

describe("exercise order in a session", () => {
  it("counts an exercise done only when every set is ticked", () => {
    expect(isExerciseDone(done)).toBe(true)
    expect(isExerciseDone(partial)).toBe(false)
    expect(isExerciseDone(empty)).toBe(false)
  })

  it("moves finished exercises to the bottom and keeps planned order within each group", () => {
    expect(sessionDisplayOrder([done, fresh, partial, done, empty])).toEqual([1, 2, 4, 0, 3])
    expect(sessionDisplayOrder([fresh, partial])).toEqual([0, 1])
  })

  it("moves on to the next unfinished exercise, wrapping to one skipped earlier", () => {
    expect(nextIncompleteExercise([done, done, fresh, fresh], 1)).toBe(2)
    // The next planned exercise was already done out of order.
    expect(nextIncompleteExercise([done, done, done, fresh], 0)).toBe(3)
    expect(nextIncompleteExercise([fresh, done, done], 2)).toBe(0)
    expect(nextIncompleteExercise([done, done], 0)).toBeNull()
  })
})
