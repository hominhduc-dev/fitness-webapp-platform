import { describe, expect, it } from "vitest"

import { formatSleepDuration, SLEEP_BANDS, sleepBandMidpoint, sleepQualityFor } from "./sleep"

describe("sleep bands", () => {
  it("scores a night 1–5 at the 5, 6, 7 and 8 hour lines the quality answers use", () => {
    expect(sleepQualityFor(4 * 60 + 45)).toBe(1)
    expect(sleepQualityFor(5 * 60)).toBe(2)
    expect(sleepQualityFor(6 * 60)).toBe(3)
    expect(sleepQualityFor(7 * 60 + 59)).toBe(4)
    expect(sleepQualityFor(8 * 60)).toBe(5)
    expect(sleepQualityFor(10 * 60)).toBe(5)
    expect(sleepQualityFor(null)).toBeNull()
  })

  it("puts each band's button on the slider's 15-minute grid, inside that band", () => {
    for (const band of SLEEP_BANDS) {
      const minutes = sleepBandMidpoint(band)
      expect(minutes % 15).toBe(0)
      expect(sleepQualityFor(minutes)).toBe(band.quality)
    }
  })

  it("formats hours and minutes", () => {
    expect(formatSleepDuration(450)).toBe("7h 30m")
  })
})
