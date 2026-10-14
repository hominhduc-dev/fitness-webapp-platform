import { editDistance, EXERCISE_ABBREVIATIONS } from "@/lib/fitness/exercise-name"

export type ExerciseSearchDocument = {
  compact: string
  text: string
  /** Distinct words, for the typo-tolerant fallback. */
  words: string[]
}

export type CompiledExerciseSearch = {
  compact: string
  normalized: string
  tokens: string[]
}

/**
 * Normalizes user-facing exercise text once so every picker behaves the same.
 * Besides case and punctuation, Vietnamese diacritics are ignored: searching
 * `dui` still finds `đùi`, which is especially useful on mobile keyboards.
 */
export function normalizeExerciseSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function compileExerciseSearch(query: string): CompiledExerciseSearch {
  const normalized = normalizeExerciseSearchText(query)

  return {
    compact: normalized.replace(/\s+/g, ""),
    normalized,
    // Gym shorthand reads as the words it stands for: "db press" finds Dumbbell Press.
    tokens: normalized ? normalized.split(" ").flatMap((token) => (EXERCISE_ABBREVIATIONS[token] ?? token).split(" ")) : [],
  }
}

/** Build once when the exercise collection changes, not once per keystroke. */
export function createExerciseSearchDocument(fields: Array<string | null | undefined>): ExerciseSearchDocument {
  const text = normalizeExerciseSearchText(fields.filter(Boolean).join(" "))
  return { compact: text.replace(/\s+/g, ""), text, words: [...new Set(text.split(" ").filter(Boolean))] }
}

/** Typos a search word may carry in fuzzy mode: none for short words, where one letter changes the word. */
function typoAllowance(token: string) {
  if (token.length < 4) return 0
  return token.length >= 7 ? 2 : 1
}

/** A word, or the start of one still being typed, within the token's typo allowance. */
function matchesWithTypos(token: string, words: readonly string[]) {
  const allowance = typoAllowance(token)
  if (allowance === 0) return false
  return words.some(
    (word) =>
      editDistance(token, word, allowance) <= allowance ||
      (word.length > token.length && editDistance(token, word.slice(0, token.length), allowance) <= allowance),
  )
}

/**
 * Every search word must appear in the document. With `fuzzy`, a word may
 * also match with a typo or two ("becnh" finds Bench) — only use it as the
 * fallback in {@link filterExerciseSearch}, since "incline" is two typos from
 * "decline".
 */
export function matchesExerciseSearchDocument(
  document: ExerciseSearchDocument,
  search: CompiledExerciseSearch,
  options: { fuzzy?: boolean } = {},
): boolean {
  if (search.tokens.length === 0) return true

  return search.tokens.every(
    (token) =>
      document.text.includes(token) ||
      document.compact.includes(token) ||
      (options.fuzzy === true && matchesWithTypos(token, document.words)),
  )
}

/**
 * Filters with exact matching and, only when that finds nothing, again with
 * typos allowed. `fuzzy` says the second pass produced the results, so the UI
 * can call them close matches.
 */
export function filterExerciseSearch<T>(
  items: readonly T[],
  search: CompiledExerciseSearch,
  matches: (item: T, fuzzy: boolean) => boolean,
): { items: T[]; fuzzy: boolean } {
  const exact = items.filter((item) => matches(item, false))
  if (exact.length > 0 || search.tokens.length === 0) return { fuzzy: false, items: exact }
  return { fuzzy: true, items: items.filter((item) => matches(item, true)) }
}

/** Backwards-compatible convenience API for small, one-off collections. */
export function matchesExerciseSearch(fields: Array<string | null | undefined>, query: string): boolean {
  return matchesExerciseSearchDocument(createExerciseSearchDocument(fields), compileExerciseSearch(query))
}

function scoreNormalizedExerciseName(name: string, search: CompiledExerciseSearch): number {
  if (!search.normalized) return 0

  const normalizedName = normalizeExerciseSearchText(name)

  if (normalizedName === search.normalized) return 100
  if (normalizedName.startsWith(search.normalized)) return 80
  if (normalizedName.split(" ").some((word) => word.startsWith(search.normalized))) return 60
  if (normalizedName.includes(search.normalized)) return 40

  return search.tokens.reduce((score, token) => {
    if (normalizedName.split(" ").some((word) => word.startsWith(token))) return score + 4
    if (normalizedName.includes(token)) return score + 2
    return score
  }, 1)
}

/**
 * Returns a relevance score for sorting search results.
 * Higher score = better match. 0 means no query (no sorting needed).
 *   3 — exact name match
 *   2 — name starts with query
 *   1 — token match only
 */
export function scoreExerciseSearch(name: string, query: string): number {
  return scoreNormalizedExerciseName(name, compileExerciseSearch(query))
}

/**
 * Sorts items by relevance to the query. No-ops when query is empty.
 * Pass a getName fn to extract the exercise name from each item.
 */
export function sortByExerciseRelevance<T>(items: T[], query: string, getName: (item: T) => string): T[] {
  const search = compileExerciseSearch(query)
  if (!search.normalized) return items

  return items
    .map((item, index) => ({ index, item, score: scoreNormalizedExerciseName(getName(item), search) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item)
}

/**
 * Sorts groups by the best relevance score of exercises within.
 * Falls back to localeCompare when scores are equal.
 */
export function sortGroupsByExerciseRelevance<T>(
  groups: T[],
  query: string,
  getGroupName: (group: T) => string,
  getItems: (group: T) => Array<{ name: string }>,
): T[] {
  const search = compileExerciseSearch(query)
  if (!search.normalized) return groups

  const bestScore = (group: T) =>
    getItems(group).reduce(
      (best, exercise) => Math.max(best, scoreNormalizedExerciseName(exercise.name, search)),
      0,
    )

  return [...groups].sort((a, b) => {
    const scoreDiff = bestScore(b) - bestScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return getGroupName(a).localeCompare(getGroupName(b))
  })
}
