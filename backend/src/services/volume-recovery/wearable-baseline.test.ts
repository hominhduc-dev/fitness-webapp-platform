import { describe, expect, it } from "vitest"

import { calculateReadiness } from "./analytics"
import { wearableSignalsForDay, type WearableDay } from "./wearable-baseline"

const today = new Date("2026-09-28T00:00:00.000Z")
const day = (offset: number) => new Date(today.getTime() + offset * 24 * 60 * 60 * 1000)

function baseline(count: number, values: (index: number) => Partial<WearableDay>): WearableDay[] {
  return Array.from({ length: count }, (_, index) => ({
    date: day(-(index + 1)),
    hrvRmssd: null,
    restingHeartRate: null,
    ...values(index),
  }))
}

describe("wearable baseline", () => {
  it("scores HRV against the trainee's own spread, on a log scale", () => {
    const history = baseline(14, (index) => ({ hrvRmssd: index % 2 === 0 ? 45 : 55 }))
    const low = wearableSignalsForDay([...history, { date: today, hrvRmssd: 35, restingHeartRate: null }], today)
    const usual = wearableSignalsForDay([...history, { date: today, hrvRmssd: 50, restingHeartRate: null }], today)

    expect(low.hrvZScore).toBeLessThan(-2)
    expect(Math.abs(usual.hrvZScore!)).toBeLessThan(0.2)
  })

  it("reports resting heart rate as beats above the baseline mean", () => {
    const history = baseline(10, () => ({ restingHeartRate: 55 }))
    expect(wearableSignalsForDay([...history, { date: today, hrvRmssd: null, restingHeartRate: 61 }], today))
      .toEqual({ hrvZScore: null, restingHeartRateDelta: 6 })
  })

  it("needs a week of history, and ignores days outside the four-week window", () => {
    const short = baseline(6, () => ({ hrvRmssd: 50, restingHeartRate: 55 }))
    expect(wearableSignalsForDay([...short, { date: today, hrvRmssd: 40, restingHeartRate: 60 }], today))
      .toEqual({ hrvZScore: null, restingHeartRateDelta: null })

    const stale = baseline(10, () => ({ restingHeartRate: 55 })).map((entry) => ({ ...entry, date: new Date(entry.date.getTime() - 30 * 24 * 60 * 60 * 1000) }))
    expect(wearableSignalsForDay([...stale, { date: today, hrvRmssd: null, restingHeartRate: 60 }], today).restingHeartRateDelta).toBeNull()
  })
})

describe("readiness with wearable signals", () => {
  const answers = { fatigue: 2, sleepQuality: 4, soreness: 1, stress: 30 }

  it("is unchanged for a trainee without a wearable", () => {
    expect(calculateReadiness({ ...answers, hrvZScore: null, restingHeartRateDelta: null })).toBe(calculateReadiness(answers))
  })

  it("drops on suppressed HRV and an elevated resting heart rate", () => {
    const base = calculateReadiness(answers)!
    const strained = calculateReadiness({ ...answers, hrvZScore: -2, restingHeartRateDelta: 8 })!
    const fresh = calculateReadiness({ ...answers, hrvZScore: 1.5, restingHeartRateDelta: -2 })!

    expect(strained).toBeLessThan(base - 10)
    expect(fresh).toBeGreaterThan(base)
  })
})
