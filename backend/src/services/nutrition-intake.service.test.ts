import { describe, expect, it, vi } from "vitest"

import { getIntakeSummary, sumItemNutrients } from "./nutrition-intake.service"

describe("sumItemNutrients", () => {
  it("adds snapshots and counts the items that have none instead of treating them as zero", () => {
    const result = sumItemNutrients([
      { foodId: "a", nutrients: { fiber: 2, sodium: 400 } },
      { foodId: "b", nutrients: { fiber: 1.5, unknown: 9 } },
      { foodId: "c", nutrients: null },
    ])
    expect(result.amounts).toEqual({ fiber: 3.5, sodium: 400 })
    expect(result.coverage).toEqual({ items: 3, itemsWithData: 2 })
  })
})

describe("getIntakeSummary", () => {
  it("averages over logged days only, and each nutrient over the days it was measured", async () => {
    const meals = [
      { calories: 2000, carbs: 200, fat: 60, items: [{ foodId: "a", nutrients: { fiber: 20, sodium: 2000 } }], loggedDate: new Date("2026-09-21T00:00:00Z"), protein: 120 },
      { calories: 2400, carbs: 260, fat: 70, items: [{ foodId: "b", nutrients: { fiber: 30 } }], loggedDate: new Date("2026-09-23T00:00:00Z"), protein: 160 },
    ]
    const db = { meal: { findMany: vi.fn().mockResolvedValue(meals) } }

    const summary = await getIntakeSummary(db as never, "user", new Date("2026-09-23T00:00:00Z"), 7)

    expect(summary.loggedDays).toBe(2)
    expect(summary.average.calories).toBe(2200)
    expect(summary.average.protein).toBe(140)
    expect(summary.average.nutrients).toEqual({ fiber: 25, sodium: 2000 })
    expect(db.meal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ loggedDate: { gte: new Date("2026-09-17T00:00:00Z"), lte: new Date("2026-09-23T00:00:00Z") } }) }),
    )
  })
})
