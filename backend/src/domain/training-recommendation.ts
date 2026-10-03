import { lowerLoad } from "./load-increment"
import type { OverloadAction, OverloadRecommendation, OverloadSetSuggestion } from "./progressive-overload"

/**
 * One answer to "what should I do today", from three engines that each see part
 * of it: the day's readiness guidance, the per-muscle weekly volume, and the
 * per-exercise progression from last session.
 *
 * They are reconciled in that order — day, then muscle, then exercise — so the
 * narrower engine never contradicts the broader one:
 *
 * - A light or rest day pushes no exercise.
 * - A muscle the volume engine wants to deload takes weight off and sheds sets
 *   on every exercise that trains it as a primary mover.
 * - A muscle it wants decreased holds the load (no add_load / add_reps) and
 *   drops a set.
 * - A muscle it wants increased gains its extra set on the first exercise of
 *   the session that trains it, and only on a day that is not held back.
 *
 * The engine's own action is kept beside the final one, with the reasons, so
 * the trainee sees why a progression was held.
 */

type DayAction = "light_session" | "proceed" | "reduce_volume" | "rest"
type MuscleAction = "decrease" | "deload" | "increase" | "maintain"
type HeldBy = "day" | "muscle"

type ReconciledProgression = {
  action: OverloadAction
  /** What the exercise's own history called for, before day and muscle. */
  engineAction: OverloadAction
  /** Set when the day or a muscle overrode the engine's push. */
  heldBy: HeldBy | null
  /** The primary muscle whose weekly volume shaped this exercise, if any did. */
  muscleAction: MuscleAction | null
  muscleSlug: string | null
  reasons: string[]
  /** Sets to add (positive) or drop (negative) against what is programmed. */
  setDelta: number
  sets: OverloadSetSuggestion[]
}

type ReconcileExerciseInput = {
  dayAction: DayAction
  /** True for the first exercise in the session that trains an increased muscle. */
  ownsMuscleIncrease: boolean
  loadIncrementKg: number | null
  /** Non-dismissed weekly actions per muscle, from the volume engine. */
  muscleActions: ReadonlyMap<string, MuscleAction>
  primaryMuscles: readonly string[]
  progression: OverloadRecommendation
  /** Working sets programmed for this exercise today. */
  workingSets: number
}

const MUSCLE_PRIORITY: Record<MuscleAction, number> = { deload: 3, decrease: 2, increase: 1, maintain: 0 }
/** The volume engine's deload keeps 60% of the sets; the load drops ~10%. */
const DELOAD_SET_SHARE = 0.4
const DELOAD_LOAD_FACTOR = 0.9

const isPush = (action: OverloadAction) => action === "add_load" || action === "add_reps"

/** Last session's numbers, which is what "hold" means for a set. */
function repeatLastSession(sets: readonly OverloadSetSuggestion[]) {
  return sets.map((set) => ({ ...set, reps: set.previousReps, weight: set.previousWeight }))
}

/** The strongest signal among the exercise's primary muscles: a deload beats a decrease beats an increase. */
function decidingMuscle(primaryMuscles: readonly string[], muscleActions: ReadonlyMap<string, MuscleAction>) {
  let decided: { action: MuscleAction; muscleSlug: string } | null = null
  for (const muscleSlug of primaryMuscles) {
    const action = muscleActions.get(muscleSlug)
    if (!action || action === "maintain") continue
    if (!decided || MUSCLE_PRIORITY[action] > MUSCLE_PRIORITY[decided.action]) decided = { action, muscleSlug }
  }
  return decided
}

function reconcileExerciseProgression(input: ReconcileExerciseInput): ReconciledProgression {
  const { progression } = input
  const muscle = decidingMuscle(input.primaryMuscles, input.muscleActions)
  const dayHeld = input.dayAction === "light_session" || input.dayAction === "rest"

  const result: ReconciledProgression = {
    action: progression.action,
    engineAction: progression.action,
    heldBy: null,
    muscleAction: muscle?.action ?? null,
    muscleSlug: muscle?.muscleSlug ?? null,
    reasons: [...progression.reasons],
    setDelta: 0,
    sets: progression.sets,
  }

  // 1. The day.
  if (dayHeld && isPush(result.action)) {
    result.action = "maintain"
    result.heldBy = "day"
    result.reasons.push("day_guidance")
    result.sets = repeatLastSession(progression.sets)
  }

  // 2. The muscle.
  if (muscle?.action === "deload") {
    if (result.action !== "reduce_load" && result.action !== "establish_baseline") {
      result.action = "reduce_load"
      result.sets = progression.sets.map((set) => ({
        ...set,
        reps: set.previousReps,
        weight: set.previousWeight == null || input.loadIncrementKg == null
          ? set.previousWeight
          : lowerLoad(set.previousWeight, input.loadIncrementKg, DELOAD_LOAD_FACTOR),
      }))
    }
    result.heldBy ??= "muscle"
    result.reasons.push("muscle_deload")
    result.setDelta = -Math.max(1, Math.round(input.workingSets * DELOAD_SET_SHARE))
  } else if (muscle?.action === "decrease") {
    if (isPush(result.action)) {
      result.action = "maintain"
      result.heldBy ??= "muscle"
      result.sets = repeatLastSession(progression.sets)
    }
    result.reasons.push("muscle_decrease")
    result.setDelta = input.workingSets > 1 ? -1 : 0
  } else if (muscle?.action === "increase" && input.ownsMuscleIncrease && !dayHeld) {
    result.reasons.push("muscle_increase")
    result.setDelta = 1
  }

  // A set is never dropped below one.
  result.setDelta = Math.max(result.setDelta, 1 - input.workingSets)
  return result
}

type WorkoutExerciseInput = {
  name: string
  primaryMuscles: readonly string[]
  loadIncrementKg: number | null
  progression: OverloadRecommendation | null | undefined
  workingSets: number
}

type MuscleRecommendationInput = {
  muscleSlug: string
  recommendation: { action: MuscleAction; currentSets: number; recommendedSets: number; status?: string }
}

/** The weekly actions a session should honour: dismissed answers are the trainee's call. */
function activeMuscleActions(muscles: readonly MuscleRecommendationInput[]) {
  return new Map(
    muscles
      .filter((muscle) => muscle.recommendation.status !== "dismissed")
      .map((muscle) => [muscle.muscleSlug, muscle.recommendation.action] as const),
  )
}

/** Reconciles every exercise of a session, handing each increased muscle's extra set to one exercise. */
function reconcileWorkoutProgressions(input: {
  dayAction: DayAction
  exercises: readonly WorkoutExerciseInput[]
  muscles: readonly MuscleRecommendationInput[]
}) {
  const muscleActions = activeMuscleActions(input.muscles)
  const increaseClaimed = new Set<string>()

  return input.exercises.map((exercise) => {
    if (!exercise.progression) return null
    const muscle = decidingMuscle(exercise.primaryMuscles, muscleActions)
    const ownsMuscleIncrease = muscle?.action === "increase" && !increaseClaimed.has(muscle.muscleSlug)
    if (ownsMuscleIncrease) increaseClaimed.add(muscle.muscleSlug)

    return reconcileExerciseProgression({
      dayAction: input.dayAction,
      loadIncrementKg: exercise.loadIncrementKg,
      muscleActions,
      ownsMuscleIncrease,
      primaryMuscles: exercise.primaryMuscles,
      progression: exercise.progression,
      workingSets: exercise.workingSets,
    })
  })
}

type TrainingRecommendationInput = {
  guidance: { action: DayAction; focusMuscles: string[]; reasons: string[]; setAdjustmentPct: number }
  muscles: readonly MuscleRecommendationInput[]
  phase: string | null
  targetRir: number | null
  workout: {
    /** Progressions already reconciled with the day and the muscles. */
    exercises: ReadonlyArray<{ name: string; progression?: ReconciledProgression | null; workoutExerciseId?: string | null }>
    id: string
    isCompleted: boolean
    name: string
  } | null
}

/** `workoutExerciseId` lets a client attach the recommendation to the exercise it already shows. */
type ExerciseRecommendation = ReconciledProgression & { name: string; workoutExerciseId: string | null }

type TrainingRecommendation = {
  day: TrainingRecommendationInput["guidance"]
  intensity: { phase: string | null; targetRir: number | null }
  muscles: Array<{ action: MuscleAction; currentSets: number; muscleSlug: string; recommendedSets: number }>
  workout: { exercises: ExerciseRecommendation[]; id: string; isCompleted: boolean; name: string } | null
}

function buildTrainingRecommendation(input: TrainingRecommendationInput): TrainingRecommendation {
  const exercises = (input.workout?.exercises ?? []).flatMap((exercise): ExerciseRecommendation[] =>
    exercise.progression
      ? [{ ...exercise.progression, name: exercise.name, workoutExerciseId: exercise.workoutExerciseId ?? null }]
      : [],
  )

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
    workout: input.workout
      ? { exercises, id: input.workout.id, isCompleted: input.workout.isCompleted, name: input.workout.name }
      : null,
  }
}

export { buildTrainingRecommendation, reconcileExerciseProgression, reconcileWorkoutProgressions }
export type {
  DayAction,
  ExerciseRecommendation,
  MuscleAction,
  ReconciledProgression,
  TrainingRecommendation,
  TrainingRecommendationInput,
}
