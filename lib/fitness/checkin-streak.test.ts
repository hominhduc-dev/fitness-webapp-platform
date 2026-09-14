import { describe, expect, it } from "vitest"

import { countCheckInStreak } from "./checkin-streak"

const entries = (...dates: string[]) => dates.map((checkInDate) => ({ checkInDate }))

describe("countCheckInStreak", () => {
  it("is zero without check-ins", () => {
    expect(countCheckInStreak([], "2026-09-15")).toBe(0)
  })

  it("counts consecutive days ending today", () => {
    expect(countCheckInStreak(entries("2026-09-13", "2026-09-14", "2026-09-15"), "2026-09-15")).toBe(3)
  })

  it("keeps a streak that ended yesterday alive until today is over", () => {
    expect(countCheckInStreak(entries("2026-09-13", "2026-09-14"), "2026-09-15")).toBe(2)
  })

  it("resets once a whole day is skipped", () => {
    expect(countCheckInStreak(entries("2026-09-12", "2026-09-13"), "2026-09-15")).toBe(0)
  })

  it("stops at the first gap and ignores older runs", () => {
    expect(countCheckInStreak(entries("2026-09-09", "2026-09-10", "2026-09-14", "2026-09-15"), "2026-09-15")).toBe(2)
  })

  it("does not reset at the start of a week or month", () => {
    expect(countCheckInStreak(entries("2026-08-30", "2026-08-31", "2026-09-01"), "2026-09-01")).toBe(3)
  })

  it("ignores duplicates and ordering", () => {
    expect(countCheckInStreak(entries("2026-09-15", "2026-09-14", "2026-09-15"), "2026-09-15")).toBe(2)
  })
})
