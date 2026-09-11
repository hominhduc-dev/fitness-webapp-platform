import { describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "../../auth.service"
import type { ContextPrismaClient } from "./helpers"
import { buildNutritionContext } from "./nutrition-context"

describe("nutrition target wording", () => {
  it.each([
    [190, "đã vượt mục tiêu 50 g"],
    [90, "còn thiếu 50 g để đạt mục tiêu"],
    [140, "đã đạt mục tiêu"],
  ])("distinguishes consumed protein %s from a deficit", async (protein, wording) => {
    const db = { meal: { findMany: vi.fn().mockResolvedValue([
      { loggedDate: new Date("2026-09-11T00:00:00Z"), calories: 2483, protein, carbs: 299, fat: 53, items: [] },
    ]) } } as unknown as ContextPrismaClient
    const profile = { id: "test-user", dailyCalorieGoal: 2700, dailyProteinGoal: 140 } as SerializedProfile
    const section = await buildNutritionContext(db, profile, new Date("2026-09-11T12:00:00Z"))
    expect(JSON.stringify(section)).toContain(`Protein (mục tiêu 140g): ${wording}`)
    expect(JSON.stringify(section)).toContain("còn thiếu 217 kcal")
    expect(JSON.stringify(section)).not.toContain("protein -50")
  })
})
