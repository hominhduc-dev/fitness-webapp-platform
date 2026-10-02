import { describe, expect, it } from "vitest"

import { formatReadinessScore, readinessRingProgress } from "./readiness"

describe("readiness display", () => {
  it("shows the stored 0–100 score as whole points", () => {
    expect(formatReadinessScore(78.4)).toBe("78")
    expect(formatReadinessScore(78.5)).toBe("79")
    expect(formatReadinessScore(0)).toBe("0")
    expect(formatReadinessScore(100)).toBe("100")
  })

  it("clamps stray values and falls back without a score", () => {
    expect(formatReadinessScore(120)).toBe("100")
    expect(formatReadinessScore(-3)).toBe("0")
    expect(formatReadinessScore(null)).toBe("—")
    expect(formatReadinessScore(Number.NaN, "n/a")).toBe("n/a")
  })

  it("fills the ring by the same 0–100 scale", () => {
    expect(readinessRingProgress(78)).toBeCloseTo(0.78)
    expect(readinessRingProgress(150)).toBe(1)
    expect(readinessRingProgress(undefined)).toBe(0)
  })
})
