import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addUtcDays,
  formatUtcDateOnly,
  getUtcMonthBounds,
  parseLocalDateInput,
  parseScheduledDateInput,
  startOfUtcDay,
  startOfUtcWeek,
  toDateRange,
  toRecentWindow,
  toUtcDayStart,
} from "./dates"

afterEach(() => {
  vi.useRealTimers()
})

describe("formatUtcDateOnly", () => {
  it("produces the YYYY-MM-DD key used as the storage format", () => {
    expect(formatUtcDateOnly(new Date("2026-08-14T10:30:00.000Z"))).toBe("2026-08-14")
  })

  it("uses the UTC day even when the instant is late in the day", () => {
    // A server in UTC+7 reading this locally would see 2026-08-15; the key must not shift.
    expect(formatUtcDateOnly(new Date("2026-08-14T23:59:59.999Z"))).toBe("2026-08-14")
  })
})

describe("parseScheduledDateInput", () => {
  it("parses a valid day key to UTC midnight", () => {
    expect(parseScheduledDateInput("2026-08-14")?.toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("tolerates surrounding whitespace", () => {
    expect(parseScheduledDateInput("  2026-08-14  ")?.toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("rejects a rolled-over date the Date constructor would accept", () => {
    // new Date("2026-02-30") silently becomes March 2nd; the round-trip check catches it.
    expect(parseScheduledDateInput("2026-02-30")).toBeUndefined()
    expect(parseScheduledDateInput("2026-13-01")).toBeUndefined()
  })

  it("rejects any other format", () => {
    expect(parseScheduledDateInput("14/08/2026")).toBeUndefined()
    expect(parseScheduledDateInput("2026-8-14")).toBeUndefined()
    expect(parseScheduledDateInput("2026-08-14T00:00:00Z")).toBeUndefined()
    expect(parseScheduledDateInput("")).toBeUndefined()
  })

  it("accepts a leap day in a leap year and rejects it otherwise", () => {
    expect(parseScheduledDateInput("2028-02-29")).toBeDefined()
    expect(parseScheduledDateInput("2026-02-29")).toBeUndefined()
  })
})

describe("parseLocalDateInput", () => {
  it("anchors to local midnight rather than UTC", () => {
    const parsed = parseLocalDateInput("2026-08-14")

    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(7)
    expect(parsed?.getDate()).toBe(14)
    expect(parsed?.getHours()).toBe(0)
  })

  it("applies the same rollover rejection as the UTC parser", () => {
    expect(parseLocalDateInput("2026-02-30")).toBeUndefined()
    expect(parseLocalDateInput("2026-04-31")).toBeUndefined()
  })

  it("rejects a non-ISO format", () => {
    expect(parseLocalDateInput("hôm nay")).toBeUndefined()
  })
})

describe("startOfUtcWeek", () => {
  it("anchors the week to Monday", () => {
    // 2026-08-14 is a Friday.
    expect(formatUtcDateOnly(startOfUtcWeek(new Date("2026-08-14T12:00:00Z")))).toBe("2026-08-10")
  })

  it("treats Sunday as the end of the previous week, not the start of a new one", () => {
    // 2026-08-16 is a Sunday; a Sunday-first implementation would return 2026-08-16.
    expect(formatUtcDateOnly(startOfUtcWeek(new Date("2026-08-16T12:00:00Z")))).toBe("2026-08-10")
  })

  it("is idempotent on a Monday", () => {
    const monday = new Date("2026-08-10T00:00:00Z")

    expect(formatUtcDateOnly(startOfUtcWeek(monday))).toBe("2026-08-10")
  })

  it("crosses a month boundary correctly", () => {
    expect(formatUtcDateOnly(startOfUtcWeek(new Date("2026-09-01T12:00:00Z")))).toBe("2026-08-31")
  })
})

describe("addUtcDays", () => {
  it("moves forward and backward", () => {
    const base = new Date("2026-08-14T00:00:00Z")

    expect(formatUtcDateOnly(addUtcDays(base, 3))).toBe("2026-08-17")
    expect(formatUtcDateOnly(addUtcDays(base, -14))).toBe("2026-07-31")
  })

  it("does not mutate its argument", () => {
    const base = new Date("2026-08-14T00:00:00Z")
    addUtcDays(base, 5)

    expect(base.toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("crosses a leap-year boundary", () => {
    expect(formatUtcDateOnly(addUtcDays(new Date("2028-02-28T00:00:00Z"), 1))).toBe("2028-02-29")
  })
})

describe("startOfUtcDay / toUtcDayStart", () => {
  it("truncates the time component", () => {
    expect(startOfUtcDay(new Date("2026-08-14T18:45:12.345Z")).toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("agree with each other", () => {
    const date = new Date("2026-08-14T18:45:12.345Z")

    expect(toUtcDayStart(date)).toBe(startOfUtcDay(date).getTime())
  })
})

describe("getUtcMonthBounds", () => {
  it("returns the current month as a half-open interval", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-14T10:00:00Z"))
    const { end, start } = getUtcMonthBounds()

    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })

  it("applies a month offset, including across a year boundary", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-01-15T10:00:00Z"))
    const { end, start } = getUtcMonthBounds(-1)

    expect(start.toISOString()).toBe("2025-12-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("toDateRange", () => {
  it("spans exactly one local day, inclusive of the last millisecond", () => {
    const { end, start } = toDateRange(new Date(2026, 7, 14, 15, 30))

    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getDate()).toBe(14)
    expect(end.getHours()).toBe(23)
    expect(end.getMilliseconds()).toBe(999)
  })
})

describe("toRecentWindow", () => {
  it("includes today, so a 7-day window covers 7 distinct days", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 14, 12, 0, 0))
    const { end, start } = toRecentWindow(7)

    expect(start.getDate()).toBe(8)
    expect(end.getDate()).toBe(14)
    expect(end.getHours()).toBe(23)
  })

  it("degenerates to a single day for a window of 1", () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 14, 12, 0, 0))
    const { end, start } = toRecentWindow(1)

    expect(start.getDate()).toBe(end.getDate())
  })
})
