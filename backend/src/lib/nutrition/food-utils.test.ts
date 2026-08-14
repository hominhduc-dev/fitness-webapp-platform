import { describe, expect, it } from "vitest"

import { buildFoodSlug, parseServingLabel, roundNutrition } from "./food-utils"

describe("buildFoodSlug", () => {
  it("strips Vietnamese diacritics so lookups are ASCII-stable", () => {
    expect(buildFoodSlug("Phở bò tái", "system")).toBe("system-pho-bo-tai")
  })

  it("maps đ/Đ, which NFD normalization alone does not decompose", () => {
    expect(buildFoodSlug("Đậu phụ", "system")).toBe("system-dau-phu")
    expect(buildFoodSlug("Bánh đa đỏ", "system")).toBe("system-banh-da-do")
  })

  it("namespaces user-created foods so they cannot collide with system ones", () => {
    expect(buildFoodSlug("Phở bò", { userId: "u-1" })).toBe("user-u-1-pho-bo")
    expect(buildFoodSlug("Phở bò", "system")).not.toBe(buildFoodSlug("Phở bò", { userId: "u-1" }))
  })

  it("collapses punctuation and trims separator runs", () => {
    expect(buildFoodSlug("  Cơm tấm (sườn bì) — 1 phần  ", "system")).toBe("system-com-tam-suon-bi-1-phan")
  })
})

describe("parseServingLabel", () => {
  it("reads a gram serving", () => {
    expect(parseServingLabel("100 g")).toEqual({ servingAmount: 100, servingUnit: "g" })
  })

  it("reads a millilitre serving", () => {
    expect(parseServingLabel("330ml")).toEqual({ servingAmount: 330, servingUnit: "ml" })
  })

  it("accepts a comma decimal separator", () => {
    expect(parseServingLabel("2,5 g")).toEqual({ servingAmount: 2.5, servingUnit: "g" })
  })

  it("is case insensitive", () => {
    expect(parseServingLabel("250 ML")).toEqual({ servingAmount: 250, servingUnit: "ml" })
  })

  it("falls back to one generic serving when no unit is present", () => {
    expect(parseServingLabel("1 tô")).toEqual({ servingAmount: 1, servingUnit: "serving" })
    expect(parseServingLabel("")).toEqual({ servingAmount: 1, servingUnit: "serving" })
  })
})

describe("roundNutrition", () => {
  it("rounds to one decimal by default", () => {
    expect(roundNutrition(12.34)).toBe(12.3)
    expect(roundNutrition(12.35)).toBe(12.4)
  })

  it("honours an explicit precision", () => {
    expect(roundNutrition(1234.5678, 0)).toBe(1235)
    expect(roundNutrition(0.123456, 4)).toBe(0.1235)
  })

  it("keeps zero and negatives well-defined", () => {
    expect(roundNutrition(0)).toBe(0)
    expect(roundNutrition(-1.25, 1)).toBe(-1.2)
  })
})
