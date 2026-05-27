import { FoodNutrientKey } from "@prisma/client"

type NutrientAmountMap = Partial<Record<FoodNutrientKey, number>>

type CalculatedMealNutrition = {
  calories: number
  carbs?: number
  fat?: number
  fiber?: number
  protein?: number
  sodium?: number
  sugar?: number
}

function roundTo(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function calculateMealNutrition(nutrientsPer100g: NutrientAmountMap, weightGrams: number): CalculatedMealNutrition {
  const ratio = weightGrams / 100

  const valueFor = (key: FoodNutrientKey) => {
    const baseValue = nutrientsPer100g[key]

    if (baseValue == null) {
      return undefined
    }

    const calculated = baseValue * ratio

    if (key === FoodNutrientKey.sodium) {
      return roundTo(calculated, 0)
    }

    if (key === FoodNutrientKey.calories) {
      return roundTo(calculated, 1)
    }

    return roundTo(calculated, 1)
  }

  return {
    calories: valueFor(FoodNutrientKey.calories) ?? 0,
    carbs: valueFor(FoodNutrientKey.carbs),
    fat: valueFor(FoodNutrientKey.fat),
    fiber: valueFor(FoodNutrientKey.fiber),
    protein: valueFor(FoodNutrientKey.protein),
    sodium: valueFor(FoodNutrientKey.sodium),
    sugar: valueFor(FoodNutrientKey.sugar),
  }
}

export type { CalculatedMealNutrition, NutrientAmountMap }
export { calculateMealNutrition }
