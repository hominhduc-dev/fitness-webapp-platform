import { describe, expect, it } from "vitest"

import { exerciseQueue, isExerciseDone, nextIncompleteExercise } from "./exercise-order"

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

  it("moves on to the next unfinished exercise, wrapping to one skipped earlier", () => {
    expect(nextIncompleteExercise([done, done, fresh, fresh], 1)).toBe(2)
    // The next planned exercise was already done out of order.
    expect(nextIncompleteExercise([done, done, done, fresh], 0)).toBe(3)
    expect(nextIncompleteExercise([fresh, done, done], 2)).toBe(0)
    expect(nextIncompleteExercise([done, done], 0)).toBeNull()
  })
})

describe("the queue in the stack layout", () => {
  const d = { sets: [{ completed: true }] }
  const t = { sets: [{ completed: false }] }

  it("lists what is left after the current exercise, then what was skipped", () => {
    // 0 skipped, 1 done, 2 current, 3 and 4 still to do.
    expect(exerciseQueue([t, d, t, t, t], 2)).toEqual({ upNext: [3, 4, 0], done: [1] })
  })

  it("keeps the current exercise out of both lists, done or not", () => {
    expect(exerciseQueue([d, d, t], 1)).toEqual({ upNext: [2], done: [0] })
    expect(exerciseQueue([t], 0)).toEqual({ upNext: [], done: [] })
  })

  it("is empty with no exercises", () => {
    expect(exerciseQueue([], 0)).toEqual({ upNext: [], done: [] })
  })
})
