import { describe, expect, it } from "vitest"

import { MUSCLE_SLUGS } from "../../domain/muscle-profile"
import { systemLandmarksForMuscle } from "./volume-landmarks"

describe("system volume landmarks", () => {
  it("gives every muscle its own ordered starting point", () => {
    for (const slug of MUSCLE_SLUGS) {
      const landmarks = systemLandmarksForMuscle(slug)

      expect(landmarks.source).toBe("system")
      expect(landmarks.mevSets).toBeLessThanOrEqual(landmarks.mavMinSets)
      expect(landmarks.mavMinSets).toBeLessThanOrEqual(landmarks.mavMaxSets)
      expect(landmarks.mavMaxSets).toBeLessThanOrEqual(landmarks.mrvSets)
    }
  })

  it("tells muscles with different recovery capacity apart", () => {
    expect(systemLandmarksForMuscle("upper-back").mrvSets).toBeGreaterThan(systemLandmarksForMuscle("triceps").mrvSets)
    expect(systemLandmarksForMuscle("lower-back").mevSets).toBe(0)
  })

  it("falls back to the generic landmarks for a muscle it does not know", () => {
    expect(systemLandmarksForMuscle("not-a-muscle")).toMatchObject({ mevSets: 8, mavMinSets: 10, mavMaxSets: 16, mrvSets: 20 })
  })
})
