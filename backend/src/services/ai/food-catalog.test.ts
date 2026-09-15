import { describe, expect, it } from "vitest"

import { containsTerm, isFoodAllowed, selectFoodsForPrompt } from "./food-catalog"

const food = (name: string, extra: Partial<{ id: string; category: string; source: string; priceTier: string; prepMinutes: number }> = {}) => ({
  id: extra.id ?? name,
  name,
  category: extra.category ?? "dish",
  ...extra,
})

describe("containsTerm", () => {
  it("matches whole words and respects diacritics when the term has them", () => {
    expect(containsTerm("Cá hồi áp chảo", "cá")).toBe(true)
    expect(containsTerm("Cà tím nướng", "cá")).toBe(false)
    expect(containsTerm("Bánh mì", "bánh mì")).toBe(true)
    expect(containsTerm("Đậu hũ", "đậu phộng")).toBe(false)
  })

  it("lets accentless input match accented names", () => {
    expect(containsTerm("Tôm hấp bia", "tom")).toBe(true)
    expect(containsTerm("Bánh đậu phộng", "dau phong")).toBe(true)
  })
})

describe("isFoodAllowed", () => {
  it("excludes allergens", () => {
    expect(isFoodAllowed(food("Tôm hấp"), { allergies: ["tôm"] })).toBe(false)
    expect(isFoodAllowed(food("Cơm trắng"), { allergies: ["tôm"] })).toBe(true)
  })

  it("applies vegetarian and pescatarian diets without catching look-alike words", () => {
    const vegetarian = { dietType: "vegetarian" }
    expect(isFoodAllowed(food("Ức gà luộc"), vegetarian)).toBe(false)
    expect(isFoodAllowed(food("Cá hồi"), vegetarian)).toBe(false)
    expect(isFoodAllowed(food("Cà tím"), vegetarian)).toBe(true)
    expect(isFoodAllowed(food("Bơ"), vegetarian)).toBe(true)
    expect(isFoodAllowed(food("Chả giò chay"), vegetarian)).toBe(true)
    expect(isFoodAllowed(food("Cá hồi"), { dietType: "pescatarian" })).toBe(true)
    expect(isFoodAllowed(food("Thịt bò xào"), { dietType: "pescatarian" })).toBe(false)
  })

  it("filters by price and prep time only when the food carries that data", () => {
    expect(isFoodAllowed(food("Bò Wagyu", { priceTier: "high" }), { budget: "low" })).toBe(false)
    expect(isFoodAllowed(food("Cơm", { priceTier: "low" }), { budget: "low" })).toBe(true)
    expect(isFoodAllowed(food("Phở", { prepMinutes: 90 }), { cookingTime: "quick" })).toBe(false)
    expect(isFoodAllowed(food("Chuối"), { cookingTime: "quick" })).toBe(true)
  })
})

describe("selectFoodsForPrompt", () => {
  it("keeps category variety under the cap and pushes recent foods back", () => {
    const foods = [
      ...["A", "B", "C", "D"].map((name) => food(`Staple ${name}`, { category: "staple" })),
      food("Protein A", { category: "protein" }),
      food("Veg A", { category: "veg" }),
    ]
    const selected = selectFoodsForPrompt(foods, { recentFoodIds: new Set(["Staple A"]) }, 3)
    expect(selected.map((item) => item.category).sort()).toEqual(["protein", "staple", "veg"])
    expect(selected.find((item) => item.category === "staple")?.name).toBe("Staple B")
  })
})
