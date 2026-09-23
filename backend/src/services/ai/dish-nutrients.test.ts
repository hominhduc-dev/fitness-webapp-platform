import { describe, expect, it } from "vitest"

import { validateDishNutrients } from "./dish-nutrients"

const pho = { calories: 420, carbs: 55, fat: 10, name: "Phở bò", protein: 25, servingGrams: 700, servingLabel: "1 tô" }
const nutrients = {
  calcium: 60, cholesterol: 55, fiber: 2, folate: 30, iron: 3, magnesium: 40, potassium: 600, saturated_fat: 3.5,
  sodium: 1800, sugar: 4, vitamin_a: 20, vitamin_b12: 1.5, vitamin_c: 5, vitamin_d: 0.1, zinc: 5,
}

describe("validateDishNutrients", () => {
  it("accepts a plausible bowl of phở", () => {
    expect(validateDishNutrients({ nutrients, recipe: "Bánh phở 200 g, bò 80 g, nước dùng 420 g" }, pho).nutrients.sodium).toBe(1800)
  })

  it("catches a unit slip that puts a dish past any real food", () => {
    expect(() => validateDishNutrients({ nutrients: { ...nutrients, vitamin_d: 400 }, recipe: "x" }, pho)).toThrow(/vitamin_d/)
  })

  it("keeps saturated fat inside total fat and fiber + sugar inside carbs", () => {
    expect(() => validateDishNutrients({ nutrients: { ...nutrients, saturated_fat: 12 }, recipe: "x" }, pho)).toThrow(/saturated_fat/)
    expect(() => validateDishNutrients({ nutrients: { ...nutrients, sugar: 60 }, recipe: "x" }, pho)).toThrow(/fiber \+ sugar/)
  })

  it("requires every nutrient", () => {
    const { zinc: _zinc, ...missing } = nutrients
    expect(() => validateDishNutrients({ nutrients: missing, recipe: "x" }, pho)).toThrow(/zinc/)
  })
})
