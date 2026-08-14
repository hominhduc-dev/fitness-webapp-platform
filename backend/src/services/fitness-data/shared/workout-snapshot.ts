import type { Prisma } from "@prisma/client"

/**
 * Readers for the exercise snapshot stored on every `WorkoutLog`.
 *
 * The snapshot is a JSON copy of the workout as it was when the trainee performed
 * it, so history stays correct after a coach edits or deletes the program. Being
 * JSON, it is untyped at the database boundary and may have been written by an
 * older version of the app — every accessor here therefore returns `undefined`
 * rather than throwing on a shape it does not recognise.
 */

type WorkoutLogSnapshotSet = {
  actualReps?: number | null
  completed?: boolean
  rir?: number | null
  setNumber?: number | null
  targetRepsMin?: number | null
  targetReps?: number | null
  weight?: number | null
}

type WorkoutLogSnapshotExercise = {
  exercise?: {
    id?: string | null
    muscleGroup?: string | null
    name?: string | null
  } | null
  variation?: {
    id?: string | null
    isDefault?: boolean | null
    name?: string | null
  } | null
  sets?: WorkoutLogSnapshotSet[] | null
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parseWorkoutLogSnapshotExercises(snapshot: Prisma.JsonValue | null) {
  if (!Array.isArray(snapshot)) {
    return [] as WorkoutLogSnapshotExercise[]
  }

  return snapshot.filter((item): item is WorkoutLogSnapshotExercise => typeof item === "object" && item !== null)
}

function getSnapshotExerciseId(exercise: WorkoutLogSnapshotExercise) {
  const exerciseId = exercise.exercise?.id?.trim()
  return exerciseId || undefined
}

/**
 * The display name for analytics grouping: "Bench Press (Incline)", or just
 * "Bench Press" when the variation is the default one.
 */
function getSnapshotExerciseName(exercise: WorkoutLogSnapshotExercise) {
  const baseName = exercise.exercise?.name?.trim()

  if (!baseName) {
    return undefined
  }

  const variationName = exercise.variation?.name?.trim()
  const isDefaultVariation =
    exercise.variation?.isDefault === true || !variationName || variationName.toLowerCase() === "default"

  if (isDefaultVariation) {
    return baseName
  }

  return `${baseName} (${variationName})`
}

function getSnapshotVariationId(exercise: WorkoutLogSnapshotExercise) {
  const variationId = exercise.variation?.id?.trim()
  return variationId || undefined
}

function getSnapshotMuscleGroup(exercise: WorkoutLogSnapshotExercise) {
  const muscleGroup = exercise.exercise?.muscleGroup?.trim()
  return muscleGroup || undefined
}

/** Heaviest completed set, used for personal records and strength progression. */
function getSnapshotMaxWeight(exercise: WorkoutLogSnapshotExercise) {
  let maxWeight: number | undefined

  for (const set of exercise.sets ?? []) {
    // `completed === false` means the trainee skipped it; `undefined` predates the flag.
    if (set?.completed === false) {
      continue
    }

    const weight = toFiniteNumber(set?.weight)

    if (weight == null || weight <= 0) {
      continue
    }

    maxWeight = maxWeight == null ? weight : Math.max(maxWeight, weight)
  }

  return maxWeight
}

export {
  getSnapshotExerciseId,
  getSnapshotExerciseName,
  getSnapshotMaxWeight,
  getSnapshotMuscleGroup,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
  toFiniteNumber,
}
export type { WorkoutLogSnapshotExercise, WorkoutLogSnapshotSet }
