import type { MealType } from "@/lib/types"

/** Shared by the AI meal-plan generator, the chat draft card and planned-meal editors. */

export const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"]

export const AI_MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Bữa phụ",
}

type Macros = { calories: number; protein: number; carbs: number; fat: number }

/** Same increments the backend portion solver snaps to. */
export function mealAmountStep(unit: string) {
  return unit === "g" || unit === "ml" ? 5 : 0.25
}

export function stepMealAmount(amount: number, unit: string, direction: 1 | -1) {
  const step = mealAmountStep(unit)
  return Math.max(step, Math.round((amount + direction * step) / step) * step)
}

export function formatMealAmount(amount: number, unit: string) {
  return unit === "g" || unit === "ml" ? `${Math.round(amount)} ${unit}` : `${Number(amount.toFixed(2))} phần`
}

/** Catalog nutrition is linear in the amount, so an edited portion scales its original values. */
export function scaleMacros<T extends Macros>(item: T & { amountValue: number }, amount: number): Macros {
  const factor = item.amountValue > 0 ? amount / item.amountValue : 0
  return {
    calories: item.calories * factor,
    protein: item.protein * factor,
    carbs: item.carbs * factor,
    fat: item.fat * factor,
  }
}

export function sumMacros(values: Macros[]): Macros {
  return values.reduce(
    (total, value) => ({
      calories: total.calories + value.calories,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}
