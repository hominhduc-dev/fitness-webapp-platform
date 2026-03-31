const VIETNAMESE_TO_ENGLISH_EXACT_MAP: Record<string, string> = {
  "ca hoi": "salmon",
  "chuoi": "banana",
  "com trang": "white rice",
  "thit bo": "beef",
  "trung luoc": "boiled egg",
  "uc ga": "chicken breast",
}

const BRAND_HINTS = [
  "coca cola",
  "cocacola",
  "heinz",
  "lays",
  "milo",
  "nestle",
  "oreo",
  "pepsi",
  "vinamilk",
  "yakult",
]

type QueryKind = "branded" | "generic"

type ResolvedFoodSearchQuery = {
  queryKind: QueryKind
  queryMapped?: string
  queryNormalized: string
  queryOriginal: string
  resolvedQuery: string
}

function normalizeFoodQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function inferQueryKind(query: string): QueryKind {
  return BRAND_HINTS.some((hint) => query.includes(hint)) ? "branded" : "generic"
}

function mapVietnameseFoodQuery(normalizedQuery: string) {
  if (!normalizedQuery) {
    return undefined
  }

  if (VIETNAMESE_TO_ENGLISH_EXACT_MAP[normalizedQuery]) {
    return VIETNAMESE_TO_ENGLISH_EXACT_MAP[normalizedQuery]
  }

  const partialMatch = Object.entries(VIETNAMESE_TO_ENGLISH_EXACT_MAP)
    .sort((left, right) => right[0].length - left[0].length)
    .find(([key]) => normalizedQuery.includes(key))

  if (!partialMatch) {
    return undefined
  }

  return normalizedQuery.replace(partialMatch[0], partialMatch[1]).trim()
}

function resolveFoodSearchQuery(query: string): ResolvedFoodSearchQuery {
  const queryOriginal = query.trim()
  const queryNormalized = normalizeFoodQuery(queryOriginal)
  const queryMapped = mapVietnameseFoodQuery(queryNormalized)

  return {
    queryKind: queryMapped ? "generic" : inferQueryKind(queryNormalized),
    queryMapped,
    queryNormalized,
    queryOriginal,
    resolvedQuery: queryMapped ?? queryOriginal,
  }
}

export type { QueryKind, ResolvedFoodSearchQuery }
export { normalizeFoodQuery, resolveFoodSearchQuery }
