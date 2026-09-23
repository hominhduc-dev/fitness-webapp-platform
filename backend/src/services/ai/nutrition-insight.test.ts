import { describe, expect, it } from "vitest"

import type { AIProvider } from "../../lib/ai/types"
import type { DayIntake } from "../nutrition-intake.service"
import {
  buildInsightFindings,
  generateNutritionInsight,
  intakeFingerprint,
  pickSuggestionFoods,
  validateInsight,
  type InsightInput,
} from "./nutrition-insight"

function day(date: string, overrides: Partial<DayIntake> = {}): DayIntake {
  return { calories: 2400, carbs: 280, date, fat: 70, items: 4, itemsWithData: 4, nutrients: {}, protein: 150, ...overrides }
}

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  const days = [day("2026-09-21"), day("2026-09-22"), day("2026-09-23")]
  return {
    goals: { calories: 2500, protein: 150 },
    names: { fiber: { name: "Chất xơ", unit: "g" }, potassium: { name: "Kali", unit: "mg" }, sodium: { name: "Natri", unit: "mg" } },
    targets: { fiber: { amount: 30, kind: "reach" }, potassium: { amount: 3400, kind: "reach" }, sodium: { amount: 2300, kind: "limit" } },
    today: days[2],
    week: { average: { calories: 2400, nutrients: { fiber: 19, potassium: 3300, sodium: 3100 }, protein: 150 }, days, loggedDays: 3 },
    ...overrides,
  }
}

describe("buildInsightFindings", () => {
  it("flags a weekly shortfall below 70 % and a ceiling breach, and credits what is on target", () => {
    const { findings, hasTrend } = buildInsightFindings(input())
    expect(hasTrend).toBe(true)
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fiber", scope: "week", status: "low", amount: 19 }),
        expect.objectContaining({ code: "sodium", scope: "week", status: "high" }),
        expect.objectContaining({ code: "potassium", status: "good" }),
        expect.objectContaining({ code: "protein", scope: "today", status: "good" }),
      ]),
    )
  })

  it("does not call a sodium intake under its ceiling good or bad", () => {
    const quiet = input({ week: { ...input().week, average: { ...input().week.average, nutrients: { sodium: 1800 } } } })
    expect(buildInsightFindings(quiet).findings.find((finding) => finding.code === "sodium")).toBeUndefined()
  })

  it("talks about today only until there are three logged days", () => {
    const twoDays = input({ week: { ...input().week, loggedDays: 2 }, today: day("2026-09-23", { nutrients: { fiber: 10 } }) })
    const { findings, hasTrend } = buildInsightFindings(twoDays)
    expect(hasTrend).toBe(false)
    expect(findings.every((finding) => finding.scope === "today")).toBe(true)
    expect(findings).toContainEqual(expect.objectContaining({ code: "fiber", status: "low", amount: 10 }))
  })

  it("skips micronutrients when most logged items have no nutrient data", () => {
    const sparse = [day("2026-09-21", { itemsWithData: 1 }), day("2026-09-22", { itemsWithData: 1 }), day("2026-09-23", { itemsWithData: 1 })]
    const result = buildInsightFindings(input({ week: { ...input().week, days: sparse } }))
    expect(result.microsUsable).toBe(false)
    expect(result.findings.some((finding) => finding.code === "fiber")).toBe(false)
  })
})

describe("pickSuggestionFoods", () => {
  it("returns the richest foods per short nutrient and merges overlaps", () => {
    const foods = [
      { calories: 90, id: "banana", name: "Chuối", nutrients: { fiber: 2.6, potassium: 358 } },
      { calories: 120, id: "potato", name: "Khoai tây", nutrients: { fiber: 1.8, potassium: 379 } },
      { calories: 20, id: "cabbage", name: "Bắp cải", nutrients: { fiber: 2.5 } },
      { calories: 200, id: "rice", name: "Cơm", nutrients: {} },
    ]
    const picked = pickSuggestionFoods(["fiber", "potassium"], foods, 2)
    expect(picked.map((food) => food.id).sort()).toEqual(["banana", "cabbage", "potato"])
    expect(picked.find((food) => food.id === "banana")?.richIn).toEqual(["fiber", "potassium"])
  })
})

describe("insight output", () => {
  it("rejects foods that were not offered", () => {
    const value = { points: [{ text: "Ăn thêm chuối.", tone: "info" }], suggestedFoodIds: ["banana", "pizza"], summary: "Ổn." }
    expect(() => validateInsight(value, new Set(["banana"]))).toThrow(/pizza/)
    expect(validateInsight({ ...value, suggestedFoodIds: ["banana", "banana"] }, new Set(["banana"])).suggestedFoodIds).toEqual(["banana"])
  })

  it("asks the model once to fix an invented food", async () => {
    const outputs = [
      { points: [{ text: "Thêm pizza.", tone: "info" }], suggestedFoodIds: ["pizza"], summary: "Thiếu chất xơ." },
      { points: [{ text: "Thêm chuối.", tone: "info" }], suggestedFoodIds: ["banana"], summary: "Thiếu chất xơ." },
    ]
    const prompts: string[] = []
    const provider = {
      async generateStructuredJSON({ userPrompt }: { userPrompt: string }) {
        prompts.push(userPrompt)
        return { data: outputs.shift(), tokenUsage: 5 }
      },
      supportsTools: false,
    } as unknown as AIProvider

    const result = await generateNutritionInsight(provider, {
      findings: buildInsightFindings(input()),
      foods: [{ calories: 90, id: "banana", name: "Chuối", nutrients: { fiber: 2.6 }, richIn: ["fiber"] }],
      locale: "vi",
      names: input().names,
    })
    expect(result.suggestedFoodIds).toEqual(["banana"])
    expect(prompts[0]).toContain("Chất xơ: 19 / 30 g → thiếu")
    expect(prompts[1]).toContain("pizza")
  })

  it("changes the fingerprint when something new is logged", () => {
    const before = intakeFingerprint(input())
    const after = intakeFingerprint(input({ today: day("2026-09-23", { calories: 2600, items: 5 }) }))
    expect(after).not.toBe(before)
    expect(intakeFingerprint(input())).toBe(before)
  })
})
