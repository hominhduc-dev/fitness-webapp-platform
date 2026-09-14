/**
 * Builds the label a trainee reads on a workout log row ("Machine Chest
 * Supported Upperback Row") out of the stored `Exercise.name` and
 * `Variation.name`.
 *
 * This is the mirror of `lib/exercise-display.ts` on the frontend: the backend
 * and the Next.js app compile under separate tsconfigs that exclude each other,
 * so the algorithm cannot live in a single importable module. Both copies are
 * pinned to the same behaviour by the shared case table in
 * `lib/exercise-display.cases.json`, which both test suites read — change one
 * copy and the other suite fails. Keep them in sync.
 */

type ExerciseDisplayNameInput = {
  exerciseName?: string | null
  isDefault?: boolean | null
  variationName?: string | null
}

const DEFAULT_VARIATION_NAME = "Default"
const PARENTHESIZED_SUFFIX_PATTERN = /^(.*?)\s*\(([^()]+)\)\s*$/
const DASH_MODIFIER_PATTERN = /^(.*?)\s+-\s+(.+)$/
const NON_ALPHANUMERIC_PATTERN = /[^\p{L}\p{N}]+/gu

function normalizeDisplayParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function toComparableTokens(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(NON_ALPHANUMERIC_PATTERN, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

function containsTokenSequence(segment: string[], sequence: string[]) {
  if (sequence.length === 0 || sequence.length > segment.length) {
    return false
  }

  for (let start = 0; start <= segment.length - sequence.length; start += 1) {
    let matches = true
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (segment[start + offset] !== sequence[offset]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }

  return false
}

function isCoveredBySegments(segments: string[][], value: string) {
  const tokens = toComparableTokens(value)
  if (tokens.length === 0) return false
  return segments.some((segment) => containsTokenSequence(segment, tokens))
}

/**
 * The exercise name usually already carries the words a variation repeats —
 * "Frontal" on top of "Frontal One-Arm Lat Pulldown". Anything the name (or an
 * earlier prefix) already says is dropped so the label stays readable mid-set
 * on a phone. Comparison is token based so "One-Arm" and "One Arm" match.
 */
function dropWordsAlreadyCovered(part: string, segments: string[][]) {
  const words = part.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  if (isCoveredBySegments(segments, part)) return ""

  return words.filter((word) => !isCoveredBySegments(segments, word)).join(" ")
}

/**
 * Joins the qualifier parts in front of the exercise name, dropping every part
 * — and every single word of a part — the name already contains.
 */
function buildLabelFromParts(prefixParts: string[], exerciseName: string) {
  const segments = [toComparableTokens(exerciseName)]
  const keptParts: string[] = []

  for (const part of prefixParts) {
    const kept = dropWordsAlreadyCovered(part, segments)
    if (!kept) continue
    keptParts.push(kept)
    segments.push(toComparableTokens(kept))
  }

  return normalizeDisplayParts([...keptParts, exerciseName])
}

function buildExerciseDisplayName(input: ExerciseDisplayNameInput) {
  const rawExerciseName = input.exerciseName?.trim() ?? ""
  const rawVariationName = input.variationName?.trim() || DEFAULT_VARIATION_NAME

  if (!rawExerciseName) return rawVariationName
  const exerciseParenthesisMatch = rawExerciseName.match(PARENTHESIZED_SUFFIX_PATTERN)
  const exerciseNameWithoutEquipment = exerciseParenthesisMatch?.[1]?.trim() || rawExerciseName
  const exerciseEquipment = exerciseParenthesisMatch?.[2]?.trim() || ""
  const exerciseDashMatch = exerciseNameWithoutEquipment.match(DASH_MODIFIER_PATTERN)
  const baseExerciseName = exerciseDashMatch?.[1]?.trim() || exerciseNameWithoutEquipment
  const exerciseModifier = exerciseDashMatch?.[2]?.trim() || ""

  if (input.isDefault || rawVariationName === DEFAULT_VARIATION_NAME) {
    return exerciseEquipment
      ? buildLabelFromParts([exerciseEquipment, exerciseModifier], baseExerciseName)
      : rawExerciseName
  }

  const variationParenthesisMatch = rawVariationName.match(PARENTHESIZED_SUFFIX_PATTERN)
  const variationModifier = variationParenthesisMatch?.[1]?.trim() || rawVariationName
  const equipment = variationParenthesisMatch?.[2]?.trim() || ""

  if (equipment) {
    return buildLabelFromParts([equipment, exerciseModifier, variationModifier], baseExerciseName)
  }

  return buildLabelFromParts([rawVariationName, exerciseModifier], baseExerciseName)
}

export { buildExerciseDisplayName, type ExerciseDisplayNameInput }
