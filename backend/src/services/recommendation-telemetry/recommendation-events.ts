import type { Prisma } from "@prisma/client"

import { resolveLoadIncrement } from "../../domain/load-increment"
import type { OverloadAction } from "../../domain/progressive-overload"
import {
  classifyCompliance,
  classifyNextSessionOutcome,
  summarizeExecution,
  summarizeSuggestion,
  type ComplianceResult,
  type PerformedSet,
  type SuggestedSet,
} from "../../domain/recommendation-compliance"
import { VOLUME_RECOVERY_ALGORITHM_VERSION } from "../volume-recovery/analytics"

/**
 * Shaping between the workout and log payloads and TrainingRecommendationEvent
 * rows. No Prisma calls: the service does the reading and writing.
 */

/** Bump when the per-exercise progression or its reconciliation changes. */
const PROGRESSION_ALGORITHM_VERSION = "progression-v1"
const TRAINING_RECOMMENDATION_ALGORITHM_VERSION = `${PROGRESSION_ALGORITHM_VERSION}/${VOLUME_RECOVERY_ALGORITHM_VERSION}`

type ProgressionLike = {
  action: OverloadAction
  engineAction?: OverloadAction
  heldBy?: string | null
  muscleAction?: string | null
  muscleSlug?: string | null
  reasons?: readonly string[]
  setDelta?: number
  sets: readonly SuggestedSet[]
}

type SetLike = {
  actualReps?: number | null
  completed?: boolean
  intensityTag?: string | null
  previousPerformance?: { rir?: number | null } | null
  rir?: number | null
  setNumber?: number
  targetReps?: number
  targetRepsMin?: number | null
  weight?: number | null
}

type ExerciseLike = {
  id: string
  progression?: ProgressionLike | null
  sets?: readonly SetLike[]
  variation?: { equipment?: string | null; id?: string; primaryMuscles?: readonly string[] } | null
}

/** The session's context, when the server computed the snapshot itself. */
type SnapshotContext = {
  dayGuidance: { action: string; reasons: readonly string[]; setAdjustmentPct: number } | null
  muscles: ReadonlyArray<{
    muscleSlug: string
    recommendation: { action: string; confidence?: number; currentSets: number; recommendedSets: number; status?: string }
    zone?: string
  }>
  phase: string | null
  readiness: { label: string; score: number | null } | null
  targetRir: number | null
}

const isWorkingSet = (set: SetLike) => set.intensityTag !== "warmup"
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

function average(values: readonly number[]) {
  return values.length > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null
}

/**
 * One row per exercise the engine actually suggested something for. A first
 * session (establish_baseline) suggests nothing to follow and is skipped.
 */
function buildRecommendationEventRows(input: {
  context: SnapshotContext | null
  exercises: readonly ExerciseLike[]
  /** Per-variation load step overrides; the equipment's default otherwise. */
  loadIncrementByVariationId?: ReadonlyMap<string, number | null>
  programId: string | null
  sessionStartedAt: Date
  source: "log_snapshot" | "session_start"
  userId: string
  workoutId: string
}): Prisma.TrainingRecommendationEventCreateManyInput[] {
  return input.exercises.flatMap((exercise) => {
    const progression = exercise.progression
    if (!progression || progression.action === "establish_baseline" || progression.sets.length === 0) return []

    const workingSets = (exercise.sets ?? []).filter(isWorkingSet)
    // A log's sets are what was done, so its RIR is the trainee's, not the target.
    const fromLog = input.source === "log_snapshot"
    const programmedWorkingSets = fromLog ? progression.sets.length : workingSets.length || progression.sets.length
    const setDelta = progression.setDelta ?? 0
    const suggestion = summarizeSuggestion({ programmedWorkingSets, setDelta, sets: progression.sets })
    const programmedRir = fromLog ? null : workingSets.find((set) => finite(set.rir))?.rir ?? null
    const muscleSlug = progression.muscleSlug ?? exercise.variation?.primaryMuscles?.[0] ?? null
    const muscle = input.context?.muscles.find((entry) => entry.muscleSlug === muscleSlug) ?? null

    const inputs = {
      dayGuidance: input.context?.dayGuidance ?? null,
      engineAction: progression.engineAction ?? progression.action,
      muscle: muscle
        ? {
            action: muscle.recommendation.action,
            confidence: muscle.recommendation.confidence ?? null,
            currentSets: muscle.recommendation.currentSets,
            recommendedSets: muscle.recommendation.recommendedSets,
            slug: muscle.muscleSlug,
            status: muscle.recommendation.status ?? null,
            zone: muscle.zone ?? null,
          }
        : null,
      phase: input.context?.phase ?? null,
      programmedSets: fromLog
        ? null
        : workingSets.map((set) => ({ rir: set.rir ?? null, setNumber: set.setNumber, targetReps: set.targetReps, targetRepsMin: set.targetRepsMin ?? null })),
      readiness: input.context?.readiness ?? null,
      reasons: progression.reasons ?? [],
      suggestedSets: progression.sets,
      targetRir: input.context?.targetRir ?? null,
    }

    return [{
      action: progression.action,
      algorithmVersion: TRAINING_RECOMMENDATION_ALGORITHM_VERSION,
      dayAction: input.context?.dayGuidance?.action ?? null,
      engineAction: progression.engineAction ?? progression.action,
      equipment: exercise.variation?.equipment ?? null,
      heldBy: progression.heldBy ?? null,
      inputs: inputs as Prisma.InputJsonObject,
      loadIncrementKg: resolveLoadIncrement(
        exercise.variation?.id ? input.loadIncrementByVariationId?.get(exercise.variation.id) : null,
        exercise.variation?.equipment,
      ),
      muscleAction: progression.muscleAction ?? null,
      muscleSlug,
      muscleVolumeZone: muscle?.zone ?? null,
      phase: input.context?.phase ?? null,
      previousReps: suggestion.previousReps,
      previousRir: fromLog ? null : average(workingSets.flatMap((set) => (finite(set.previousPerformance?.rir) ? [set.previousPerformance.rir] : []))),
      previousWeight: suggestion.previousWeight,
      programId: input.programId,
      readinessScore: input.context?.readiness?.score ?? null,
      sessionStartedAt: input.sessionStartedAt,
      setDelta,
      source: input.source,
      suggestedReps: suggestion.suggestedReps,
      suggestedRir: programmedRir ?? input.context?.targetRir ?? null,
      suggestedSets: suggestion.suggestedSets,
      suggestedWeight: suggestion.suggestedWeight,
      userId: input.userId,
      variationId: exercise.variation?.id ?? null,
      workoutExerciseId: exercise.id,
      workoutId: input.workoutId,
    }]
  })
}

/** Completed working sets with reps, as the compliance check reads them. */
function performedSets(exercise: ExerciseLike | undefined): PerformedSet[] {
  return (exercise?.sets ?? []).flatMap((set) =>
    set.completed === true && isWorkingSet(set) && finite(set.actualReps) && set.actualReps > 0
      ? [{ reps: set.actualReps, rir: finite(set.rir) ? set.rir : null, weight: finite(set.weight) ? set.weight : null }]
      : [],
  )
}

type StoredEvent = {
  action: OverloadAction
  loadIncrementKg: number | null
  previousReps: number | null
  previousWeight: number | null
  setDelta: number
  suggestedReps: number | null
  suggestedRir: number | null
  suggestedSets: number
  suggestedWeight: number | null
  variationId: string | null
  workoutExerciseId: string
}

/** What the trainee did with one suggestion, ready to write onto its row. */
function evaluateEvent(event: StoredEvent, logExercises: readonly ExerciseLike[]) {
  const exercise = logExercises.find((entry) => entry.id === event.workoutExerciseId)
  const sets = performedSets(exercise)
  const execution = exercise && sets.length > 0 ? summarizeExecution(sets) : null
  const swapped = Boolean(exercise?.variation?.id && event.variationId && exercise.variation.id !== event.variationId)
  const compliance: ComplianceResult = classifyCompliance({
    ...event,
    execution,
    programmedWorkingSets: event.suggestedSets - event.setDelta,
    swapped,
  })
  return {
    actualReps: execution?.actualReps ?? null,
    actualRir: execution?.actualRir ?? null,
    actualSets: execution?.actualSets ?? 0,
    actualWeight: execution?.actualWeight ?? null,
    swapped,
    ...compliance,
  }
}

/** The next session's verdict on an earlier suggestion for the same variation. */
function evaluateOutcome(
  previous: { actualReps: number | null; actualWeight: number | null; loadIncrementKg: number | null; overallCompliance: string | null },
  exercise: ExerciseLike,
) {
  const sets = performedSets(exercise)
  if (sets.length === 0) return null
  const next = summarizeExecution(sets)
  return classifyNextSessionOutcome({
    loadIncrementKg: previous.loadIncrementKg,
    next: { reps: next.actualReps, weight: next.actualWeight },
    previous: {
      overallCompliance: previous.overallCompliance as Parameters<typeof classifyNextSessionOutcome>[0]["previous"]["overallCompliance"],
      reps: previous.actualReps,
      weight: previous.actualWeight,
    },
  })
}

export {
  buildRecommendationEventRows,
  evaluateEvent,
  evaluateOutcome,
  performedSets,
  TRAINING_RECOMMENDATION_ALGORITHM_VERSION,
}
export type { ExerciseLike, SnapshotContext, StoredEvent }
