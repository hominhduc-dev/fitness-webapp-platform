import type { SerializedProfile } from "./auth.service"
import { buildTrainingRecommendation } from "../domain/training-recommendation"
import { findTodayScheduleEntryForTrainee, getWorkoutDetailForTrainee } from "./fitness-data/core"
import { assertTrainee } from "./fitness-data/shared/guards"
import { getVolumeRecoveryForTrainee } from "./volume-recovery/volume-recovery.service"

/**
 * Today's recommendation for a trainee: readiness, weekly muscle volume and the
 * progression for each exercise in today's session, reconciled into one answer.
 * The volume analysis runs in the context of today's program, so phase and
 * target RIR come from it.
 */
async function getTrainingRecommendationForTrainee(profile: SerializedProfile) {
  assertTrainee(profile)

  const today = await findTodayScheduleEntryForTrainee(profile.id)
  const workout = today ? await getWorkoutDetailForTrainee(profile, today.workoutId) : null
  const recovery = await getVolumeRecoveryForTrainee(profile, undefined, workout?.programId ?? undefined)

  return buildTrainingRecommendation({
    guidance: recovery.guidance,
    muscles: recovery.muscles,
    phase: recovery.programContext?.phase ?? null,
    targetRir: recovery.programContext?.targetRir ?? null,
    workout: workout && today
      ? {
          exercises: workout.exercises.map((exercise) => ({
            name: exercise.variation.displayName ?? exercise.exercise.name,
            progression: exercise.progression ?? null,
          })),
          isCompleted: today.isCompleted,
          name: workout.name,
        }
      : null,
  })
}

export { getTrainingRecommendationForTrainee }
