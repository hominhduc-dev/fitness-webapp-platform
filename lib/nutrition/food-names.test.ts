import { describe, expect, it } from "vitest"

import { foodDisplayName, foodMatchesSearch, normalizeFoodSearch, servingLabelFor } from "./food-names"

describe("food names", () => {
  const pho = { name: "Phở bò", nameEn: "Beef pho" }

  it("shows the English name only when there is one", () => {
    expect(foodDisplayName(pho, "en")).toBe("Beef pho")
    expect(foodDisplayName(pho, "vi")).toBe("Phở bò")
    expect(foodDisplayName({ name: "Cá Ngừ" }, "en")).toBe("Cá Ngừ")
  })

  it("searches without diacritics and in either language", () => {
    expect(normalizeFoodSearch("  Đậu  PHỤ ")).toBe("dau phu")
    expect(foodMatchesSearch(pho, "pho bo")).toBe(true)
    expect(foodMatchesSearch(pho, "beef")).toBe(true)
    expect(foodMatchesSearch(pho, "chicken")).toBe(false)
    expect(foodMatchesSearch({ name: "Bánh mì thịt" }, "banh mi")).toBe(true)
  })

  it("translates Vietnamese portion words in English", () => {
    expect(servingLabelFor("1 chén · 150g", "en")).toBe("1 bowl · 150g")
    expect(servingLabelFor("1 tô", "en")).toBe("1 large bowl")
    expect(servingLabelFor("1/2 quả · 70g", "en")).toBe("1/2 piece · 70g")
    expect(servingLabelFor("1 lon · 330ml", "en")).toBe("1 can · 330ml")
    expect(servingLabelFor("100 g", "en")).toBe("100 g")
    expect(servingLabelFor("1 tô", "vi")).toBe("1 tô")
  })
})
