import type { CoachExercise, ExerciseLibraryExercise, ExerciseVariationOption } from "@/lib/fitness/types"

function mapCoachExerciseToVariationOption(exercise: CoachExercise): ExerciseVariationOption | null {
  if (!exercise.variationId) {
    return null
  }

  const variationName = exercise.variationName?.trim() || "Default"
  const isDefaultVariation = variationName.toLowerCase() === "default"

  return {
    canManage: exercise.canManage,
    createdById: exercise.createdById,
    equipment: exercise.equipment,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    id: exercise.variationId,
    isDefault: isDefaultVariation,
    metadata: undefined,
    muscleGroup: exercise.muscleGroup,
    name: isDefaultVariation ? exercise.name : `${exercise.name} (${variationName})`,
    source: exercise.source,
    sortOrder: 0,
    variationName,
  }
}

function flattenExerciseLibraryToVariationOptions(
  exercises: ExerciseLibraryExercise[],
): ExerciseVariationOption[] {
  return exercises.flatMap((exercise) =>
    exercise.variations.map((variation) => ({
      canManage: variation.canManage ?? exercise.canManage,
      createdById: variation.createdById ?? exercise.createdById,
      equipment: variation.equipment,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      id: variation.id,
      isDefault: variation.isDefault,
      metadata: variation.metadata,
      muscleGroup: exercise.muscleGroup,
      name: variation.isDefault ? exercise.name : `${exercise.name} (${variation.name})`,
      source: variation.source ?? exercise.source,
      sortOrder: variation.sortOrder,
      variationName: variation.name,
    })),
  )
}

function mergeExerciseOptions(
  primaryOptions: ExerciseVariationOption[],
  fallbackOptions: ExerciseVariationOption[],
): ExerciseVariationOption[] {
  const optionsById = new Map<string, ExerciseVariationOption>()

  for (const option of [...primaryOptions, ...fallbackOptions]) {
    if (!optionsById.has(option.id)) {
      optionsById.set(option.id, option)
    }
  }

  return Array.from(optionsById.values()).sort((left, right) => {
    const exerciseNameComparison = left.exerciseName.localeCompare(right.exerciseName)

    if (exerciseNameComparison !== 0) {
      return exerciseNameComparison
    }

    const sortOrderComparison = left.sortOrder - right.sortOrder

    if (sortOrderComparison !== 0) {
      return sortOrderComparison
    }

    return left.variationName.localeCompare(right.variationName)
  })
}

export { flattenExerciseLibraryToVariationOptions, mapCoachExerciseToVariationOption, mergeExerciseOptions }
