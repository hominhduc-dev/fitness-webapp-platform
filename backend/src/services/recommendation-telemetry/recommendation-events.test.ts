import { describe, expect, it } from "vitest"

import {
  buildRecommendationEventRows,
  evaluateEvent,
  evaluateOutcome,
  TRAINING_RECOMMENDATION_ALGORITHM_VERSION,
  type ExerciseLike,
  type StoredEvent,
} from "./recommendation-events"
import { summarizeTelemetry } from "./telemetry-summary"

const suggestion = [1, 2, 3].map((setNumber) => ({ previousReps: 10, previousWeight: 80, reps: 8, setNumber, weight: 82.5 }))

const bench: ExerciseLike = {
  id: "we-bench",
  progression: { action: "add_load", engineAction: "add_load", heldBy: null, reasons: ["top_of_range_reached"], setDelta: 0, sets: suggestion },
  sets: [
    { intensityTag: "warmup", setNumber: 0, targetReps: 12 },
    ...[1, 2, 3].map((setNumber) => ({ previousPerformance: { rir: 2 }, rir: 2, setNumber, targetReps: 10, targetRepsMin: 8 })),
  ],
  variation: { equipment: "barbell", id: "var-bench", primaryMuscles: ["chest"] },
}

const firstSession: ExerciseLike = {
  id: "we-curl",
  progression: { action: "establish_baseline", sets: [] },
  sets: [{ setNumber: 1, targetReps: 12 }],
  variation: { equipment: "dumbbell", id: "var-curl" },
}

function rows(source: "log_snapshot" | "session_start", exercises: ExerciseLike[] = [bench, firstSession]) {
  return buildRecommendationEventRows({
    context: source === "session_start"
      ? {
          dayGuidance: { action: "proceed", reasons: [], setAdjustmentPct: 0 },
          muscles: [{ muscleSlug: "chest", recommendation: { action: "maintain", confidence: 0.6, currentSets: 10, recommendedSets: 10 }, zone: "mav" }],
          phase: "accumulation",
          readiness: { label: "ready", score: 78 },
          targetRir: 3,
        }
      : null,
    exercises,
    loadIncrementByVariationId: new Map([["var-bench", null]]),
    programId: "program",
    sessionStartedAt: new Date("2026-10-03T09:00:00Z"),
    source,
    userId: "user",
    workoutId: "workout",
  })
}

describe("snapshot rows", () => {
  it("freezes one row per suggested exercise, with its inputs and the algorithm version", () => {
    const [row, ...rest] = rows("session_start")

    expect(rest).toHaveLength(0)
    expect(row).toMatchObject({
      action: "add_load",
      algorithmVersion: TRAINING_RECOMMENDATION_ALGORITHM_VERSION,
      dayAction: "proceed",
      equipment: "barbell",
      loadIncrementKg: 2.5,
      muscleSlug: "chest",
      muscleVolumeZone: "mav",
      previousReps: 10,
      previousRir: 2,
      previousWeight: 80,
      readinessScore: 78,
      source: "session_start",
      suggestedReps: 8,
      // The set's own target beats the phase's.
      suggestedRir: 2,
      suggestedSets: 3,
      suggestedWeight: 82.5,
      variationId: "var-bench",
      workoutExerciseId: "we-bench",
    })
    expect(row?.inputs).toMatchObject({ muscle: { confidence: 0.6, zone: "mav" }, reasons: ["top_of_range_reached"] })
  })

  it("does not read a log's logged RIR as the target", () => {
    expect(rows("log_snapshot")[0]).toMatchObject({ previousRir: null, readinessScore: null, source: "log_snapshot", suggestedRir: null })
  })
})

describe("evaluating a logged session", () => {
  const event: StoredEvent = {
    action: "add_load",
    loadIncrementKg: 2.5,
    previousReps: 10,
    previousWeight: 80,
    setDelta: 0,
    suggestedReps: 8,
    suggestedRir: 2,
    suggestedSets: 3,
    suggestedWeight: 82.5,
    variationId: "var-bench",
    workoutExerciseId: "we-bench",
  }
  const logged = (weight: number, reps: number[], extra: Partial<ExerciseLike> = {}): ExerciseLike => ({
    id: "we-bench",
    sets: [
      { actualReps: 12, completed: true, intensityTag: "warmup", rir: 5, weight: 40 },
      ...reps.map((actualReps) => ({ actualReps, completed: true, rir: 2, weight })),
      { actualReps: 8, completed: false, weight },
    ],
    variation: { id: "var-bench" },
    ...extra,
  })

  it("ignores warm-ups and unfinished sets", () => {
    expect(evaluateEvent(event, [logged(82.5, [8, 8, 8])])).toMatchObject({
      actualReps: 8,
      actualRir: 2,
      actualSets: 3,
      actualWeight: 82.5,
      overallCompliance: "followed",
      swapped: false,
    })
  })

  it("marks an exercise left out of the log as not attempted", () => {
    expect(evaluateEvent(event, [])).toMatchObject({ actualSets: 0, overallCompliance: "not_attempted" })
  })

  it("marks a swapped slot as modified", () => {
    expect(evaluateEvent(event, [logged(30, [10, 10, 10], { variation: { id: "var-db-press" } })]))
      .toMatchObject({ overallCompliance: "modified", swapped: true })
  })

  it("settles the next session's outcome against what was done", () => {
    const previous = { actualReps: 8, actualWeight: 82.5, loadIncrementKg: 2.5, overallCompliance: "followed" }
    expect(evaluateOutcome(previous, logged(80, [10, 10, 10]))).toBe("rolled_back")
    expect(evaluateOutcome(previous, logged(82.5, [9, 9, 9]))).toBe("successful")
    expect(evaluateOutcome(previous, logged(82.5, []))).toBeNull()
  })
})

describe("telemetry summary", () => {
  const group = { abandoned: false, action: "add_load", algorithmVersion: "v1", equipment: "barbell", outcome: null }

  it("rates compliance over evaluated rows and outcomes over followed ones", () => {
    const [row] = summarizeTelemetry([
      { ...group, count: 6, outcome: "successful", overallCompliance: "followed" },
      { ...group, count: 2, outcome: "rolled_back", overallCompliance: "followed" },
      { ...group, count: 2, overallCompliance: "partial" },
      { ...group, count: 3, overallCompliance: null },
      { ...group, abandoned: true, count: 1, overallCompliance: null },
    ], { byEquipment: false })

    expect(row).toMatchObject({
      abandoned: 1,
      pending: 3,
      rates: { followedPct: 80, partialPct: 20, rollbackAfterFollowedPct: 25, rollbackPct: 25, successAfterFollowedPct: 75 },
      shown: 14,
    })
    expect(row).not.toHaveProperty("equipment")
  })

  it("splits by equipment when asked", () => {
    const result = summarizeTelemetry([
      { ...group, count: 1, overallCompliance: "followed" },
      { ...group, count: 1, equipment: "machine", overallCompliance: "modified" },
    ], { byEquipment: true })

    expect(result.map((row) => [row.equipment, row.rates.followedPct])).toEqual([["barbell", 100], ["machine", 0]])
  })
})
