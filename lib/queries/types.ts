import type { ExerciseActivityType, MuscleSlug } from "@/lib/types"

/**
 * Mirrors the option shapes accepted by `lib/fitness/api.ts`. They are declared
 * locally in that file rather than exported, and re-declaring them here keeps
 * the query layer a pure wrapper — it never edits the API module.
 */

/** Matches the inline parameter of `buildExerciseQuery`. */
export type ExerciseQueryOptions = {
  activityType?: ExerciseActivityType
  equipment?: string
  muscle?: MuscleSlug
  muscleGroup?: string
  search?: string
}

/** Matches `BodyMetricQueryOptions`. */
export type BodyMetricQueryOptions = {
  days?: number
  from?: string
  to?: string
}
