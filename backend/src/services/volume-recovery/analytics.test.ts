import type { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
  buildTrainingGuidance,
  buildVolumeRecommendation,
  calculateReadiness,
  classifyVolumeZone,
  DEFAULT_VOLUME_LANDMARKS,
  readinessSoreness,
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

describe("readiness soreness", () => {
  it("is the sorest muscle's, so one sore muscle is not averaged away", () => {
    expect(readinessSoreness([{ soreness: 0 }, { soreness: 4 }, { soreness: 2 }])).toBe(4)
  })

  it("is 0 when every muscle was rated not sore", () => {
    expect(readinessSoreness([{ soreness: 0 }, { soreness: 0 }])).toBe(0)
  })

  it("is null when soreness was not answered", () => {
    expect(readinessSoreness([])).toBeNull()
  })
})

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

  it("scores sleep duration on a ramp between four and seven hours", () => {
    const answers = { fatigue: 1, sleepQuality: 5, soreness: 0, stress: 1 }

    // Seven hours and anything above it leave the perfect score untouched.
    expect(calculateReadiness({ ...answers, sleepMinutes: 420 })).toBe(100)
    expect(calculateReadiness({ ...answers, sleepMinutes: 600 })).toBe(100)

    // Four hours zeroes the duration component, which carries a weight of 0.15.
    expect(calculateReadiness({ ...answers, sleepMinutes: 240 })).toBe(85)

    // Halfway up the ramp costs half of that weight.
    expect(calculateReadiness({ ...answers, sleepMinutes: 330 })).toBe(93)
  })

  it("ignores sleep duration when it was skipped", () => {
    const answers = { fatigue: 3, sleepQuality: 3, soreness: 2, stress: 3 }

    expect(calculateReadiness({ ...answers, sleepMinutes: null })).toBe(calculateReadiness(answers))
  })

  it("adjusts today's session by readiness and the muscles needing a back-off", () => {
    const steady = [{ muscleSlug: "chest", recommendation: { action: "maintain" as const } }]
    const backingOff = [
      ...steady,
      { muscleSlug: "upper-back", recommendation: { action: "deload" as const } },
    ]

    // No check-in is not evidence of a bad day, so the plan stands.
    expect(buildTrainingGuidance({ muscles: steady, readinessScore: null, soreness: null }))
      .toMatchObject({ action: "proceed", reasons: ["no_check_in"], setAdjustmentPct: 0 })

    expect(buildTrainingGuidance({ muscles: steady, readinessScore: 82, soreness: 1 }))
      .toMatchObject({ action: "proceed", reasons: ["readiness_good"], setAdjustmentPct: 0 })

    // Ready on paper, but a muscle the engine wants backed off still trims the session.
    expect(buildTrainingGuidance({ muscles: backingOff, readinessScore: 82, soreness: 1 }))
      .toMatchObject({ action: "reduce_volume", focusMuscles: ["upper-back"], setAdjustmentPct: -15 })

    expect(buildTrainingGuidance({ muscles: steady, readinessScore: 58, soreness: 1 }))
      .toMatchObject({ action: "reduce_volume", setAdjustmentPct: -15 })

    expect(buildTrainingGuidance({ muscles: steady, readinessScore: 44, soreness: 4 }))
      .toMatchObject({ action: "light_session", reasons: ["readiness_low", "soreness_high"], setAdjustmentPct: -30 })

    expect(buildTrainingGuidance({ muscles: backingOff, readinessScore: 20, soreness: 5 }))
      .toMatchObject({ action: "rest", setAdjustmentPct: -100 })
  })

  it("shares its readiness thresholds with the per-muscle engine", () => {
    const muscles = [{ muscleSlug: "chest", recommendation: { action: "maintain" as const } }]

    // 70 is "recovered" for buildVolumeRecommendation, so it must not be a
    // trimmed session here — the two would contradict each other on one score.
    expect(buildTrainingGuidance({ muscles, readinessScore: 70, soreness: 0 }).action).toBe("proceed")
    expect(buildTrainingGuidance({ muscles, readinessScore: 69, soreness: 0 }).action).toBe("reduce_volume")
    expect(buildTrainingGuidance({ muscles, readinessScore: 50, soreness: 0 }).action).toBe("reduce_volume")
    expect(buildTrainingGuidance({ muscles, readinessScore: 49, soreness: 0 }).action).toBe("light_session")
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
