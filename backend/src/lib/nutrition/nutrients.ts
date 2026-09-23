/**
 * Tracked non-macro nutrients. The `Nutrient` table is the catalog the app
 * reads names and units from; this list is what code needs at compile time —
 * the codes, and where each one comes from in USDA FoodData Central.
 *
 * Adding a nutrient: insert a `Nutrient` row (migration), add it here, rerun
 * the import script.
 */
const NUTRIENT_CODES = [
  "fiber",
  "sugar",
  "saturated_fat",
  "cholesterol",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "zinc",
  "vitamin_a",
  "vitamin_c",
  "vitamin_d",
  "vitamin_b12",
  "folate",
] as const

type NutrientCode = (typeof NUTRIENT_CODES)[number]

/** Per-food amounts or totals, keyed by nutrient code. Missing = no data. */
type NutrientAmounts = Partial<Record<NutrientCode, number>>

/**
 * FoodData Central nutrient ids. Units match the `Nutrient` catalog: vitamin A
 * is RAE and folate is DFE, the forms dietary targets are written in.
 */
const FDC_NUTRIENT_IDS: Record<NutrientCode, number> = {
  fiber: 1079,
  sugar: 2000,
  saturated_fat: 1258,
  cholesterol: 1253,
  sodium: 1093,
  potassium: 1092,
  calcium: 1087,
  iron: 1089,
  magnesium: 1090,
  zinc: 1095,
  vitamin_a: 1106,
  vitamin_c: 1162,
  vitamin_d: 1114,
  vitamin_b12: 1178,
  folate: 1190,
}

function isNutrientCode(value: string): value is NutrientCode {
  return (NUTRIENT_CODES as readonly string[]).includes(value)
}

/** Keeps only known codes with finite, non-negative amounts. */
function parseNutrientAmounts(value: unknown): NutrientAmounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const amounts: NutrientAmounts = {}
  for (const [code, amount] of Object.entries(value)) {
    if (isNutrientCode(code) && typeof amount === "number" && Number.isFinite(amount) && amount >= 0) {
      amounts[code] = amount
    }
  }
  return amounts
}

/** Rounds by magnitude: 0.0x µg of vitamin D matters, 0.x mg of sodium does not. */
function roundNutrientAmount(amount: number) {
  if (amount >= 100) return Math.round(amount)
  if (amount >= 1) return Math.round(amount * 10) / 10
  return Math.round(amount * 100) / 100
}

function scaleNutrients(amounts: NutrientAmounts, multiplier: number): NutrientAmounts {
  const scaled: NutrientAmounts = {}
  for (const code of NUTRIENT_CODES) {
    const amount = amounts[code]
    if (amount != null) scaled[code] = roundNutrientAmount(amount * multiplier)
  }
  return scaled
}

function addNutrients(target: NutrientAmounts, amounts: NutrientAmounts) {
  for (const code of NUTRIENT_CODES) {
    const amount = amounts[code]
    if (amount != null) target[code] = (target[code] ?? 0) + amount
  }
  return target
}

export {
  addNutrients,
  FDC_NUTRIENT_IDS,
  isNutrientCode,
  NUTRIENT_CODES,
  parseNutrientAmounts,
  roundNutrientAmount,
  scaleNutrients,
  type NutrientAmounts,
  type NutrientCode,
}
