import { describe, expect, it } from "vitest"

import { STRESS_LEVELS, stressLevelFor } from "./stress"

describe("stressLevelFor", () => {
  it("places each band edge in Huawei's level", () => {
    expect([1, 29, 30, 59, 60, 79, 80, 99].map(stressLevelFor)).toEqual([
      "none", "none", "low", "low", "medium", "medium", "high", "high",
    ])
  })

  it("rounds and clamps synced averages, and has no level without a score", () => {
    expect(stressLevelFor(29.4)).toBe("none")
    expect(stressLevelFor(29.6)).toBe("low")
    expect(stressLevelFor(0)).toBe("none")
    expect(stressLevelFor(150)).toBe("high")
    expect(stressLevelFor(null)).toBeNull()
    expect(stressLevelFor(Number.NaN)).toBeNull()
  })

  it("covers 1–99 with contiguous bands", () => {
    expect(STRESS_LEVELS[0].min).toBe(1)
    expect(STRESS_LEVELS[STRESS_LEVELS.length - 1].max).toBe(99)
    STRESS_LEVELS.slice(1).forEach((band, index) => expect(band.min).toBe(STRESS_LEVELS[index].max + 1))
  })
})
