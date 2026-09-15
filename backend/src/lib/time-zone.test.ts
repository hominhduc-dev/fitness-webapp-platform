import { describe, expect, it } from "vitest"

import { withRequestContext } from "./logger"
import {
  DEFAULT_TIME_ZONE,
  getRequestTimeZone,
  getTimeZoneOffsetMs,
  isValidTimeZone,
  resolveTimeZone,
  toZonedDateKey,
  zonedMidnight,
} from "./time-zone"

function inZone<T>(timeZone: string, callback: () => T) {
  return withRequestContext({ method: "GET", path: "/test", requestId: "test-request", timeZone }, callback)
}

describe("time zone validation", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isValidTimeZone("Asia/Ho_Chi_Minh")).toBe(true)
    expect(isValidTimeZone("America/New_York")).toBe(true)
    expect(isValidTimeZone("UTC")).toBe(true)
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false)
    expect(isValidTimeZone("")).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
    expect(isValidTimeZone("A".repeat(65))).toBe(false)
  })

  it("falls back to Vietnam for a missing or invalid zone", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Ho_Chi_Minh")
    expect(resolveTimeZone("not/a-zone")).toBe(DEFAULT_TIME_ZONE)
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE)
    expect(resolveTimeZone("Europe/Berlin")).toBe("Europe/Berlin")
  })

  it("reads the zone of the request being served", () => {
    expect(getRequestTimeZone()).toBe(DEFAULT_TIME_ZONE)
    expect(inZone("Europe/Berlin", () => getRequestTimeZone())).toBe("Europe/Berlin")
  })
})

describe("toZonedDateKey", () => {
  it("uses the client's calendar day, not the UTC one", () => {
    // 20:00 UTC on Sunday is 03:00 on Monday in Vietnam.
    const instant = new Date("2026-08-16T20:00:00.000Z")

    expect(toZonedDateKey(instant, "UTC")).toBe("2026-08-16")
    expect(toZonedDateKey(instant, "Asia/Ho_Chi_Minh")).toBe("2026-08-17")
    expect(toZonedDateKey(instant, "America/Los_Angeles")).toBe("2026-08-16")
  })

  it("defaults to the request zone", () => {
    const instant = new Date("2026-08-16T20:00:00.000Z")

    expect(inZone("UTC", () => toZonedDateKey(instant))).toBe("2026-08-16")
  })
})

describe("getTimeZoneOffsetMs", () => {
  it("reports the offset ahead of UTC, including DST", () => {
    expect(getTimeZoneOffsetMs(new Date("2026-08-14T00:00:00Z"), "Asia/Ho_Chi_Minh")).toBe(7 * 3_600_000)
    expect(getTimeZoneOffsetMs(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-4 * 3_600_000)
    expect(getTimeZoneOffsetMs(new Date("2026-12-01T12:00:00Z"), "America/New_York")).toBe(-5 * 3_600_000)
  })
})

describe("zonedMidnight", () => {
  it("returns the instant local midnight begins", () => {
    expect(zonedMidnight(2026, 8, 14, "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-08-13T17:00:00.000Z")
    expect(zonedMidnight(2026, 8, 14, "UTC").toISOString()).toBe("2026-08-14T00:00:00.000Z")
  })

  it("follows DST on both sides of the change", () => {
    // New York leaves DST at 02:00 on 2026-11-01.
    expect(zonedMidnight(2026, 11, 1, "America/New_York").toISOString()).toBe("2026-11-01T04:00:00.000Z")
    expect(zonedMidnight(2026, 11, 2, "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z")
  })

  it("lets the month overflow into the next year", () => {
    expect(zonedMidnight(2026, 13, 1, "UTC").toISOString()).toBe("2027-01-01T00:00:00.000Z")
  })
})
