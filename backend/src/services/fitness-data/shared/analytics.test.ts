import { afterEach, describe, expect, it, vi } from "vitest"

import { withRequestContext } from "../../../lib/logger"
import { calculateWeeklyWorkoutStreak, type ProgressAnalyticsLogRecord } from "./analytics"

afterEach(() => {
  vi.useRealTimers()
})

function inZone<T>(timeZone: string, callback: () => T) {
  return withRequestContext({ method: "GET", path: "/test", requestId: "test-request", timeZone }, callback)
}

/** Only `startedAt` matters to the streak; the rest of the record is ignored. */
function logsAt(...instants: string[]): ProgressAnalyticsLogRecord[] {
  return instants.map((instant) => ({
    exerciseSnapshot: null,
    startedAt: new Date(instant),
    totalVolume: 0,
  }))
}

/** Midday UTC, which is the same calendar day in every zone this app serves. */
function logsOn(...days: string[]): ProgressAnalyticsLogRecord[] {
  return logsAt(...days.map((day) => `${day}T10:00:00.000Z`))
}

describe("calculateWeeklyWorkoutStreak", () => {
  // 2026-09-16 is a Wednesday, so its week runs Mon 14th to Sun 20th.
  const wednesday = new Date("2026-09-16T12:00:00.000Z")

  it("counts nothing without a single workout", () => {
    vi.setSystemTime(wednesday)
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak([]))).toBe(0)
  })

  it("counts a week from one workout, whichever day it fell on", () => {
    vi.setSystemTime(wednesday)
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-09-14")))).toBe(1)
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-09-20")))).toBe(1)
  })

  it("does not count a week twice when it holds several workouts", () => {
    vi.setSystemTime(wednesday)
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-09-14", "2026-09-16", "2026-09-20")))).toBe(1)
  })

  it("keeps the streak across weeks trained on different days", () => {
    vi.setSystemTime(wednesday)
    // Sun 6th (week of Aug 31), Tue 8th and Sat 12th (week of Sep 7), Mon 14th.
    const streak = inZone("UTC", () =>
      calculateWeeklyWorkoutStreak(logsOn("2026-09-06", "2026-09-08", "2026-09-12", "2026-09-14")),
    )
    expect(streak).toBe(3)
  })

  it("breaks on a week with no workout at all", () => {
    vi.setSystemTime(wednesday)
    // Week of Sep 7 is empty, so only this week counts.
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-08-31", "2026-09-16")))).toBe(1)
  })

  it("keeps last week's streak while this week is still empty", () => {
    vi.setSystemTime(wednesday)
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-09-07", "2026-09-11")))).toBe(1)
  })

  it("drops to zero once a whole week has passed untrained", () => {
    vi.setSystemTime(wednesday)
    // Newest workout is in the week of Aug 31 — last week (Sep 7) is empty.
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-08-31")))).toBe(0)
  })

  it("splits Sunday from Monday, because the week starts on Monday", () => {
    vi.setSystemTime(wednesday)
    // Sun 13th closes one week and Mon 14th opens the next: two weeks, not one.
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logsOn("2026-09-13", "2026-09-14")))).toBe(2)
  })

  it("buckets a workout by the trainee's own calendar day, not by UTC", () => {
    vi.setSystemTime(wednesday)
    // 19:00 UTC on Sunday the 13th is 02:00 on Monday the 14th in +07:00, so
    // the same instant falls in a different week depending on the zone.
    const logs = logsAt("2026-09-13T19:00:00.000Z", "2026-09-09T10:00:00.000Z")

    // In Ho Chi Minh City that is this week plus last week.
    expect(inZone("Asia/Ho_Chi_Minh", () => calculateWeeklyWorkoutStreak(logs))).toBe(2)
    // In UTC both land in last week, which the empty current week still carries.
    expect(inZone("UTC", () => calculateWeeklyWorkoutStreak(logs))).toBe(1)
  })
})
