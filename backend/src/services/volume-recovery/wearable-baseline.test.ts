import { describe, expect, it } from "vitest"

import { calculateReadiness, wearableReadinessAdjustment } from "./analytics"
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

  it("leaves a perfect check-in at 100 when the wearable sits at baseline", () => {
    const perfect = { fatigue: 1, sleepMinutes: 480, sleepQuality: 5, soreness: 0, stress: 1 }
    expect(calculateReadiness({ ...perfect, hrvZScore: 0, restingHeartRateDelta: 0 })).toBe(100)
  })

  it("nudges the check-in score by the wearable, within -15 and +10", () => {
    const base = calculateReadiness(answers)!

    // HRV one SD low and resting HR three beats up: -4 and -3.
    expect(calculateReadiness({ ...answers, hrvZScore: -1, restingHeartRateDelta: 3 })).toBe(base - 7)
    expect(wearableReadinessAdjustment({ hrvZScore: -3, restingHeartRateDelta: 12 })).toBe(-15)
    expect(wearableReadinessAdjustment({ hrvZScore: 3, restingHeartRateDelta: -6 })).toBe(10)
  })

  it("yields no score from wearable data alone", () => {
    expect(calculateReadiness({ hrvZScore: 1, restingHeartRateDelta: -2 })).toBeNull()
  })
})
