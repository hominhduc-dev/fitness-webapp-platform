/**
 * Name matching for duplicate detection. "DB Incline Press", "incline
 * dumbbell presses" and "Incline-Dumbbell Press" all describe one exercise, so
 * they normalise to the same key. Word order is ignored on purpose.
 *
 * Mirrored in lib/fitness/exercise-name.ts for the form's live warning; keep
 * the two in step (both have the same tests).
 */

/** Gym shorthand, shared with the library search box. */
const EXERCISE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  alt: "alternating",
  bb: "barbell",
  db: "dumbbell",
  dbs: "dumbbell",
  kb: "kettlebell",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sa: "single arm",
  sl: "single leg",
}

/** Words that change nothing about which exercise it is. */
const FILLER = new Set(["a", "an", "and", "the", "with", "on", "of", "exercise"])

function singular(word: string) {
  if (word.length <= 3 || word.endsWith("ss")) return word
  if (/(ss|sh|ch|x)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith("s")) return word.slice(0, -1)
  return word
}

/**
 * Typo distance: insert, delete, substitute, and swapping two neighbouring
 * letters ("becnh" → "bench") each count as one. Gives up once past `max`,
 * since callers only ever ask "within one or two typos?".
 */
function editDistance(left: string, right: string, max = Number.POSITIVE_INFINITY) {
  if (Math.abs(left.length - right.length) > max) return max + 1
  let beforePrevious: number[] = []
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1)
      }
      rowMin = Math.min(rowMin, current[j])
    }
    if (rowMin > max) return max + 1
    beforePrevious = previous
    previous = current
  }
  return previous[right.length]
}

function exerciseNameWords(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    // "1-arm", "one arm" and "single-arm" are the same thing.
    .replace(/\b(1|one)[\s-]*(arm|leg)\b/g, "single $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .flatMap((word) => (EXERCISE_ABBREVIATIONS[word] ?? word).split(" "))
    .filter((word) => word && !FILLER.has(word))
    .map(singular)

  return [...new Set(words)].sort()
}

function normalizeExerciseName(name: string) {
  return exerciseNameWords(name).join(" ")
}

/** Real words one letter apart that name opposite movements, never a typo of each other. */
const CONTRASTING_WORDS = [
  ["abduction", "adduction"],
  ["abductor", "adductor"],
]

function contrasting(left: string, right: string) {
  return CONTRASTING_WORDS.some(([one, other]) => (left === one && right === other) || (left === other && right === one))
}

/**
 * Same words, except one word of five letters or more may carry one typo
 * ("Becnh Press"). Stricter than the search box on purpose: "Incline" and
 * "Decline" are two typos apart and two different exercises.
 */
function isTypoOf(leftWords: readonly string[], rightWords: readonly string[]) {
  if (leftWords.length !== rightWords.length) return false
  const unmatched = [...rightWords]
  let typos = 0
  for (const word of leftWords) {
    const exact = unmatched.indexOf(word)
    if (exact !== -1) {
      unmatched.splice(exact, 1)
      continue
    }
    const close = word.length >= 5 ? unmatched.findIndex((other) => other.length >= 5 && !contrasting(word, other) && editDistance(word, other, 1) <= 1) : -1
    if (close === -1 || (typos += 1) > 1) return false
    unmatched.splice(close, 1)
  }
  return true
}

/** First exercise whose name means the same as `name`, allowing one typo; an exact match wins. */
function findDuplicateExercise<T extends { name: string }>(name: string, candidates: readonly T[]): T | undefined {
  const words = exerciseNameWords(name)
  if (words.length === 0) return undefined
  const key = words.join(" ")
  const keyed = candidates.map((candidate) => ({ candidate, words: exerciseNameWords(candidate.name) }))
  return (
    keyed.find((entry) => entry.words.join(" ") === key)?.candidate ??
    keyed.find((entry) => isTypoOf(words, entry.words))?.candidate
  )
}

export { editDistance, EXERCISE_ABBREVIATIONS, findDuplicateExercise, normalizeExerciseName }
