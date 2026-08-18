import { describe, expect, it } from "vitest"

import { resolveEffectiveWeekIndex, resolveProgramWeekForWeekStart } from "@/lib/fitness/program-week"

/**
 * Assignment lands Thursday of the week starting Monday 2026-08-10 (UTC).
 * The weekly calendar hands us local-midnight Dates whose calendar fields are
 * that UTC Monday, so the fixtures are built the same way.
 */
const ASSIGNED_AT = new Date("2026-08-13T09:00:00.000Z")

/** Local-midnight Date for the Monday `weeksElapsed` weeks after assignment. */
function weekStart(weeksElapsed: number) {
  return new Date(2026, 7, 10 + weeksElapsed * 7)
}

describe("resolveProgramWeekForWeekStart", () => {
  it("places the assignment week at index 0", () => {
    expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 4, weekStart(0))).toEqual({ kind: "active", weekIndex: 0 })
  })

  it("places the last week of the program at duration - 1", () => {
    expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 4, weekStart(3))).toEqual({ kind: "active", weekIndex: 3 })
  })

  it("reports the week after the program ends as after", () => {
    expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 4, weekStart(4))).toEqual({ kind: "after" })
    expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 4, weekStart(9))).toEqual({ kind: "after" })
  })

  it("reports weeks before the assignment as before", () => {
    expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 4, weekStart(-1))).toEqual({ kind: "before" })
  })

  it("returns null for an unusable assignedAt", () => {
    expect(resolveProgramWeekForWeekStart(null, 4, weekStart(0))).toBeNull()
    expect(resolveProgramWeekForWeekStart("not a date", 4, weekStart(0))).toBeNull()
  })

  it("reads the week start by calendar day, not by instant", () => {
    // The calendar passes a local-midnight Date whose calendar fields are the
    // UTC Monday. In a positive-offset zone that instant is the previous day in
    // UTC, so an implementation reaching for getUTCDate() — or diffing raw
    // milliseconds against a UTC-midnight anchor — drops a week. Pinning the
    // answer to the calendar fields is what prevents that, and any Date sharing
    // those fields must resolve identically no matter its time of day.
    const expected = { kind: "active", weekIndex: 2 }

    for (const hour of [0, 7, 12, 23]) {
      const sameCalendarDay = new Date(2026, 7, 24, hour, 30)
      expect(resolveProgramWeekForWeekStart(ASSIGNED_AT, 8, sameCalendarDay)).toEqual(expected)
    }
  })

  it("survives a daylight-saving shift inside the program span", () => {
    // Weeks are derived from calendar fields, so a 23- or 25-hour week must not
    // round to the wrong index.
    const assigned = new Date("2026-10-22T09:00:00.000Z")
    expect(resolveProgramWeekForWeekStart(assigned, 8, new Date(2026, 10, 16))).toEqual({
      kind: "active",
      weekIndex: 4,
    })
  })
})

describe("resolveEffectiveWeekIndex", () => {
  it("uses the exact week when the program authored it", () => {
    expect(resolveEffectiveWeekIndex([0, 1, 2, 3], 2)).toBe(2)
  })

  it("repeats week 0 for a program that only authored its first week", () => {
    expect(resolveEffectiveWeekIndex([0], 0)).toBe(0)
    expect(resolveEffectiveWeekIndex([0], 5)).toBe(0)
  })

  it("carries forward the last authored week when the program stops short", () => {
    expect(resolveEffectiveWeekIndex([0, 1, 2], 5)).toBe(2)
  })

  it("falls back to the earliest authored week when the target precedes them all", () => {
    expect(resolveEffectiveWeekIndex([2, 3], 0)).toBe(2)
  })

  it("returns null when nothing was authored", () => {
    expect(resolveEffectiveWeekIndex([], 3)).toBeNull()
  })
})
