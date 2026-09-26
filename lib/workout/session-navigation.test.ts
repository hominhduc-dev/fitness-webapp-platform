import { describe, expect, it } from "vitest"

import { activeSetIndex, primaryNavAction } from "./session-navigation"

const done = { sets: [{ completed: true }] }
const fresh = { sets: [{ completed: false }] }
const partial = { sets: [{ completed: true }, { completed: true }, { completed: false }, { completed: false }] }
const empty = { sets: [] }

describe("the set the trainee is on", () => {
  it("is the first set not yet ticked", () => {
    expect(activeSetIndex(partial)).toBe(2)
    expect(activeSetIndex(fresh)).toBe(0)
  })

  it("is none once every set is done, or when there are no sets", () => {
    expect(activeSetIndex(done)).toBeNull()
    expect(activeSetIndex(empty)).toBeNull()
    expect(activeSetIndex(undefined)).toBeNull()
  })
})

describe("the session bar's main action", () => {
  it("logs the next set while the exercise on screen has one left", () => {
    expect(primaryNavAction([done, partial, fresh], 1)).toEqual({ kind: "completeSet", setIndex: 2 })
    // Even on the last exercise, and even when everything else is done.
    expect(primaryNavAction([done, fresh], 1)).toEqual({ kind: "completeSet", setIndex: 0 })
  })

  it("steps to the next planned exercise once this one is done", () => {
    expect(primaryNavAction([done, done, fresh], 1)).toEqual({ kind: "next", index: 2 })
    // Next in plan even when it is already done: the bar walks the plan in order.
    expect(primaryNavAction([done, done, fresh], 0)).toEqual({ kind: "next", index: 1 })
  })

  it("goes back to an unfinished exercise from the last one", () => {
    expect(primaryNavAction([fresh, done, done], 2)).toEqual({ kind: "unfinished", index: 0 })
  })

  it("locks finishing when an empty exercise on screen is the only one left", () => {
    expect(primaryNavAction([done, done, empty], 2)).toEqual({ kind: "finishLocked" })
  })

  it("finishes once every exercise is logged, wherever the trainee is", () => {
    expect(primaryNavAction([done, done], 0)).toEqual({ kind: "finish" })
    expect(primaryNavAction([done, done], 1)).toEqual({ kind: "finish" })
  })

  it("offers to finish an empty session", () => {
    expect(primaryNavAction([], 0)).toEqual({ kind: "finish" })
  })
})
