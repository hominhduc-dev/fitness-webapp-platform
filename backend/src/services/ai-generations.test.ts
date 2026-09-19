import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"

const { db, provider } = vi.hoisted(() => ({
  db: { aIGeneration: { count: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() }, exercise: { findMany: vi.fn() }, workoutLog: { findMany: vi.fn(), count: vi.fn() }, food: { findMany: vi.fn() }, meal: { findMany: vi.fn() } },
  provider: { generateStructuredJSON: vi.fn() },
}))
vi.mock("../lib/prisma", () => ({ prisma: db, retryTransaction: (fn: () => unknown) => fn() }))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => provider }))
import { generateWorkoutProgram, generateDailyWorkout, generateMealPlan, regenerateAIMealPlanMeal } from "./ai.service"

const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
const wrongId = "3f2504e0-4f89-41d3-9a0c-0305e82c3302"
const noodleId = "3f2504e0-4f89-41d3-9a0c-0305e82c3303"
// Macro goals are exactly what eight 100 g portions of rice provide, so an exact draft needs no scaling.
const profile = { id: "user", dailyCalorieGoal: 2000, dailyProteinGoal: 80, dailyCarbsGoal: 320, dailyFatGoal: 48 } as SerializedProfile
const input = { goal: "strength", experienceLevel: "beginner", daysPerWeek: 2, durationWeeks: 1, sessionDuration: 30, availableEquipment: "bodyweight" }
const exercise = { variationRef: "v1", sets: 3, reps: 10 }
const workout = { kind: "full_body", duration: 30, weekIndex: 0, scheduledDay: 1, exercises: [exercise] }
const rice = { id, name: "Rice", category: "staple", calories: 250, protein: 10, carbs: 40, fat: 6, fiber: 1, sodium: 10, sugar: 0, servingAmount: 100, servingUnit: "g", servingLabel: "100 g" }
function program() { return { name: "Plan", description: "", workouts: [workout, { ...workout, scheduledDay: 3 }] } }
function meals(types = ["breakfast", "lunch", "dinner", "snack"], amountValue = 100, foodId = id) {
  return types.map(type => ({ type, suggestion: "", items: [1, 2].map(() => ({ foodId, amountValue, amountUnit: "g" })) }))
}
function menu(date = "2026-09-11") { return { days: [{ date, meals: meals() }], notes: "", totalCalories: 99999, totalProtein: 99999 } }

describe("AI generation runtime contracts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.aIGeneration.count.mockResolvedValue(0)
    db.aIGeneration.create.mockResolvedValue({ id: "draft" })
    db.workoutLog.findMany.mockResolvedValue([])
    db.workoutLog.count.mockResolvedValue(0)
    db.meal.findMany.mockResolvedValue([])
    db.exercise.findMany.mockResolvedValue([{ id, name: "Squat", muscleGroup: "Legs", createdById: null, variations: [{ id: wrongId, name: "Barbell", equipment: "Barbell" }, { id, name: "Default", equipment: "Bodyweight" }] }])
    db.food.findMany.mockResolvedValue([rice])
  })
  it("maps exact IDs and excludes unreachable variations from the prompt", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: program(), tokenUsage: 100 })
    const result = await generateWorkoutProgram(profile, input)
    expect(result.program.workouts[0].exercises[0].variationId).toBe(id)
    const prompt = provider.generateStructuredJSON.mock.calls[0][0].userPrompt
    expect(prompt).toContain("v1")
    expect(prompt).not.toContain(id)
    expect(prompt).not.toContain(wrongId)
  })
  it.each(["missing", "unreachable", "empty", "duplicate-day", "wrong-count", "bad-rir", "bad-weight"])("rejects %s output without silently dropping or substituting", async defect => {
    const data = structuredClone(program())
    if (defect === "missing") Reflect.deleteProperty(data.workouts[0].exercises[0], "variationRef")
    if (defect === "unreachable") data.workouts[0].exercises[0].variationRef = "v999"
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
    provider.generateStructuredJSON.mockResolvedValue({ data: { kind: workout.kind, warmup: "", description: "", exercises: [{ ...exercise, reps: -1 }] } })
    await expect(generateDailyWorkout(profile, { ...input, date: "2026-09-11", energyLevel: "normal" })).rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("uses catalog and quantity for all nutrition totals, ignoring model totals", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: menu(), tokenUsage: 100 })
    const result = await generateMealPlan(profile, { date: "2026-09-11" })
    expect(result.days[0].totals).toEqual({ calories: 2000, protein: 80, carbs: 320, fat: 48 })
    expect(result.days[0].meals[0].items[0]).toMatchObject({ calories: 250, quantityLabel: "100 g" })
  })
  it("scales rough model portions to the calorie and macro targets", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: { days: [{ date: "2026-09-11", meals: meals(undefined, 80) }], notes: "" }, tokenUsage: 100 })
    const result = await generateMealPlan(profile, { date: "2026-09-11" })
    expect(Math.abs(result.days[0].totals.calories - 2000)).toBeLessThanOrEqual(200)
    expect(result.days[0].meals.flatMap(meal => meal.items).every(item => item.amountValue % 5 === 0)).toBe(true)
    expect(provider.generateStructuredJSON).toHaveBeenCalledTimes(1)
  })
  it("accepts a one-item snack while retaining the calorie target", async () => {
    const data = menu()
    data.days[0].meals[3].items = [{ foodId: id, amountValue: 200, amountUnit: "g" }]
    provider.generateStructuredJSON.mockResolvedValue({ data, tokenUsage: 100 })
    expect((await generateMealPlan(profile, { date: "2026-09-11" })).days[0].totals.calories).toBe(2000)
  })
  it("plans only the meal types left after logged meals, against the remaining goals", async () => {
    db.meal.findMany.mockImplementation(async (args: { select?: unknown }) => args.select
      ? [{ loggedDate: new Date("2026-09-11T00:00:00Z"), type: "breakfast", calories: 500, protein: 20, carbs: 80, fat: 12, items: [{ id: "logged" }] }]
      : [])
    provider.generateStructuredJSON.mockResolvedValue({ data: { days: [{ date: "2026-09-11", meals: meals(["lunch", "dinner", "snack"]) }], notes: "" }, tokenUsage: 100 })
    const result = await generateMealPlan(profile, { date: "2026-09-11" })
    expect(result.days[0].targets).toEqual({ calories: 1500, protein: 60, carbs: 240, fat: 36 })
    expect(result.days[0].meals.map(meal => meal.type)).toEqual(["lunch", "dinner", "snack"])
    expect(provider.generateStructuredJSON.mock.calls[0][0].userPrompt).toContain("bữa lunch, dinner, snack")
  })
  it("builds multi-day plans with a shopping list summed across days", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: { days: [menu("2026-09-11").days[0], menu("2026-09-12").days[0]], notes: "" }, tokenUsage: 100 })
    const result = await generateMealPlan(profile, { date: "2026-09-11", days: 2 })
    expect(result.days.map(day => day.date)).toEqual(["2026-09-11", "2026-09-12"])
    expect(result.shoppingList).toEqual([expect.objectContaining({ foodId: id, amountValue: 1600, quantityLabel: "1600 g" })])
  })
  it("rejects a multi-day answer that skips a requested day", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: menu(), tokenUsage: 100 })
    await expect(generateMealPlan(profile, { date: "2026-09-11", days: 2 })).rejects.toMatchObject({ status: 422 })
  })
  it("keeps allergens out of the prompt and rejects them if the model picks one anyway", async () => {
    db.food.findMany.mockResolvedValue([rice, { ...rice, id: wrongId, name: "Tôm hấp" }])
    const allergic = { ...profile, foodAllergies: ["tôm"] } as SerializedProfile
    provider.generateStructuredJSON.mockResolvedValue({ data: menu(), tokenUsage: 100 })
    await generateMealPlan(allergic, { date: "2026-09-11" })
    expect(provider.generateStructuredJSON.mock.calls[0][0].userPrompt).not.toContain(wrongId)
    provider.generateStructuredJSON.mockReset()
    provider.generateStructuredJSON.mockResolvedValue({ data: { days: [{ date: "2026-09-11", meals: meals(undefined, 100, wrongId) }], notes: "" }, tokenUsage: 100 })
    await expect(generateMealPlan(allergic, { date: "2026-09-11" })).rejects.toMatchObject({ status: 422, code: "AI_UNAVAILABLE_FOOD" })
  })
  it("requires a calorie goal before any provider or database work", async () => {
    await expect(generateMealPlan({ ...profile, dailyCalorieGoal: 0 }, { date: "2026-09-11" })).rejects.toMatchObject({ status: 422 })
    expect(provider.generateStructuredJSON).not.toHaveBeenCalled()
    expect(db.aIGeneration.count).not.toHaveBeenCalled()
  })
  it.each(["schema", "calories"])("repairs an invalid meal once before persistence: %s", async defect => {
    const invalid = menu()
    if (defect === "schema") invalid.days[0].meals[0].items[0].foodId = "invalid-id"
    else invalid.days[0].meals.forEach(meal => meal.items.forEach(item => { item.amountValue = 10 }))
    provider.generateStructuredJSON.mockResolvedValueOnce({ data: invalid, tokenUsage: 100 })
      .mockResolvedValueOnce({ data: menu(), tokenUsage: 200 })
    const result = await generateMealPlan(profile, { date: "2026-09-11" })
    expect(result.days[0].totals.calories).toBe(2000)
    expect(provider.generateStructuredJSON).toHaveBeenCalledTimes(2)
    expect(db.aIGeneration.create).toHaveBeenCalledTimes(1)
    expect(db.aIGeneration.update).toHaveBeenCalledTimes(1)
    expect(db.aIGeneration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "completed", tokenUsage: 300 }) }))
  })
  it("stops after one failed repair without saving a partial plan", async () => {
    provider.generateStructuredJSON.mockResolvedValue({ data: { days: [] }, tokenUsage: 100 })
    await expect(generateMealPlan(profile, { date: "2026-09-11" })).rejects.toMatchObject({ status: 422 })
    expect(provider.generateStructuredJSON).toHaveBeenCalledTimes(2)
    expect(db.aIGeneration.update).toHaveBeenCalledTimes(1)
    expect(db.aIGeneration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("does not retry a provider outage as a data repair", async () => {
    provider.generateStructuredJSON.mockRejectedValue(new Error("provider unavailable"))
    await expect(generateMealPlan(profile, { date: "2026-09-11" })).rejects.toMatchObject({ status: 500 })
    expect(provider.generateStructuredJSON).toHaveBeenCalledTimes(1)
  })
  it.each(["unknown-food", "bad-unit", "empty", "duplicate-meal", "bad-amount", "calorie-target"])("rejects meal defect: %s", async defect => {
    const data = menu()
    const day = data.days[0]
    if (defect === "unknown-food") day.meals[0].items[0].foodId = wrongId
    if (defect === "bad-unit") day.meals[0].items[0].amountUnit = "ml"
    if (defect === "empty") day.meals[0].items = []
    if (defect === "duplicate-meal") day.meals[1].type = "breakfast"
    if (defect === "bad-amount") day.meals[0].items[0].amountValue = -1
    if (defect === "calorie-target") day.meals.forEach(meal => meal.items.forEach(item => { item.amountValue = 10 }))
    provider.generateStructuredJSON.mockResolvedValue({ data, tokenUsage: 100 })
    await expect(generateMealPlan(profile, { date: "2026-09-11" })).rejects.toMatchObject({ status: 422 })
    expect(db.aIGeneration.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })
  it("swaps one meal for different foods and keeps the day on target", async () => {
    const noodles = { ...rice, id: noodleId, name: "Noodles" }
    db.food.findMany.mockResolvedValue([rice, noodles])
    provider.generateStructuredJSON.mockResolvedValue({ data: menu(), tokenUsage: 100 })
    await generateMealPlan(profile, { date: "2026-09-11" })
    const saved = db.aIGeneration.update.mock.calls[0][0].data
    db.aIGeneration.findUnique.mockResolvedValue({ id: "draft", userId: profile.id, type: "meal_plan", status: "completed", output: saved.output, tokenUsage: 100 })
    db.aIGeneration.updateMany.mockResolvedValue({ count: 1 })
    provider.generateStructuredJSON.mockReset()
    provider.generateStructuredJSON.mockResolvedValue({ data: meals(["lunch"], 100, noodleId)[0], tokenUsage: 50 })

    const result = await regenerateAIMealPlanMeal(profile, { generationId: "draft", date: "2026-09-11", mealType: "lunch" })

    expect(result.days[0].meals[1].items.every(item => item.foodId === noodleId)).toBe(true)
    expect(result.days[0].totals.calories).toBe(2000)
    expect(provider.generateStructuredJSON.mock.calls[0][0].userPrompt).not.toContain(`"id":"${id}"`)
    expect(db.aIGeneration.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "completed" }), data: expect.objectContaining({ tokenUsage: 150 }) }))
  })
  it("blocks invalid service/tool inputs before provider or database work", async () => {
    await expect(generateMealPlan(profile, { date: "2026-02-30" })).rejects.toMatchObject({ status: 400 })
    await expect(generateMealPlan(profile, { date: "2026-09-11", days: 8 })).rejects.toMatchObject({ status: 400 })
    await expect(generateWorkoutProgram(profile, { ...input, availableEquipment: "invented" })).rejects.toMatchObject({ status: 400 })
    expect(provider.generateStructuredJSON).not.toHaveBeenCalled()
    expect(db.aIGeneration.count).not.toHaveBeenCalled()
  })
})
