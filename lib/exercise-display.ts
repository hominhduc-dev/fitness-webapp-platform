type ExerciseVariationLabelInput = {
  displayName?: string | null
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
const PARENTHESIZED_SUFFIX_PATTERN = /^(.*?)\s*\(([^()]+)\)\s*$/
const DASH_MODIFIER_PATTERN = /^(.*?)\s+-\s+(.+)$/

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

function normalizeDisplayParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeTextForComparison(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}

function buildExerciseDisplayName(input: ExerciseVariationLabelInput) {
  const explicitDisplayName = getTrimmedValue(input.displayName)
  if (explicitDisplayName) return explicitDisplayName

  const rawExerciseName = getTrimmedValue(input.exerciseName)
  const rawVariationName = getVariationDisplayName(input)

  if (!rawExerciseName) return rawVariationName
  const exerciseParenthesisMatch = rawExerciseName.match(PARENTHESIZED_SUFFIX_PATTERN)
  const exerciseNameWithoutEquipment = exerciseParenthesisMatch?.[1]?.trim() || rawExerciseName
  const exerciseEquipment = exerciseParenthesisMatch?.[2]?.trim() || ""
  const exerciseDashMatch = exerciseNameWithoutEquipment.match(DASH_MODIFIER_PATTERN)
  const baseExerciseName = exerciseDashMatch?.[1]?.trim() || exerciseNameWithoutEquipment
  const exerciseModifier = exerciseDashMatch?.[2]?.trim() || ""

  if (isDefaultVariation(input)) {
    return exerciseEquipment
      ? normalizeDisplayParts([exerciseEquipment, exerciseModifier, baseExerciseName])
      : rawExerciseName
  }

  const variationParenthesisMatch = rawVariationName.match(PARENTHESIZED_SUFFIX_PATTERN)
  const variationModifier = variationParenthesisMatch?.[1]?.trim() || rawVariationName
  const equipment = variationParenthesisMatch?.[2]?.trim() || ""

  if (equipment) {
    const modifier = normalizeDisplayParts(
      normalizeTextForComparison(exerciseModifier) === normalizeTextForComparison(variationModifier)
        ? [exerciseModifier]
        : [exerciseModifier, variationModifier],
    )
    return normalizeDisplayParts([equipment, modifier, baseExerciseName])
  }

  return normalizeDisplayParts([rawVariationName, exerciseModifier, baseExerciseName])
}

function formatExerciseVariationLabel(input: ExerciseVariationLabelInput) {
  return buildExerciseDisplayName(input)
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

export { buildExerciseDisplayName, formatExerciseVariationLabel, formatExerciseVariationMeta }
