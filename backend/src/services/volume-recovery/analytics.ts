import type { Prisma } from "@prisma/client"

import { legacyMuscleGroupToSlugs } from "../../domain/muscle-profile"
import {
  getSnapshotExerciseId,
  getSnapshotMaxE1RM,
  getSnapshotMuscleGroup,
  getSnapshotPrimaryMuscles,
  getSnapshotSecondaryMuscles,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
  type WorkoutLogSnapshotExercise,
} from "../fitness-data/shared/workout-snapshot"

// v2 folds sleep duration into the readiness score; v3 scores soreness by the
// sorest muscle rather than the average. Check-ins keep the version they were
// scored with, so older rows stay explainable.
const VOLUME_RECOVERY_ALGORITHM_VERSION = "volume-recovery-v3"

type VolumeLogRecord = {
  exerciseSnapshot: Prisma.JsonValue | null
  startedAt: Date
}

type MuscleVolume = {
  averageRir: number | null
  directSets: number
  effectiveSets: number
  indirectSets: number
  lowConfidenceSets: number
  muscleSlug: string
}

type VolumeLandmarks = {
  confidence: number
  mavMaxSets: number
  mavMinSets: number
  mevSets: number
  mrvSets: number
  source: "system" | "coach" | "learned"
}

type VolumeZone =
  | "above_mrv"
  | "below_mev"
  | "insufficient_data"
  | "mav"
  | "mev_to_mav"
  | "near_mrv"

type ReadinessInput = {
  fatigue?: number | null
  sleepMinutes?: number | null
  sleepQuality?: number | null
  soreness?: number | null
  stress?: number | null
}

type RecommendationAction = "decrease" | "deload" | "increase" | "maintain"

type RecommendationReason =
  | "above_mrv"
  | "below_mev"
  | "collect_more_performance"
  | "inside_mav"
  | "insufficient_evidence"
  | "performance_down"
  | "performance_stable_or_up"
  | "recovery_and_performance_declining"
  | "recovery_good"
  | "recovery_signals_elevated"

type VolumeRecommendationResult = {
  action: RecommendationAction
  confidence: number
  currentSets: number
  reasons: RecommendationReason[]
  recommendedSets: number
}

const DEFAULT_VOLUME_LANDMARKS: VolumeLandmarks = {
  confidence: 0.25,
  mavMaxSets: 16,
  mavMinSets: 10,
  mevSets: 8,
  mrvSets: 20,
  source: "system",
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function muscleTargets(exercise: WorkoutLogSnapshotExercise) {
  const explicitPrimary = getSnapshotPrimaryMuscles(exercise)
  const explicitSecondary = getSnapshotSecondaryMuscles(exercise).filter(
    (muscle) => !explicitPrimary.includes(muscle),
  )

  if (explicitPrimary.length > 0 || explicitSecondary.length > 0) {
    return { primary: explicitPrimary, secondary: explicitSecondary }
  }

  const legacyGroup = getSnapshotMuscleGroup(exercise)
  return {
    primary: legacyGroup ? [...legacyMuscleGroupToSlugs(legacyGroup)] : [],
    secondary: [] as string[],
  }
}

function hardSets(exercise: WorkoutLogSnapshotExercise) {
  return (exercise.sets ?? []).filter((set) => {
    if (set?.completed !== true || set.intensityTag === "warmup") return false
    if (typeof set.actualReps !== "number" || set.actualReps <= 0) return false
    return typeof set.rir !== "number" || set.rir <= 4
  })
}

function aggregateWeeklyMuscleVolume(logs: readonly VolumeLogRecord[]) {
  const buckets = new Map<
    string,
    { direct: number; indirect: number; lowConfidence: number; rirSum: number; rirCount: number }
  >()

  for (const log of logs) {
    for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
      const sets = hardSets(exercise)
      if (sets.length === 0) continue

      const targets = muscleTargets(exercise)
      const lowConfidence = sets.filter((set) => typeof set.rir !== "number").length
      const rirValues = sets.flatMap((set) => (typeof set.rir === "number" ? [set.rir] : []))

      for (const [role, muscles] of [
        ["primary", targets.primary],
        ["secondary", targets.secondary],
      ] as const) {
        for (const muscleSlug of muscles) {
          const bucket = buckets.get(muscleSlug) ?? {
            direct: 0,
            indirect: 0,
            lowConfidence: 0,
            rirCount: 0,
            rirSum: 0,
          }
          const multiplier = role === "primary" ? 1 : 0.5

          if (role === "primary") bucket.direct += sets.length
          else bucket.indirect += sets.length
          bucket.lowConfidence += lowConfidence * multiplier
          bucket.rirSum += rirValues.reduce((sum, rir) => sum + rir * multiplier, 0)
          bucket.rirCount += rirValues.length * multiplier
          buckets.set(muscleSlug, bucket)
        }
      }
    }
  }

  return Array.from(buckets.entries())
    .map(([muscleSlug, bucket]): MuscleVolume => ({
      averageRir: bucket.rirCount > 0 ? round(bucket.rirSum / bucket.rirCount) : null,
      directSets: bucket.direct,
      effectiveSets: round(bucket.direct + bucket.indirect * 0.5),
      indirectSets: bucket.indirect,
      lowConfidenceSets: round(bucket.lowConfidence),
      muscleSlug,
    }))
    .sort((left, right) => right.effectiveSets - left.effectiveSets || left.muscleSlug.localeCompare(right.muscleSlug))
}

function buildMusclePerformanceTrend(currentLogs: readonly VolumeLogRecord[], previousLogs: readonly VolumeLogRecord[]) {
  type ExercisePerformance = { e1rm: number; muscles: string[] }

  function bestByVariation(logs: readonly VolumeLogRecord[]) {
    const result = new Map<string, ExercisePerformance>()

    for (const log of logs) {
      for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
        const best = getSnapshotMaxE1RM(exercise)
        const key = getSnapshotVariationId(exercise) ?? getSnapshotExerciseId(exercise)
        if (!best || !key) continue

        const targets = muscleTargets(exercise)
        const muscles = Array.from(new Set([...targets.primary, ...targets.secondary]))
        const existing = result.get(key)
        if (!existing || best.e1rm > existing.e1rm) result.set(key, { e1rm: best.e1rm, muscles })
      }
    }

    return result
  }

  const current = bestByVariation(currentLogs)
  const previous = bestByVariation(previousLogs)
  const deltas = new Map<string, number[]>()

  current.forEach((currentValue, key) => {
    const previousValue = previous.get(key)
    if (!previousValue || previousValue.e1rm <= 0) return
    const delta = ((currentValue.e1rm - previousValue.e1rm) / previousValue.e1rm) * 100

    currentValue.muscles.forEach((muscle) => {
      const values = deltas.get(muscle) ?? []
      values.push(delta)
      deltas.set(muscle, values)
    })
  })

  return new Map(
    Array.from(deltas.entries()).map(([muscle, values]) => [
      muscle,
      round(values.reduce((sum, value) => sum + value, 0) / values.length),
    ]),
  )
}

const SLEEP_DURATION_FLOOR_MINUTES = 240
const SLEEP_DURATION_TARGET_MINUTES = 420

/**
 * Sleep duration ramps linearly from "barely slept" at 4h to a full score at 7h.
 * A ramp rather than buckets so a trainee who sleeps 10 minutes longer never
 * sees the score jump, and sleeping past the target is not penalised: long
 * sleep on its own is not evidence of poor recovery, and the fatigue and
 * soreness answers already carry that signal.
 */
function scoreSleepDuration(sleepMinutes: number) {
  const span = SLEEP_DURATION_TARGET_MINUTES - SLEEP_DURATION_FLOOR_MINUTES
  return clamp(((sleepMinutes - SLEEP_DURATION_FLOOR_MINUTES) / span) * 100, 0, 100)
}

/**
 * The soreness readiness scores: the sorest muscle's. Check-ins rate every
 * muscle, most at 0, so an average would let one badly sore muscle vanish
 * among the fresh ones. Null when soreness was not answered at all.
 */
function readinessSoreness(muscles: ReadonlyArray<{ soreness: number }>) {
  return muscles.length > 0 ? Math.max(...muscles.map((muscle) => muscle.soreness)) : null
}

/**
 * Weights are whole numbers adding up to 100 when every answer is present: as
 * fractions they sum to 1.0000000000000002 and a score landing exactly on .5
 * then rounds the wrong way. A skipped answer drops out and the rest are
 * renormalised, so a partial check-in still yields a usable score.
 */
function calculateReadiness(input: ReadinessInput) {
  const components: Array<{ score: number; weight: number }> = []
  const toFivePointScore = (value: number) => clamp(((value - 1) / 4) * 100, 0, 100)

  if (input.fatigue != null) components.push({ score: 100 - toFivePointScore(input.fatigue), weight: 35 })
  if (input.sleepQuality != null) components.push({ score: toFivePointScore(input.sleepQuality), weight: 20 })
  if (input.sleepMinutes != null) components.push({ score: scoreSleepDuration(input.sleepMinutes), weight: 15 })
  if (input.soreness != null) components.push({ score: 100 - clamp((input.soreness / 5) * 100, 0, 100), weight: 20 })
  if (input.stress != null) components.push({ score: 100 - toFivePointScore(input.stress), weight: 10 })

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0)
  if (totalWeight === 0) return null

  return Math.round(components.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight)
}

function classifyVolumeZone(effectiveSets: number, landmarks: VolumeLandmarks): VolumeZone {
  if (!Number.isFinite(effectiveSets)) return "insufficient_data"
  if (effectiveSets < landmarks.mevSets) return "below_mev"
  if (effectiveSets < landmarks.mavMinSets) return "mev_to_mav"
  if (effectiveSets <= landmarks.mavMaxSets) return "mav"
  if (effectiveSets <= landmarks.mrvSets) return "near_mrv"
  return "above_mrv"
}

function buildVolumeRecommendation(input: {
  effectiveSets: number
  landmarks: VolumeLandmarks
  performanceChangePct: number | null
  readinessScore: number | null
  recoveryCheckInCount: number
  soreness: number | null
  zone: VolumeZone
}): VolumeRecommendationResult {
  const { effectiveSets, performanceChangePct, readinessScore, recoveryCheckInCount, soreness, zone } = input
  const recovered = readinessScore != null && readinessScore >= 70
  const recoveryPoor = readinessScore != null && readinessScore < 50
  const performanceDown = performanceChangePct != null && performanceChangePct <= -2
  const performanceStableOrUp = performanceChangePct != null && performanceChangePct >= -1
  const hasEnoughRecovery = recoveryCheckInCount >= 2
  const reasons: RecommendationReason[] = []
  let action: RecommendationAction = "maintain"
  let recommendedSets = effectiveSets

  if (zone === "below_mev" && recovered) {
    action = "increase"
    recommendedSets = effectiveSets + 1
    reasons.push("below_mev", "recovery_good")
  } else if (zone === "above_mrv" && recoveryPoor && performanceDown && hasEnoughRecovery) {
    action = "deload"
    recommendedSets = Math.max(0, round(effectiveSets * 0.6))
    reasons.push("above_mrv", "recovery_and_performance_declining")
  } else if ((zone === "near_mrv" || zone === "above_mrv") && performanceDown && (recoveryPoor || (soreness ?? 0) >= 4)) {
    action = "decrease"
    recommendedSets = Math.max(0, round(effectiveSets * 0.85))
    reasons.push("performance_down", "recovery_signals_elevated")
  } else {
    reasons.push(
      zone === "mav" ? "inside_mav" : "insufficient_evidence",
      performanceStableOrUp ? "performance_stable_or_up" : "collect_more_performance",
    )
  }

  const confidence = clamp(
    input.landmarks.confidence + (performanceChangePct == null ? 0 : 0.2) + Math.min(recoveryCheckInCount, 3) * 0.1,
    0.2,
    0.95,
  )

  return {
    action,
    confidence: round(confidence, 2),
    currentSets: effectiveSets,
    reasons,
    recommendedSets,
  }
}

type TrainingGuidanceAction = "light_session" | "proceed" | "reduce_volume" | "rest"

type TrainingGuidanceReason =
  | "muscles_need_backoff"
  | "no_check_in"
  | "readiness_good"
  | "readiness_low"
  | "readiness_very_low"
  | "soreness_high"

type TrainingGuidance = {
  action: TrainingGuidanceAction
  focusMuscles: string[]
  reasons: TrainingGuidanceReason[]
  setAdjustmentPct: number
}

const READINESS_READY = 70
const READINESS_POOR = 50
const READINESS_REST = 35
const HIGH_SORENESS = 4

/**
 * Turns today's recovery signals into one instruction for the session ahead.
 *
 * It adjusts the plan the trainee already has rather than inventing a workout:
 * the thresholds are the same ones the per-muscle engine uses (ready at 70,
 * poor below 50), so a single readiness score cannot tell the trainee one thing
 * here and the opposite on the muscle rows. Without a check-in it says proceed
 * — an unmeasured day is not evidence of a bad one.
 */
function buildTrainingGuidance(input: {
  muscles: ReadonlyArray<{ muscleSlug: string; recommendation: { action: RecommendationAction } }>
  readinessScore: number | null
  soreness: number | null
}): TrainingGuidance {
  const backOffMuscles = input.muscles
    .filter((muscle) => muscle.recommendation.action === "deload" || muscle.recommendation.action === "decrease")
    .map((muscle) => muscle.muscleSlug)
  const sorenessHigh = (input.soreness ?? 0) >= HIGH_SORENESS

  if (input.readinessScore == null) {
    return { action: "proceed", focusMuscles: backOffMuscles, reasons: ["no_check_in"], setAdjustmentPct: 0 }
  }

  const reasons: TrainingGuidanceReason[] = []
  if (sorenessHigh) reasons.push("soreness_high")
  if (backOffMuscles.length > 0) reasons.push("muscles_need_backoff")

  if (input.readinessScore < READINESS_REST) {
    return { action: "rest", focusMuscles: backOffMuscles, reasons: ["readiness_very_low", ...reasons], setAdjustmentPct: -100 }
  }

  if (input.readinessScore < READINESS_POOR) {
    return { action: "light_session", focusMuscles: backOffMuscles, reasons: ["readiness_low", ...reasons], setAdjustmentPct: -30 }
  }

  if (input.readinessScore < READINESS_READY || backOffMuscles.length > 0 || sorenessHigh) {
    return {
      action: "reduce_volume",
      focusMuscles: backOffMuscles,
      reasons: reasons.length > 0 ? reasons : ["readiness_low"],
      setAdjustmentPct: -15,
    }
  }

  return { action: "proceed", focusMuscles: [], reasons: ["readiness_good"], setAdjustmentPct: 0 }
}

export {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
  buildTrainingGuidance,
  buildVolumeRecommendation,
  calculateReadiness,
  classifyVolumeZone,
  DEFAULT_VOLUME_LANDMARKS,
  readinessSoreness,
  VOLUME_RECOVERY_ALGORITHM_VERSION,
}
export type {
  MuscleVolume,
  ReadinessInput,
  RecommendationAction,
  RecommendationReason,
  TrainingGuidance,
  TrainingGuidanceAction,
  TrainingGuidanceReason,
  VolumeLandmarks,
  VolumeLogRecord,
  VolumeRecommendationResult,
  VolumeZone,
}
