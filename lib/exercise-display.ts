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

const DEFAULT_VARIATION_NAME = "Default"

function getVariationDisplayName(input: ExerciseVariationLabelInput) {
  const variationName = getTrimmedValue(input.variationName)

  if (!variationName) {
    return DEFAULT_VARIATION_NAME
  }

  return variationName
}

/**
 * A variation only earns a slot in the label when it actually distinguishes the
 * exercise. The placeholder "Default" carries no information and, on a phone,
 * eats the width the exercise name needs mid-set.
 */
function isDefaultVariation(input: ExerciseVariationLabelInput) {
  if (input.isDefault) {
    return true
  }

  return getVariationDisplayName(input) === DEFAULT_VARIATION_NAME
}

function formatExerciseVariationLabel(input: ExerciseVariationLabelInput) {
  const exerciseName = getTrimmedValue(input.exerciseName)
  const variationName = getVariationDisplayName(input)

  if (!exerciseName) {
    return variationName
  }

  if (isDefaultVariation(input)) {
    return exerciseName
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
