import { describe, expect, it } from "vitest"

import { fitPortions, type ScalableItem } from "./portion-scaler"

const rice = { calories: 2.5, protein: 0.1, carbs: 0.4, fat: 0.06 }
const chicken = { calories: 1.65, protein: 0.31, carbs: 0, fat: 0.036 }
const gramItem = (perUnit: ScalableItem["perUnit"], amount: number, max = 400): ScalableItem => ({ perUnit, amount, min: 20, max, step: 5 })

describe("fitPortions", () => {
  it("solves calories and protein together from rough model portions", () => {
    const amounts = fitPortions([gramItem(rice, 100), gramItem(chicken, 100)], { calories: 1000, protein: 75, carbs: 0, fat: 0 }, { calories: 4, protein: 1, carbs: 0, fat: 0 })
    const calories = amounts[0] * rice.calories + amounts[1] * chicken.calories
    const protein = amounts[0] * rice.protein + amounts[1] * chicken.protein
    expect(Math.abs(calories - 1000) / 1000).toBeLessThan(0.02)
    expect(Math.abs(protein - 75) / 75).toBeLessThan(0.05)
    expect(amounts.every((amount) => amount % 5 === 0)).toBe(true)
  })

  it("keeps an already exact plan unchanged", () => {
    expect(fitPortions([gramItem(rice, 100)], { calories: 250, protein: 0, carbs: 0, fat: 0 }, { calories: 1, protein: 0, carbs: 0, fat: 0 })).toEqual([100])
  })

  it("stops at the bounds when the target is out of reach", () => {
    const amounts = fitPortions([gramItem(rice, 100, 150), gramItem(chicken, 100, 150)], { calories: 9000, protein: 0, carbs: 0, fat: 0 }, { calories: 1, protein: 0, carbs: 0, fat: 0 })
    expect(amounts).toEqual([150, 150])
  })

  it("snaps servings to quarter steps and never goes below one step", () => {
    const serving: ScalableItem = { perUnit: { calories: 300, protein: 10, carbs: 40, fat: 8 }, amount: 1, min: 0, max: 4, step: 0.25 }
    const [amount] = fitPortions([serving], { calories: 20, protein: 0, carbs: 0, fat: 0 }, { calories: 1, protein: 0, carbs: 0, fat: 0 })
    expect(amount).toBe(0.25)
    const [larger] = fitPortions([serving], { calories: 700, protein: 0, carbs: 0, fat: 0 }, { calories: 1, protein: 0, carbs: 0, fat: 0 })
    expect((larger / 0.25) % 1).toBe(0)
    expect(Math.abs(larger * 300 - 700)).toBeLessThanOrEqual(75)
  })
})
