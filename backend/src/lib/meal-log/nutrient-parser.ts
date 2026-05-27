import { FoodNutrientKey } from "@prisma/client"

type UsdaNestedNutrient = {
  name?: string | null
  number?: string | null
  unitName?: string | null
}

type UsdaFoodNutrientRecord = {
  amount?: number | null
  nutrient?: UsdaNestedNutrient | null
  nutrientName?: string | null
  nutrientNumber?: string | null
  unitName?: string | null
  value?: number | null
}

type ParsedFoodNutrient = {
  amountPer100g: number
  nutrientKey: FoodNutrientKey
  nutrientName: string
  unit: string
}

type ParsedFoodNutrients = {
  missingRequired: FoodNutrientKey[]
  normalizationIssue?: "unsupported_serving_size_unit"
  nutrients: ParsedFoodNutrient[]
}

const REQUIRED_MEAL_NUTRIENTS = [
  FoodNutrientKey.calories,
  FoodNutrientKey.protein,
  FoodNutrientKey.carbs,
  FoodNutrientKey.fat,
] as const

const NUTRIENT_KEY_BY_NUMBER: Partial<Record<string, FoodNutrientKey>> = {
  "203": FoodNutrientKey.protein,
  "204": FoodNutrientKey.fat,
  "205": FoodNutrientKey.carbs,
  "208": FoodNutrientKey.calories,
  "957": FoodNutrientKey.calories,
  "958": FoodNutrientKey.calories,
  "1008": FoodNutrientKey.calories,
  "269": FoodNutrientKey.sugar,
  "291": FoodNutrientKey.fiber,
  "307": FoodNutrientKey.sodium,
}

const NUTRIENT_KEY_BY_NAME: Partial<Record<string, FoodNutrientKey>> = {
  "carbohydrate by difference": FoodNutrientKey.carbs,
  "fiber total dietary": FoodNutrientKey.fiber,
  "protein": FoodNutrientKey.protein,
  "sodium na": FoodNutrientKey.sodium,
  "sugars total including nlea": FoodNutrientKey.sugar,
  "total lipid fat": FoodNutrientKey.fat,
  "total sugars": FoodNutrientKey.sugar,
}

function normalizeNutrientLabel(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeUnit(value?: string | null) {
  return (value ?? "").trim().toLowerCase()
}

function isGramUnit(value?: string | null) {
  const unit = normalizeUnit(value)
  return unit === "g" || unit === "gm" || unit === "gram" || unit === "grams"
}

function resolveCaloriesAlias(name: string, unit: string, nutrientNumber?: string | null) {
  const normalizedNumber = nutrientNumber?.trim()

  if (normalizedNumber === "208" || normalizedNumber === "957" || normalizedNumber === "958" || normalizedNumber === "1008") {
    return FoodNutrientKey.calories
  }

  const normalizedName = normalizeNutrientLabel(name)
  const normalizedUnit = normalizeUnit(unit)

  if (normalizedUnit === "kcal" && normalizedName.startsWith("energy")) {
    return FoodNutrientKey.calories
  }

  return undefined
}

function getPer100gMultiplier(dataType?: string | null, servingSize?: number | null, servingSizeUnit?: string | null) {
  if ((dataType ?? "").toLowerCase() === "branded") {
    if (!servingSize || servingSize <= 0 || !isGramUnit(servingSizeUnit)) {
      return null
    }

    return 100 / servingSize
  }

  return 1
}

function parseUsdaFoodNutrients(input: {
  dataType?: string | null
  foodNutrients?: UsdaFoodNutrientRecord[] | null
  servingSize?: number | null
  servingSizeUnit?: string | null
}): ParsedFoodNutrients {
  const multiplier = getPer100gMultiplier(input.dataType, input.servingSize, input.servingSizeUnit)

  if (!multiplier) {
    return {
      missingRequired: [...REQUIRED_MEAL_NUTRIENTS],
      normalizationIssue: "unsupported_serving_size_unit",
      nutrients: [],
    }
  }

  const nutrientByKey = new Map<FoodNutrientKey, ParsedFoodNutrient>()

  for (const nutrientRecord of input.foodNutrients ?? []) {
    const nutrientName = nutrientRecord.nutrient?.name ?? nutrientRecord.nutrientName ?? undefined
    const nutrientNumber = nutrientRecord.nutrient?.number ?? nutrientRecord.nutrientNumber ?? undefined
    const unit = nutrientRecord.nutrient?.unitName ?? nutrientRecord.unitName ?? undefined
    const rawAmount = nutrientRecord.amount ?? nutrientRecord.value

    if (!nutrientName || rawAmount == null || !Number.isFinite(Number(rawAmount))) {
      continue
    }

    const internalKey =
      NUTRIENT_KEY_BY_NUMBER[nutrientNumber?.trim() ?? ""] ??
      resolveCaloriesAlias(nutrientName, unit ?? "", nutrientNumber) ??
      NUTRIENT_KEY_BY_NAME[normalizeNutrientLabel(nutrientName)]

    if (!internalKey) {
      continue
    }

    nutrientByKey.set(internalKey, {
      amountPer100g: Number(rawAmount) * multiplier,
      nutrientKey: internalKey,
      nutrientName,
      unit: unit ?? "",
    })
  }

  const nutrients = Array.from(nutrientByKey.values())
  const missingRequired = REQUIRED_MEAL_NUTRIENTS.filter((nutrientKey) => !nutrientByKey.has(nutrientKey))

  return {
    missingRequired,
    nutrients,
  }
}

function hasRequiredMealNutrients(
  nutrients: Array<{
    nutrientKey: FoodNutrientKey
  }>,
) {
  const present = new Set(nutrients.map((nutrient) => nutrient.nutrientKey))
  return REQUIRED_MEAL_NUTRIENTS.every((nutrientKey) => present.has(nutrientKey))
}

export type { ParsedFoodNutrient, ParsedFoodNutrients, UsdaFoodNutrientRecord }
export { hasRequiredMealNutrients, parseUsdaFoodNutrients }
