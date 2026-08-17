import { describe, expect, it } from "vitest"

import { resolveCopyWeekTargets } from "./core"

describe("resolveCopyWeekTargets", () => {
  it("copies the first week onto every later week", () => {
    expect(resolveCopyWeekTargets(4, 0)).toEqual({ sourceWeekIndex: 0, targetWeekIndexes: [1, 2, 3] })
  })

  it("copies a middle week forward only, leaving earlier weeks alone", () => {
    expect(resolveCopyWeekTargets(8, 2)).toEqual({ sourceWeekIndex: 2, targetWeekIndexes: [3, 4, 5, 6, 7] })
  })

  it("has nothing to copy from the final week", () => {
    expect(resolveCopyWeekTargets(4, 3)).toEqual({ sourceWeekIndex: 3, targetWeekIndexes: [] })
  })

  it("has nothing to copy in a one-week program", () => {
    expect(resolveCopyWeekTargets(1, 0)).toEqual({ sourceWeekIndex: 0, targetWeekIndexes: [] })
  })

  it("clamps a source week beyond the program to its last week", () => {
    expect(resolveCopyWeekTargets(4, 99)).toEqual({ sourceWeekIndex: 3, targetWeekIndexes: [] })
  })

  it("clamps a negative source week to the first", () => {
    expect(resolveCopyWeekTargets(3, -5)).toEqual({ sourceWeekIndex: 0, targetWeekIndexes: [1, 2] })
  })
})
