import type { OverloadAction, OverloadRecommendation } from "./progressive-overload"

/**
 * One answer to "what should I do today", from the three engines that each see
 * part of it: the day's readiness guidance, the per-muscle weekly volume, and
 * the per-exercise progression from last session.
 *
 * The day wins. On a light or rest day no exercise is pushed, whatever its own
 * history says, and the progression is reported as held for that reason, so
 * the three never tell the trainee contradictory things.
 */

type DayAction = "light_session" | "proceed" | "reduce_volume" | "rest"
type MuscleAction = "decrease" | "deload" | "increase" | "maintain"

type TrainingRecommendationInput = {
  guidance: { action: DayAction; focusMuscles: string[]; reasons: string[]; setAdjustmentPct: number }
  muscles: ReadonlyArray<{
    muscleSlug: string
    recommendation: { action: MuscleAction; currentSets: number; recommendedSets: number; status?: string }
  }>
  phase: string | null
  targetRir: number | null
  workout: {
    exercises: ReadonlyArray<{ name: string; progression?: OverloadRecommendation | null }>
    isCompleted: boolean
    name: string
  } | null
}

type ExerciseRecommendation = {
  action: OverloadAction
  /** True when the day's guidance held back what the exercise's history allowed. */
  heldByDay: boolean
  name: string
  reasons: string[]
  sets: OverloadRecommendation["sets"]
}

type TrainingRecommendation = {
  day: TrainingRecommendationInput["guidance"]
  intensity: { phase: string | null; targetRir: number | null }
  muscles: Array<{ action: MuscleAction; currentSets: number; muscleSlug: string; recommendedSets: number }>
  workout: { exercises: ExerciseRecommendation[]; isCompleted: boolean; name: string } | null
}

function holdForDay(dayAction: DayAction, progression: OverloadRecommendation): ExerciseRecommendation["action"] {
  if (dayAction !== "light_session" && dayAction !== "rest") return progression.action
  return progression.action === "add_load" || progression.action === "add_reps" ? "maintain" : progression.action
}

function buildTrainingRecommendation(input: TrainingRecommendationInput): TrainingRecommendation {
  const exercises = (input.workout?.exercises ?? []).flatMap((exercise): ExerciseRecommendation[] => {
    const progression = exercise.progression
    if (!progression) return []

    const action = holdForDay(input.guidance.action, progression)
    const heldByDay = action !== progression.action

    return [{
      action,
      heldByDay,
      name: exercise.name,
      reasons: heldByDay ? [...progression.reasons, "day_guidance"] : progression.reasons,
      // A held exercise repeats last session; the pushed targets no longer apply.
      sets: heldByDay ? [] : progression.sets,
    }]
  })

  return {
    day: input.guidance,
    intensity: { phase: input.phase, targetRir: input.targetRir },
    // Only muscles the engine wants changed, and not ones the trainee dismissed.
    muscles: input.muscles
      .filter((muscle) => muscle.recommendation.action !== "maintain" && muscle.recommendation.status !== "dismissed")
      .map((muscle) => ({
        action: muscle.recommendation.action,
        currentSets: muscle.recommendation.currentSets,
        muscleSlug: muscle.muscleSlug,
        recommendedSets: muscle.recommendation.recommendedSets,
      })),
    workout: input.workout ? { exercises, isCompleted: input.workout.isCompleted, name: input.workout.name } : null,
  }
}

export { buildTrainingRecommendation }
export type { ExerciseRecommendation, TrainingRecommendation, TrainingRecommendationInput }
