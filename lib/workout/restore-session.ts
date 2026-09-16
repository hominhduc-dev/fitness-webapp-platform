import type { Workout } from "@/lib/types"
import type { StoredWorkoutSession } from "./session-storage"

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isGeneratedHistorySetId(exerciseId: string, setId: string) {
  return setId.startsWith(`${exerciseId}-xtra-`)
}

export function restoreWorkoutSessionExercises(
  baseExercises: Workout["exercises"],
  storedExercises: StoredWorkoutSession["exercises"],
  canRestoreAddedSets: boolean,
  deletedSetIds: readonly string[] = [],
) {
  const deleted = new Set(deletedSetIds)
  const storedExercisesById = new Map(storedExercises.map((exercise) => [exercise.id, exercise]))
  return baseExercises.map((exercise) => {
    const storedExercise = storedExercisesById.get(exercise.id)
    if (!storedExercise) return exercise
    const storedSetsById = new Map(storedExercise.sets.map((set) => [set.id, set]))

    const restoredSets = exercise.sets.filter((set) => !deleted.has(set.id)).map((set) => {
      const storedSet = storedSetsById.get(set.id)
      if (!storedSet) return set
      return {
        ...set,
        actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
        completed: Boolean(storedSet.completed),
        notes: typeof storedSet.notes === "string" ? storedSet.notes : set.notes,
        rir: isFiniteNumber(storedSet.rir) ? storedSet.rir : undefined,
        weight: isFiniteNumber(storedSet.weight) ? storedSet.weight : undefined,
      }
    })

    // Re-append sets the user added during the session that aren't in the API response
    const baseSetIds = new Set(exercise.sets.map((s) => s.id))
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const sessionAddedSets: Workout["exercises"][number]["sets"] = storedExercise.sets
      .filter(
        (storedSet) =>
          !baseSetIds.has(storedSet.id) &&
          !deleted.has(storedSet.id) &&
          canRestoreAddedSets &&
          storedSet.addedDuringSession === true &&
          typeof storedSet.clientAddedToken === "string" &&
          storedSet.clientAddedToken.trim().length > 0 &&
          !isGeneratedHistorySetId(exercise.id, storedSet.id),
      )
      .map((storedSet, i) => ({
        id: storedSet.id,
        setNumber: exercise.sets.length + i + 1,
        targetReps: lastSet?.targetReps ?? 10,
        targetRepsMin: lastSet?.targetRepsMin,
        actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
        completed: Boolean(storedSet.completed),
        notes: typeof storedSet.notes === "string" ? storedSet.notes : undefined,
        rir: isFiniteNumber(storedSet.rir) ? storedSet.rir : undefined,
        weight: isFiniteNumber(storedSet.weight) ? storedSet.weight : undefined,
      }))

    return {
      ...exercise,
      sets: [...restoredSets, ...sessionAddedSets].map((set, index) => ({ ...set, setNumber: index + 1 })),
    }
  })
}
