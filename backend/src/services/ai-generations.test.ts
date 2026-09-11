import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"

const { db, provider } = vi.hoisted(() => ({
  db: { aIGeneration: { count: vi.fn(), create: vi.fn(), update: vi.fn() }, exercise: { findMany: vi.fn() }, workoutLog: { findMany: vi.fn(), count: vi.fn() }, food: { findMany: vi.fn() }, meal: { findMany: vi.fn() } },
  provider: { generateStructuredJSON: vi.fn() },
}))
vi.mock("../lib/prisma", () => ({ prisma: db, retryTransaction: (fn: () => unknown) => fn() }))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => provider }))
import { generateWorkoutProgram, generateDailyWorkout, generateMealPlan } from "./ai.service"

const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
const wrongId = "3f2504e0-4f89-41d3-9a0c-0305e82c3302"
const profile = { id: "user", dailyCalorieGoal: 2000, dailyProteinGoal: 100, dailyCarbsGoal: 200, dailyFatGoal: 60 } as SerializedProfile
const input = { goal: "strength", experienceLevel: "beginner", daysPerWeek: 2, durationWeeks: 1, sessionDuration: 30, availableEquipment: "bodyweight" }
const exercise = { variationId: id, sets: 3, reps: 10 }
const workout = { name: "Full Body", kind: "full_body", duration: 30, weekIndex: 0, scheduledDay: 1, exercises: [exercise] }
function program() { return { name: "Plan", description: "", workouts: [workout, { ...workout, scheduledDay: 3 }] } }
function menu() { return { meals: ["breakfast", "lunch", "dinner", "snack"].map(type => ({ type, suggestion: "", items: [1, 2].map(() => ({ foodId: id, amountValue: 100, amountUnit: "g" })) })), notes: "", totalCalories: 99999, totalProtein: 99999 } }

describe("AI generation runtime contracts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.aIGeneration.count.mockResolvedValue(0)
    db.aIGeneration.create.mockResolvedValue({ id: "draft" })
    db.workoutLog.findMany.mockResolvedValue([])
    db.workoutLog.count.mockResolvedValue(0)
    db.meal.findMany.mockResolvedValue([])
    db.exercise.findMany.mockResolvedValue([{ id, name: "Squat", muscleGroup: "Legs", createdById: null, variations: [{ id: wrongId, name: "Barbell", equipment: "Barbell" }, { id, name: "Default", equipment: "Bodyweight" }] }])
    db.food.findMany.mockResolvedValue([{ id, name: "Rice", category: "staple", calories: 250, protein: 10, carbs: 40, fat: 6, fiber: 1, sodium: 10, sugar: 0, servingAmount: 100, servingUnit: "g", servingLabel: "100 g" }])
  })
  it("maps exact IDs and excludes unreachable variations from the prompt", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: program(), tokenUsage: 100 })
    const result = await generateWorkoutProgram(profile, input)
    expect(result.mappingRate).toBe(100)
    expect(result.program.workouts[0].exercises[0].variationId).toBe(id)
    const prompt = provider.generateStructuredJSON.mock.calls[0][0].userPrompt
    expect(prompt).toContain(id)
    expect(prompt).not.toContain(wrongId)
  })
  it.each(["missing", "unreachable", "empty", "duplicate-day", "wrong-count", "bad-rir", "bad-weight"])("rejects %s output without silently dropping or substituting", async defect => {
    const data = structuredClone(program())
    if (defect === "missing") Reflect.deleteProperty(data.workouts[0].exercises[0], "variationId")
    if (defect === "unreachable") data.workouts[0].exercises[0].variationId = wrongId
    if (defect === "empty") data.workouts[0].exercises = []
    if (defect === "duplicate-day") data.workouts[1].scheduledDay = 1
    if (defect === "wrong-count") data.workouts.pop()
    if (defect === "bad-rir") Object.assign(data.workouts[0].exercises[0], { rir: 10 })
    if (defect === "bad-weight") Object.assign(data.workouts[0].exercises[0], { weight: -1 })
    provider.generateStructuredJSON.mockResolvedValue({ data, tokenUsage: 100 })
    await expect(generateWorkoutProgram(profile, input)).rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("validates daily workout output too", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: { ...workout, warmup: "", description: "", exercises: [{ ...exercise, reps: -1 }] } })
    await expect(generateDailyWorkout(profile, { ...input, date: "2026-09-11", energyLevel: "normal" })).rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("uses catalog and quantity for all nutrition totals, ignoring model totals", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: menu(), tokenUsage: 100 })
    const result = await generateMealPlan(profile, { date: "2026-09-11" })
    expect(result.totals).toEqual({ calories: 2000, protein: 80, carbs: 320, fat: 48 })
    expect(result.meals[0].items[0]).toMatchObject({ calories: 250, quantityLabel: "100 g" })
  })
  it("accepts a one-item snack while retaining the calorie target", async () => {
    const data = menu()
    data.meals[3].items = [{ foodId: id, amountValue: 200, amountUnit: "g" }]
    provider.generateStructuredJSON.mockResolvedValue({ data, tokenUsage: 100 })
    expect((await generateMealPlan(profile, { date: "2026-09-11" })).totals.calories).toBe(2000)
  })
  it.each(["unknown-food", "bad-unit", "empty", "duplicate-meal", "bad-amount", "calorie-target"])("rejects meal defect: %s", async defect => {
    const data = menu()
    if (defect === "unknown-food") data.meals[0].items[0].foodId = wrongId
    if (defect === "bad-unit") data.meals[0].items[0].amountUnit = "ml"
    if (defect === "empty") data.meals[0].items = []
    if (defect === "duplicate-meal") data.meals[1].type = "breakfast"
    if (defect === "bad-amount") data.meals[0].items[0].amountValue = -1
    if (defect === "calorie-target") data.meals.forEach(meal => meal.items.forEach(item => { item.amountValue = 10 }))
    provider.generateStructuredJSON.mockResolvedValue({ data, tokenUsage: 100 })
    await expect(generateMealPlan(profile, { date: "2026-09-11" })).rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("blocks invalid service/tool inputs before provider or database work", async () => {
    await expect(generateMealPlan(profile, { date: "2026-02-30" })).rejects.toMatchObject({ status: 400 })
    await expect(generateWorkoutProgram(profile, { ...input, availableEquipment: "invented" })).rejects.toMatchObject({ status: 400 })
    expect(provider.generateStructuredJSON).not.toHaveBeenCalled()
    expect(db.aIGeneration.count).not.toHaveBeenCalled()
  })
})
