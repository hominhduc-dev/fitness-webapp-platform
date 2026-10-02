import { describe, expect, it } from "vitest"

import { buildWeightTrend } from "./weight-trend"

const now = new Date(2026, 8, 28, 9)
const at = (daysAgo: number, hour = 7) => new Date(2026, 8, 28 - daysAgo, hour)

describe("weight trend", () => {
  it("averages one reading per day and reads the weekly rate from the averages", () => {
    const readings = [
      ...[0, 1, 2, 3].map((day) => ({ recordedAt: at(day), weightKg: 79.5 })),
      // A late-evening reading does not count twice for its day.
      { recordedAt: at(0, 7), weightKg: 79.5 },
      { recordedAt: at(1, 22), weightKg: 79.5 },
      ...[7, 8, 9].map((day) => ({ recordedAt: at(day), weightKg: 80 })),
    ]

    expect(buildWeightTrend(readings, now)).toEqual({ ratePerWeekKg: -0.5, ratePerWeekPct: -0.62, sevenDayAverageKg: 79.5 })
  })

  it("withholds the rate until both weeks have three days of readings", () => {
    const readings = [
      ...[0, 1, 2].map((day) => ({ recordedAt: at(day), weightKg: 79 })),
      { recordedAt: at(8), weightKg: 80 },
    ]

    expect(buildWeightTrend(readings, now)).toEqual({ ratePerWeekKg: null, ratePerWeekPct: null, sevenDayAverageKg: 79 })
    expect(buildWeightTrend([], now)).toEqual({ ratePerWeekKg: null, ratePerWeekPct: null, sevenDayAverageKg: null })
  })
})
