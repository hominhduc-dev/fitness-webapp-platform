import type { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
  buildVolumeRecommendation,
  calculateReadiness,
  classifyVolumeZone,
  DEFAULT_VOLUME_LANDMARKS,
} from "./analytics"

function log(exercises: unknown[], day = "2026-09-14") {
  return {
    exerciseSnapshot: exercises as Prisma.JsonValue,
    startedAt: new Date(`${day}T08:00:00.000Z`),
  }
}

function exercise(options?: { muscles?: string[]; secondary?: string[]; sets?: unknown[]; weight?: number }) {
  return {
    exercise: { id: "exercise-1", muscleGroup: "Chest", name: "Bench Press" },
    variation: {
      id: "variation-1",
      name: "Default",
      primaryMuscles: options?.muscles ?? ["chest"],
      secondaryMuscles: options?.secondary ?? ["triceps"],
    },
    sets: options?.sets ?? [
      { actualReps: 8, completed: true, rir: 2, setNumber: 1, weight: options?.weight ?? 80 },
    ],
  }
}

describe("volume recovery analytics", () => {
  it("counts only completed hard sets and weights secondary muscles", () => {
    const result = aggregateWeeklyMuscleVolume([
      log([
        exercise({
          sets: [
            { actualReps: 12, completed: true, intensityTag: "warmup", rir: 5, setNumber: 1, weight: 20 },
            { actualReps: 8, completed: true, rir: 2, setNumber: 2, weight: 80 },
            { actualReps: 8, completed: false, rir: 1, setNumber: 3, weight: 80 },
            { actualReps: 8, completed: true, rir: 5, setNumber: 4, weight: 70 },
            { actualReps: 7, completed: true, setNumber: 5, weight: 75 },
          ],
        }),
      ]),
    ])

    expect(result).toEqual([
      expect.objectContaining({ directSets: 2, effectiveSets: 2, lowConfidenceSets: 1, muscleSlug: "chest" }),
      expect.objectContaining({ indirectSets: 2, effectiveSets: 1, lowConfidenceSets: 0.5, muscleSlug: "triceps" }),
    ])
  })

  it("falls back to the legacy muscle group when an old snapshot has no profile", () => {
    const result = aggregateWeeklyMuscleVolume([
      log([{ ...exercise(), variation: { id: "variation-1", name: "Default" } }]),
    ])

    expect(result.some((item) => item.muscleSlug === "chest" && item.directSets === 1)).toBe(true)
  })

  it("calculates readiness while redistributing missing optional weights", () => {
    expect(calculateReadiness({ fatigue: 1, sleepQuality: 5 })).toBe(100)
    expect(calculateReadiness({ fatigue: 5, sleepQuality: 1, soreness: 5, stress: 5 })).toBe(0)
    expect(calculateReadiness({})).toBeNull()
  })

  it("classifies landmark zones at their boundaries", () => {
    expect(classifyVolumeZone(7.5, DEFAULT_VOLUME_LANDMARKS)).toBe("below_mev")
    expect(classifyVolumeZone(8, DEFAULT_VOLUME_LANDMARKS)).toBe("mev_to_mav")
    expect(classifyVolumeZone(10, DEFAULT_VOLUME_LANDMARKS)).toBe("mav")
    expect(classifyVolumeZone(17, DEFAULT_VOLUME_LANDMARKS)).toBe("near_mrv")
    expect(classifyVolumeZone(21, DEFAULT_VOLUME_LANDMARKS)).toBe("above_mrv")
  })

  it("requires repeated recovery evidence before recommending a deload", () => {
    const oneCheckIn = buildVolumeRecommendation({
      effectiveSets: 22,
      landmarks: DEFAULT_VOLUME_LANDMARKS,
      performanceChangePct: -4,
      readinessScore: 35,
      recoveryCheckInCount: 1,
      soreness: 5,
      zone: "above_mrv",
    })
    const repeatedEvidence = buildVolumeRecommendation({
      effectiveSets: 22,
      landmarks: DEFAULT_VOLUME_LANDMARKS,
      performanceChangePct: -4,
      readinessScore: 35,
      recoveryCheckInCount: 2,
      soreness: 5,
      zone: "above_mrv",
    })

    expect(oneCheckIn.action).toBe("decrease")
    expect(repeatedEvidence.action).toBe("deload")
    expect(repeatedEvidence.recommendedSets).toBe(13.2)
  })

  it("compares e1RM for the same variation across adjacent weeks", () => {
    const trend = buildMusclePerformanceTrend(
      [log([exercise({ weight: 82.5 })], "2026-09-14")],
      [log([exercise({ weight: 80 })], "2026-09-07")],
    )

    expect(trend.get("chest")).toBeCloseTo(3.1, 1)
    expect(trend.get("triceps")).toBeCloseTo(3.1, 1)
  })
})
