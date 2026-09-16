import { describe, expect, it } from "vitest"

import {
  formatClockTime12h,
  formatElapsed,
  getLocalClock,
  isDailyReminderDue,
  isWorkoutReminderDue,
  isWorkoutSessionLeftOpen,
  parseClockTime,
} from "./reminder-schedule"

describe("parseClockTime", () => {
  it("reads HH:mm as minutes since midnight", () => {
    expect(parseClockTime("00:00")).toBe(0)
    expect(parseClockTime("07:00")).toBe(420)
    expect(parseClockTime("23:59")).toBe(1439)
  })

  it("rejects malformed times", () => {
    expect(parseClockTime("7:00")).toBeNull()
    expect(parseClockTime("24:00")).toBeNull()
    expect(parseClockTime("07:60")).toBeNull()
    expect(parseClockTime("")).toBeNull()
  })
})

describe("getLocalClock", () => {
  it("reads the calendar day, weekday and minute in the user's zone", () => {
    // 2026-09-20 23:30 UTC is Monday 2026-09-21 06:30 in Vietnam.
    const clock = getLocalClock(new Date("2026-09-20T23:30:00Z"), "Asia/Ho_Chi_Minh")

    expect(clock.dateKey).toBe("2026-09-21")
    expect(clock.weekday).toBe(1)
    expect(clock.minutes).toBe(390)
    expect(clock.dayStart.toISOString()).toBe("2026-09-20T17:00:00.000Z")
    expect(clock.dayEnd.toISOString()).toBe("2026-09-21T17:00:00.000Z")
  })

  it("falls back to the default zone for an invalid one", () => {
    expect(getLocalClock(new Date("2026-09-20T23:30:00Z"), "Nowhere/Invalid").timeZone).toBe("Asia/Ho_Chi_Minh")
  })
})

describe("isDailyReminderDue", () => {
  const at = (iso: string) => getLocalClock(new Date(iso), "Asia/Ho_Chi_Minh")

  it("fires from the chosen minute through the catch-up window", () => {
    expect(isDailyReminderDue(at("2026-09-20T23:59:00Z"), "07:00")).toBe(false) // 06:59
    expect(isDailyReminderDue(at("2026-09-21T00:00:00Z"), "07:00")).toBe(true) // 07:00
    expect(isDailyReminderDue(at("2026-09-21T01:29:00Z"), "07:00")).toBe(true) // 08:29
    expect(isDailyReminderDue(at("2026-09-21T01:30:00Z"), "07:00")).toBe(false) // 08:30
  })

  it("respects the selected days of week", () => {
    const mondayMorning = at("2026-09-21T00:05:00Z")

    expect(isDailyReminderDue(mondayMorning, "07:00", [1, 3, 5])).toBe(true)
    expect(isDailyReminderDue(mondayMorning, "07:00", [0, 6])).toBe(false)
    expect(isDailyReminderDue(mondayMorning, "07:00", [])).toBe(false)
  })

  it("never fires for a malformed time", () => {
    expect(isDailyReminderDue(at("2026-09-21T00:05:00Z"), "7am")).toBe(false)
  })
})

describe("getLocalClock week start", () => {
  it("anchors the week on the local Monday", () => {
    // Sunday 2026-09-27 18:00 in Vietnam belongs to the week of Monday 2026-09-21.
    const clock = getLocalClock(new Date("2026-09-27T11:00:00Z"), "Asia/Ho_Chi_Minh")

    expect(clock.weekday).toBe(0)
    expect(clock.weekStartKey).toBe("2026-09-21")
    expect(clock.weekStart.toISOString()).toBe("2026-09-20T17:00:00.000Z")
  })

  it("normalises a week that starts in the previous month", () => {
    expect(getLocalClock(new Date("2026-10-02T03:00:00Z"), "Asia/Ho_Chi_Minh").weekStartKey).toBe("2026-09-28")
  })
})

describe("isWorkoutReminderDue", () => {
  const at = (iso: string) => getLocalClock(new Date(iso), "Asia/Ho_Chi_Minh")

  it("is due from the lead time until the workout starts", () => {
    expect(isWorkoutReminderDue(at("2026-09-21T10:29:00Z"), "18:00", 30)).toBe(false) // 17:29
    expect(isWorkoutReminderDue(at("2026-09-21T10:30:00Z"), "18:00", 30)).toBe(true) // 17:30
    expect(isWorkoutReminderDue(at("2026-09-21T10:59:00Z"), "18:00", 30)).toBe(true) // 17:59
    expect(isWorkoutReminderDue(at("2026-09-21T11:00:00Z"), "18:00", 30)).toBe(false) // 18:00
  })

  it("clamps a lead time that would cross midnight", () => {
    expect(isWorkoutReminderDue(at("2026-09-20T17:05:00Z"), "00:15", 60)).toBe(true) // 00:05
  })
})

describe("meal reminder window", () => {
  it("accepts a shorter catch-up window", () => {
    const lateLunch = getLocalClock(new Date("2026-09-21T06:05:00Z"), "Asia/Ho_Chi_Minh") // 13:05

    expect(isDailyReminderDue(lateLunch, "12:00")).toBe(true)
    expect(isDailyReminderDue(lateLunch, "12:00", undefined, 60)).toBe(false)
  })
})

describe("formatClockTime12h", () => {
  it("formats push copy times", () => {
    expect(formatClockTime12h("18:00")).toBe("6:00 PM")
    expect(formatClockTime12h("00:05")).toBe("12:05 AM")
    expect(formatClockTime12h("12:30")).toBe("12:30 PM")
  })
})

describe("isWorkoutSessionLeftOpen", () => {
  const now = new Date("2026-09-21T12:00:00Z")
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000)

  it("flags a session started 2h+ ago and idle for 30m+", () => {
    expect(isWorkoutSessionLeftOpen({ startedAt: hoursAgo(2), updatedAt: hoursAgo(1) }, now)).toBe(true)
  })

  it("skips a session still being logged", () => {
    expect(isWorkoutSessionLeftOpen({ startedAt: hoursAgo(3), updatedAt: hoursAgo(0.1) }, now)).toBe(false)
  })

  it("skips sessions that are too new or abandoned long ago", () => {
    expect(isWorkoutSessionLeftOpen({ startedAt: hoursAgo(1.5), updatedAt: hoursAgo(1) }, now)).toBe(false)
    expect(isWorkoutSessionLeftOpen({ startedAt: hoursAgo(30), updatedAt: hoursAgo(29) }, now)).toBe(false)
  })
})

describe("formatElapsed", () => {
  it("uses minutes under an hour and whole hours after", () => {
    expect(formatElapsed(60_000)).toBe("1 minute")
    expect(formatElapsed(45 * 60_000)).toBe("45 minutes")
    expect(formatElapsed(60 * 60_000)).toBe("1 hour")
    expect(formatElapsed(150 * 60_000)).toBe("2 hours")
  })
})
