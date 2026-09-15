/**
 * Chooses which foods the meal-plan model is allowed to see.
 *
 * Allergies and diet are enforced here, before the prompt, rather than asked of
 * the model: a food that is not in the catalog cannot be picked, and the
 * generator rejects any id outside it. Name matching is keyword based, so it is
 * a safety net on top of the trainee's own judgement, not a medical guarantee.
 */

type CatalogFood = {
  id: string
  name: string
  category: string
  source?: string | null
  priceTier?: string | null
  prepMinutes?: number | null
}

type FoodFilters = {
  allergies?: readonly string[]
  dietType?: string | null
  budget?: string
  cookingTime?: string
  recentFoodIds?: ReadonlySet<string>
}

const QUICK_PREP_MINUTES = 20
const DEFAULT_PROMPT_FOOD_LIMIT = 150

const MEAT_TERMS = [
  "thịt", "bò", "gà", "heo", "lợn", "vịt", "ngan", "ngỗng", "dê", "cừu", "sườn", "ba chỉ", "xúc xích",
  "giăm bông", "lạp xưởng", "pate", "chả lụa", "giò lụa", "nem nướng", "nem chua", "bacon", "ham",
  "beef", "chicken", "pork", "duck", "lamb", "sausage",
]
const SEAFOOD_TERMS = [
  "cá", "tôm", "mực", "cua", "ghẹ", "nghêu", "ngao", "sò", "hàu", "ốc", "hến", "hải sản", "bạch tuộc", "lươn",
  "fish", "salmon", "tuna", "shrimp", "prawn", "squid", "crab", "seafood",
]
const PLANT_BASED_TERMS = ["chay", "vegan", "vegetarian"]

function stripMarks(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d")
}

function words(value: string) {
  return value.toLocaleLowerCase("vi").normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

/**
 * Whole-word phrase match. A term typed with diacritics matches exactly ("cá"
 * must not catch "cà tím"); a term typed without them ("tom") matches either.
 */
function containsTerm(name: string, term: string) {
  const termWords = words(term)
  if (termWords.length === 0) return false
  const accentless = termWords.every((word) => stripMarks(word) === word)
  const nameWords = accentless ? words(stripMarks(name.toLocaleLowerCase("vi"))) : words(name)
  for (let start = 0; start + termWords.length <= nameWords.length; start++) {
    if (termWords.every((word, offset) => nameWords[start + offset] === word)) return true
  }
  return false
}

function matchesAny(name: string, terms: readonly string[]) {
  return terms.some((term) => containsTerm(name, term))
}

function isFoodAllowed(food: CatalogFood, filters: FoodFilters) {
  if (filters.allergies?.some((allergy) => containsTerm(food.name, allergy))) return false

  if (filters.dietType === "vegetarian" || filters.dietType === "pescatarian") {
    const plantBased = matchesAny(food.name, PLANT_BASED_TERMS)
    if (!plantBased && matchesAny(food.name, MEAT_TERMS)) return false
    if (!plantBased && filters.dietType === "vegetarian" && matchesAny(food.name, SEAFOOD_TERMS)) return false
  }

  if (filters.budget === "low" && food.priceTier === "high") return false
  if (filters.cookingTime === "quick" && food.prepMinutes != null && food.prepMinutes > QUICK_PREP_MINUTES) return false

  return true
}

/**
 * Filters, then takes foods round-robin across categories so a capped prompt
 * still offers staples, proteins and vegetables. Within a category, foods the
 * trainee did not eat this week come first, then their own foods.
 */
function selectFoodsForPrompt<T extends CatalogFood>(foods: readonly T[], filters: FoodFilters, limit = DEFAULT_PROMPT_FOOD_LIMIT): T[] {
  const recent = filters.recentFoodIds ?? new Set<string>()
  const groups = new Map<string, T[]>()
  for (const food of foods) {
    if (!isFoodAllowed(food, filters)) continue
    const group = groups.get(food.category) ?? []
    group.push(food)
    groups.set(food.category, group)
  }

  const queues = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => group.sort((left, right) =>
      Number(recent.has(left.id)) - Number(recent.has(right.id))
      || Number(left.source !== "user") - Number(right.source !== "user")
      || left.name.localeCompare(right.name, "vi"),
    ))

  const selected: T[] = []
  while (selected.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const food = queue.shift()
      if (food) selected.push(food)
      if (selected.length >= limit) break
    }
  }
  return selected
}

export { containsTerm, isFoodAllowed, selectFoodsForPrompt }
export type { CatalogFood, FoodFilters }
