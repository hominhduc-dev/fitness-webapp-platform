export function matchesExerciseSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase().replace(/-/g, " ")
  if (!normalizedQuery) return true
  const tokens = normalizedQuery.split(/\s+/)
  const searchableSpaced = fields.filter(Boolean).join(" ").toLowerCase().replace(/-/g, " ")
  const searchableCompact = searchableSpaced.replace(/\s+/g, "")
  return tokens.every((token) => searchableSpaced.includes(token) || searchableCompact.includes(token))
}

/**
 * Returns a relevance score for sorting search results.
 * Higher score = better match. 0 means no query (no sorting needed).
 *   3 — exact name match
 *   2 — name starts with query
 *   1 — token match only
 */
export function scoreExerciseSearch(name: string, query: string): number {
  const q = query.trim().toLowerCase().replace(/-/g, " ")
  if (!q) return 0
  const n = name.toLowerCase().replace(/-/g, " ")
  if (n === q) return 3
  if (n.startsWith(q)) return 2
  return 1
}

/**
 * Sorts items by relevance to the query. No-ops when query is empty.
 * Pass a getName fn to extract the exercise name from each item.
 */
export function sortByExerciseRelevance<T>(items: T[], query: string, getName: (item: T) => string): T[] {
  if (!query.trim()) return items
  return [...items].sort((a, b) => scoreExerciseSearch(getName(b), query) - scoreExerciseSearch(getName(a), query))
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
  if (!query.trim()) return groups
  return [...groups].sort((a, b) => {
    const bestScore = (g: T) => Math.max(...getItems(g).map((e) => scoreExerciseSearch(e.name, query)))
    const scoreDiff = bestScore(b) - bestScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return getGroupName(a).localeCompare(getGroupName(b))
  })
}
