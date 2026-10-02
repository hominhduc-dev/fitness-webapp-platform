import { describe, expect, it } from "vitest"

import { learnVolumeLandmarks, type LearningWeek } from "./volume-learning"

const system = { mavMaxSets: 16, mavMinSets: 10, mevSets: 6, mrvSets: 22 }

const productive = (sets: number): LearningWeek => ({ averageReadiness: 75, effectiveSets: sets, maxSoreness: 2, performanceChangePct: 2 })
const overreached = (sets: number): LearningWeek => ({ averageReadiness: 40, effectiveSets: sets, maxSoreness: 4, performanceChangePct: -4 })
const neutral = (sets: number): LearningWeek => ({ averageReadiness: 65, effectiveSets: sets, maxSoreness: 2, performanceChangePct: 0 })

describe("volume learning", () => {
  it("learns nothing from fewer than four weeks", () => {
    expect(learnVolumeLandmarks(system, [productive(8), productive(10), overreached(18)])).toBeNull()
  })

  it("learns nothing without two weeks of the same kind of evidence", () => {
    expect(learnVolumeLandmarks(system, [productive(8), overreached(18), neutral(12), neutral(12)])).toBeNull()
  })

  it("pulls MRV down to where recovery repeatedly ran out", () => {
    const learned = learnVolumeLandmarks(system, [
      productive(10), productive(12), productive(14), neutral(14),
      overreached(16), overreached(17), neutral(12), productive(13),
    ])!

    // Eight weeks: the history carries 80% of the weight. 22×0.2 + 16×0.8 = 17.2.
    expect(learned.mrvSets).toBe(17)
    expect(learned.weeksObserved).toBe(8)
    expect(learned.confidence).toBe(0.85)
  })

  it("lowers MEV when the trainee progressed on less than the default", () => {
    const learned = learnVolumeLandmarks(system, [productive(4), productive(5), neutral(6), neutral(6)])!

    // Four weeks: weight 0.4. MEV 6×0.6 + 4×0.4 = 5.2 → 5.
    expect(learned.mevSets).toBe(5)
    expect(learned.mrvSets).toBe(22)
  })

  it("keeps the landmarks ordered whatever the evidence", () => {
    const learned = learnVolumeLandmarks(system, [
      productive(20), productive(21), overreached(9), overreached(10), neutral(12), neutral(12), neutral(12), neutral(12),
    ])!

    expect(learned.mevSets).toBeLessThanOrEqual(learned.mavMinSets)
    expect(learned.mavMinSets).toBeLessThanOrEqual(learned.mavMaxSets)
    expect(learned.mavMaxSets).toBeLessThanOrEqual(learned.mrvSets)
  })
})
