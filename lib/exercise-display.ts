type ExerciseVariationLabelInput = {
  exerciseName?: string | null
  isDefault?: boolean | null
  variationName?: string | null
}

type ExerciseVariationMetaInput = ExerciseVariationLabelInput & {
  equipment?: string | null
  muscleGroup?: string | null
}

function getTrimmedValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : ""
}

function getVariationDisplayName(input: ExerciseVariationLabelInput) {
  const variationName = getTrimmedValue(input.variationName)

  if (!variationName) {
    return "Default"
  }

  return variationName
}

function formatExerciseVariationLabel(input: ExerciseVariationLabelInput) {
  const exerciseName = getTrimmedValue(input.exerciseName)
  const variationName = getVariationDisplayName(input)

  if (!exerciseName) {
    return variationName
  }

  return `${exerciseName} / ${variationName}`
}

function formatExerciseVariationMeta(input: ExerciseVariationMetaInput) {
  const parts = [`Variation: ${getVariationDisplayName(input)}`]
  const equipment = getTrimmedValue(input.equipment)
  const muscleGroup = getTrimmedValue(input.muscleGroup)

  if (equipment) {
    parts.push(equipment)
  }

  if (muscleGroup) {
    parts.push(muscleGroup)
  }

  return parts.join(" · ")
}

export { formatExerciseVariationLabel, formatExerciseVariationMeta }
