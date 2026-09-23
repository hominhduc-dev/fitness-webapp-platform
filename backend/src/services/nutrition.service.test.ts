import { describe, expect, it } from "vitest"

import { calculateItemNutrition, normalizeAmountUnit } from "./nutrition.service"

/** A food defined per 100 g, matching imported/catalog nutrition rows. */
const per100g = {
  calories: 200,
  carbs: 20,
  fat: 8,
  fiber: 3,
  protein: 10,
  servingAmount: 100,
  servingGrams: 100,
  servingUnit: "g",
  sodium: 400,
  sugar: 5,
}

/** A portion food whose weight was never recorded, so grams cannot be derived. */
const perServing = {
  calories: 350,
  carbs: 40,
  fat: 9,
  fiber: null,
  protein: 25,
  servingAmount: 1,
  servingGrams: null,
  servingUnit: "serving",
  sodium: null,
  sugar: null,
}

/** A dish sold by the bowl that does have a weight: "1 tô" = 700 g. */
const perBowl = { ...perServing, servingGrams: 700 }

describe("normalizeAmountUnit", () => {
  it("accepts the two weight/volume units", () => {
    expect(normalizeAmountUnit("g")).toBe("g")
    expect(normalizeAmountUnit("ml")).toBe("ml")
  })

  it("normalizes case and padding", () => {
    expect(normalizeAmountUnit("  G ")).toBe("g")
  })

  it("falls back to a generic serving for anything else", () => {
    expect(normalizeAmountUnit("oz")).toBe("serving")
    expect(normalizeAmountUnit(undefined)).toBe("serving")
    expect(normalizeAmountUnit(42)).toBe("serving")
  })
})

describe("calculateItemNutrition", () => {
  it("scales a per-100 g food by the logged gram amount", () => {
    const result = calculateItemNutrition(per100g, { amountUnit: "g", amountValue: 150 })

    expect(result.calories).toBe(300)
    expect(result.protein).toBe(15)
    expect(result.carbs).toBe(30)
    expect(result.fat).toBe(12)
    expect(result.quantity).toBe(1.5)
  })

  it("snapshots micronutrients scaled to the logged portion", () => {
    const withNutrients = {
      ...perBowl,
      nutrients: [
        { amount: 1200, nutrientCode: "sodium" },
        { amount: 2.5, nutrientCode: "fiber" },
        { amount: 1, nutrientCode: "not_a_nutrient" },
      ],
    }
    // 350 g of a 700 g bowl is half a serving.
    expect(calculateItemNutrition(withNutrients, { amountUnit: "g", amountValue: 350 }).nutrients).toEqual({ fiber: 1.3, sodium: 600 })
  })

  it("leaves the snapshot empty when the food has no nutrient data", () => {
    expect(calculateItemNutrition(perBowl, { amountUnit: "serving", amountValue: 1 }).nutrients).toBeUndefined()
    expect(calculateItemNutrition({ ...perBowl, nutrients: [] }, { amountUnit: "serving", amountValue: 1 }).nutrients).toBeUndefined()
  })

  it("records the gram weight so the UI can show it", () => {
    expect(calculateItemNutrition(per100g, { amountUnit: "g", amountValue: 150 }).weightGrams).toBe(150)
    expect(calculateItemNutrition(perServing, { amountUnit: "serving", amountValue: 2 }).weightGrams).toBeUndefined()
  })

  it("treats a serving amount as a plain multiplier", () => {
    const result = calculateItemNutrition(perServing, { amountUnit: "serving", amountValue: 2 })

    expect(result.calories).toBe(700)
    expect(result.protein).toBe(50)
    expect(result.quantity).toBe(2)
  })

  it("keeps optional macros undefined rather than defaulting them to zero", () => {
    // Nutrition data is frequently partial; a null must not become a reported 0.
    const result = calculateItemNutrition(perServing, { amountUnit: "serving", amountValue: 1 })

    expect(result.fiber).toBeUndefined()
    expect(result.sodium).toBeUndefined()
    expect(result.sugar).toBeUndefined()
  })

  it("treats a missing carb/fat/protein value as zero, since totals must still add up", () => {
    const result = calculateItemNutrition(
      { ...perServing, carbs: null, fat: null, protein: null },
      { amountUnit: "serving", amountValue: 1 },
    )

    expect(result.carbs).toBe(0)
    expect(result.fat).toBe(0)
    expect(result.protein).toBe(0)
  })

  it("falls back to multiplier semantics when the unit does not match the food's unit", () => {
    // Logging "150 ml" of a food defined in grams cannot be converted, so the value
    // is applied as a multiplier rather than silently producing a wrong gram total.
    const result = calculateItemNutrition(per100g, { amountUnit: "ml", amountValue: 2 })

    expect(result.quantity).toBe(2)
    expect(result.calories).toBe(400)
  })

  it("rounds sodium to a whole milligram and macros to one decimal", () => {
    const result = calculateItemNutrition(per100g, { amountUnit: "g", amountValue: 33 })

    expect(result.sodium).toBe(132)
    expect(result.calories).toBe(66)
    expect(result.fat).toBe(2.6)
  })

  it("omits the amount label for a single serving but sets it otherwise", () => {
    expect(calculateItemNutrition(perServing, { amountUnit: "serving", amountValue: 1 }).amountLabel).toBeUndefined()
    expect(calculateItemNutrition(perServing, { amountUnit: "serving", amountValue: 2 }).amountLabel).toBe("×2")
    expect(calculateItemNutrition(per100g, { amountUnit: "g", amountValue: 150 }).amountLabel).toBe("150 g")
  })

  it("handles a zero serving amount without dividing by zero", () => {
    const result = calculateItemNutrition(
      { ...per100g, servingAmount: 0, servingGrams: 0 },
      { amountUnit: "g", amountValue: 50 },
    )

    expect(Number.isFinite(result.calories)).toBe(true)
    expect(result.quantity).toBe(50)
  })

  it("logs a dish sold by the bowl in grams once its serving weight is known", () => {
    // Half a 700 g bowl is half its nutrition, which is the whole point of
    // recording the weight: "1 tô" is not something anyone can weigh.
    const result = calculateItemNutrition(perBowl, { amountUnit: "g", amountValue: 350 })

    expect(result.quantity).toBe(0.5)
    expect(result.calories).toBe(175)
    expect(result.protein).toBe(12.5)
    expect(result.weightGrams).toBe(350)
  })

  it("reports the gram weight of a portion logged in servings", () => {
    // The trainee picked two bowls; the tracker should still say 1400 g.
    expect(calculateItemNutrition(perBowl, { amountUnit: "serving", amountValue: 2 }).weightGrams).toBe(1400)
  })

  it("keeps counting in servings when the food has no recorded weight", () => {
    const result = calculateItemNutrition(perServing, { amountUnit: "g", amountValue: 350 })

    expect(result.quantity).toBe(350)
    expect(result.weightGrams).toBe(350)
  })
})
