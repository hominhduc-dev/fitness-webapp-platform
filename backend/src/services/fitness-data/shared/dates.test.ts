import { afterEach, describe, expect, it, vi } from "vitest"

import { withRequestContext } from "../../../lib/logger"
import {
  addLocalDays,
  addUtcDays,
  clientCalendarDay,
  clientDayStart,
  formatClientDateKey,
  formatUtcDateOnly,
  getClientMonthBounds,
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

function inZone<T>(timeZone: string, callback: () => T) {
  return withRequestContext({ method: "GET", path: "/test", requestId: "test-request", timeZone }, callback)
}

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

describe("client calendar days", () => {
  // 20:00 UTC on Sunday 2026-08-16 is 03:00 on Monday 2026-08-17 in Vietnam.
  const lateSundayUtc = new Date("2026-08-16T20:00:00.000Z")

  it("files an instant under the client's day, not the server's or UTC's", () => {
    expect(inZone("Asia/Ho_Chi_Minh", () => formatClientDateKey(lateSundayUtc))).toBe("2026-08-17")
    expect(inZone("UTC", () => formatClientDateKey(lateSundayUtc))).toBe("2026-08-16")
    expect(inZone("America/New_York", () => formatClientDateKey(lateSundayUtc))).toBe("2026-08-16")
  })

  it("defaults to Vietnam outside a request", () => {
    expect(formatClientDateKey(lateSundayUtc)).toBe("2026-08-17")
  })

  it("moves the week with the client's day", () => {
    expect(inZone("Asia/Ho_Chi_Minh", () => formatUtcDateOnly(startOfUtcWeek(clientCalendarDay(lateSundayUtc))))).toBe("2026-08-17")
    expect(inZone("UTC", () => formatUtcDateOnly(startOfUtcWeek(clientCalendarDay(lateSundayUtc))))).toBe("2026-08-10")
  })

  it("maps a day key to the instant it begins for the client", () => {
    const day = new Date("2026-08-17T00:00:00.000Z")

    expect(inZone("Asia/Ho_Chi_Minh", () => clientDayStart(day).toISOString())).toBe("2026-08-16T17:00:00.000Z")
    expect(inZone("America/New_York", () => clientDayStart(day).toISOString())).toBe("2026-08-17T04:00:00.000Z")
  })
})

describe("parseLocalDateInput", () => {
  it("anchors to the client's midnight rather than UTC or the server's", () => {
    expect(inZone("Asia/Ho_Chi_Minh", () => parseLocalDateInput("2026-08-14")?.toISOString())).toBe("2026-08-13T17:00:00.000Z")
    expect(inZone("America/New_York", () => parseLocalDateInput("2026-08-14")?.toISOString())).toBe("2026-08-14T04:00:00.000Z")
  })

  it("applies the same rollover rejection as the UTC parser", () => {
    expect(parseLocalDateInput("2026-02-30")).toBeUndefined()
    expect(parseLocalDateInput("2026-04-31")).toBeUndefined()
  })

  it("rejects a non-ISO format", () => {
    expect(parseLocalDateInput("hôm nay")).toBeUndefined()
  })
})

describe("addLocalDays", () => {
  it("stays on local midnight across a DST change", () => {
    inZone("America/New_York", () => {
      const start = parseLocalDateInput("2026-10-31")!

      expect(addLocalDays(start, 1).toISOString()).toBe("2026-11-01T04:00:00.000Z")
      expect(addLocalDays(start, 2).toISOString()).toBe("2026-11-02T05:00:00.000Z")
    })
  })

  it("gives a 7-day week window a week apart in Vietnam", () => {
    inZone("Asia/Ho_Chi_Minh", () => {
      const weekStart = parseLocalDateInput("2026-09-14")!

      expect(addLocalDays(weekStart, 7).toISOString()).toBe("2026-09-20T17:00:00.000Z")
    })
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

describe("getClientMonthBounds", () => {
  it("uses the client's month, which can already have turned over in UTC terms", () => {
    // 20:00 UTC on 31 August is 03:00 on 1 September in Vietnam.
    vi.useFakeTimers().setSystemTime(new Date("2026-08-31T20:00:00Z"))

    const { end, start } = inZone("Asia/Ho_Chi_Minh", () => getClientMonthBounds())

    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z")
    expect(end.toISOString()).toBe("2026-09-30T17:00:00.000Z")
  })

  it("applies a month offset, including across a year boundary", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-01-15T10:00:00Z"))

    const { end, start } = inZone("UTC", () => getClientMonthBounds(-1))

    expect(start.toISOString()).toBe("2025-12-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("toDateRange", () => {
  it("spans exactly the client's calendar day, inclusive of the last millisecond", () => {
    // 15:30 UTC is 22:30 the same day in Vietnam.
    const { end, start } = inZone("Asia/Ho_Chi_Minh", () => toDateRange(new Date("2026-08-14T15:30:00Z")))

    expect(start.toISOString()).toBe("2026-08-13T17:00:00.000Z")
    expect(end.toISOString()).toBe("2026-08-14T16:59:59.999Z")
  })
})

describe("toRecentWindow", () => {
  it("includes today, so a 7-day window covers 7 client days", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-14T12:00:00Z"))

    const { end, start } = inZone("Asia/Ho_Chi_Minh", () => toRecentWindow(7))

    expect(start.toISOString()).toBe("2026-08-07T17:00:00.000Z")
    expect(end.toISOString()).toBe("2026-08-14T16:59:59.999Z")
  })

  it("degenerates to a single day for a window of 1", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-14T12:00:00Z"))

    const { end, start } = inZone("UTC", () => toRecentWindow(1))

    expect(start.toISOString()).toBe("2026-08-14T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-08-14T23:59:59.999Z")
  })
})
