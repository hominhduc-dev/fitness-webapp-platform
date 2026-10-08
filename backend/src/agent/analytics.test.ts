import { describe, expect, it } from "vitest"
import { comparePeriods } from "./analytics"
const now = new Date("2026-10-08T00:00:00Z")
function log(day: number, weight: number, variation = "bench", programId = "p", rir: number | null = 1) {
  return { id: `${day}`, programId, startedAt: new Date(now.getTime() - day * 86_400_000), exerciseSnapshot: [{
    exercise: { name: "Bench" }, variation: { id: variation, name: variation, activityType: "strength" },
    sets: [{ completed: true, actualReps: 8, weight, rir, targetReps: 8, targetRir: 1 }],
  }] }
}
describe("variation-aware period comparison", () => {
  it("reports improving strength from actual sets and engine-derived e1RM", () => {
    const result = comparePeriods([log(40, 20), log(38, 20), log(35, 20), log(20, 22), log(18, 22), log(15, 22)], now, 28)
    expect(result.comparisons[0]).toMatchObject({ signal: "improving", confidence: "moderate", beforeSessions: 3, afterSessions: 3 })
    expect(result.comparisons[0].changePercent).toBeCloseTo(10, 0)
  })
  it("never compares different variations or programs despite matching labels", () => {
    const result = comparePeriods([log(40, 20, "incline"), log(10, 30, "flat"), log(8, 40, "incline", "other")], now, 28)
    expect(result.comparisons).toHaveLength(3)
    expect(result.comparisons.every(item => item.changePercent === null)).toBe(true)
  })
  it("does not diagnose plateau with missing RIR, few exposures, or sampled data", () => {
    expect(comparePeriods([log(40, 20), log(10, 20)], now, 28).comparisons[0].signal).toBe("insufficient_data")
    const logs = [40, 38, 35, 20, 18, 15].map(day => log(day, 20, "bench", "p", null))
    expect(comparePeriods(logs, now, 28).comparisons[0].confidence).toBe("low")
    expect(comparePeriods(logs, now, 28, true).limited).toBe(true)
  })
  it("lowers confidence when prescribed reps/RIR changed", () => {
    const logs = [40, 38, 35, 20, 18, 15].map(day => log(day, 20))
    logs[0].exerciseSnapshot[0].sets[0].targetRir = 4
    expect(comparePeriods(logs, now, 28).comparisons[0]).toMatchObject({ prescriptionChanged: true, signal: "insufficient_data" })
  })
  it("excludes missing IDs, incomplete sets, cardio and invalid weight", () => {
    const missing = log(40, 20); missing.exerciseSnapshot[0].variation.id = ""
    const incomplete = log(10, 20); incomplete.exerciseSnapshot[0].sets[0].completed = false
    const cardio = log(9, 20); cardio.exerciseSnapshot[0].variation.activityType = "cardio"
    expect(comparePeriods([incomplete, cardio, log(8, 0)], now, 28).comparisons).toEqual([])
  })
})
