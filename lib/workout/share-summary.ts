import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { WorkoutShareSummary } from "@/lib/share/stats-card"
import type { Workout } from "@/lib/types"
import { isExerciseDone } from "@/lib/workout/exercise-order"

/**
 * What a finished session adds up to, for its share card.
 *
 * Only completed sets count, the same way the session header tallies volume,
 * so the card shows what the log recorded rather than what was planned.
 */
export function summarizeWorkoutSession(
  exercises: Workout["exercises"],
  { durationMins, workoutName }: { durationMins: number; workoutName: string },
): WorkoutShareSummary {
  let completedSets = 0
  let totalReps = 0
  let totalVolume = 0
  let topSet: WorkoutShareSummary["topSet"] = null

  for (const exercise of exercises) {
    const exerciseName = formatExerciseVariationLabel({
      displayName: exercise.variation.displayName,
      exerciseName: exercise.exercise.name,
      isDefault: exercise.variation.isDefault,
      variationName: exercise.variation.name,
    })

    for (const set of exercise.sets) {
      if (!set.completed) continue
      const reps = set.actualReps ?? set.targetReps
      const weight = set.weight ?? 0
      completedSets += 1
      totalReps += reps
      totalVolume += weight * reps
      if (weight > 0 && (!topSet || weight > topSet.weight || (weight === topSet.weight && reps > topSet.reps))) {
        topSet = { exerciseName, reps, weight }
      }
    }
  }

  return {
    completedExercises: exercises.filter(isExerciseDone).length,
    completedSets,
    durationMins,
    topSet,
    totalExercises: exercises.length,
    totalReps,
    totalSets: exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
    totalVolume,
    workoutName,
  }
}
