import type { NutritionFood } from "@/lib/types"

export type FoodNameLanguage = "vi" | "en"

/** English name when asked for and known; foods without one keep their own name. */
export function foodDisplayName(food: Pick<NutritionFood, "name" | "nameEn">, language: FoodNameLanguage) {
  return language === "en" && food.nameEn ? food.nameEn : food.name
}

/**
 * Lowercased, accent-free text for search, so "banh mi" finds "Bánh mì" —
 * trainees on an English keyboard rarely type Vietnamese diacritics. Mirrors
 * `normalizeFoodSearch` on the backend.
 */
export function normalizeFoodSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Matches either language, whichever one the list is showing. */
export function foodMatchesSearch(food: Pick<NutritionFood, "name" | "nameEn">, query: string) {
  const needle = normalizeFoodSearch(query)
  if (!needle) return true
  return normalizeFoodSearch(food.name).includes(needle) || (food.nameEn != null && normalizeFoodSearch(food.nameEn).includes(needle))
}

// Vietnamese portion words used in the food library's serving labels.
const SERVING_WORDS_EN: Array<[string, string]> = [
  ["chén", "bowl"],
  ["tô", "large bowl"],
  ["dĩa|đĩa", "plate"],
  ["ổ", "loaf"],
  ["phần", "serving"],
  ["cuốn", "roll"],
  ["cái", "piece"],
  ["quả|trái", "piece"],
  ["bắp", "ear"],
  ["ly", "glass"],
  ["lon", "can"],
  ["gói", "pack"],
  ["muỗng", "scoop"],
  ["thìa", "tbsp"],
  ["hộp", "cup"],
]

/** "1 chén · 150g" → "1 bowl · 150g". Anything unrecognised is left as written. */
export function servingLabelFor(label: string, language: FoodNameLanguage) {
  if (language !== "en") return label
  // `\b` does not treat Vietnamese letters as word characters, so whole words
  // are bounded by "not a letter" explicitly.
  return SERVING_WORDS_EN.reduce(
    (text, [words, replacement]) => text.replace(new RegExp(String.raw`(^|[^\p{L}])(${words})(?=$|[^\p{L}])`, "giu"), `$1${replacement}`),
    label,
  )
}
