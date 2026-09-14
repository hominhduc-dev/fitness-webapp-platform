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

const VOLUME_RECOVERY_ALGORITHM_VERSION = "volume-recovery-v1"

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

function calculateReadiness(input: ReadinessInput) {
  const components: Array<{ score: number; weight: number }> = []
  const toFivePointScore = (value: number) => clamp(((value - 1) / 4) * 100, 0, 100)

  if (input.sleepQuality != null) components.push({ score: toFivePointScore(input.sleepQuality), weight: 0.3 })
  if (input.fatigue != null) components.push({ score: 100 - toFivePointScore(input.fatigue), weight: 0.4 })
  if (input.stress != null) components.push({ score: 100 - toFivePointScore(input.stress), weight: 0.1 })
  if (input.soreness != null) components.push({ score: 100 - clamp((input.soreness / 5) * 100, 0, 100), weight: 0.2 })

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

export {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
  buildVolumeRecommendation,
  calculateReadiness,
  classifyVolumeZone,
  DEFAULT_VOLUME_LANDMARKS,
  VOLUME_RECOVERY_ALGORITHM_VERSION,
}
export type {
  MuscleVolume,
  ReadinessInput,
  RecommendationReason,
  RecommendationAction,
  VolumeLandmarks,
  VolumeLogRecord,
  VolumeRecommendationResult,
  VolumeZone,
}
