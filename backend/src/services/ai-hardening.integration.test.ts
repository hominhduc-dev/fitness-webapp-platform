import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"
import type { SerializedProfile } from "./auth.service"

const fault = vi.hoisted(() => ({ failSecond: false, calls: 0 }))
vi.mock("./nutrition.service", async importOriginal => {
  const actual = await importOriginal<typeof import("./nutrition.service")>()
  return { ...actual, addMealItemForUser: (...args: Parameters<typeof actual.addMealItemForUser>) => {
    fault.calls += 1
    if (fault.failSecond && fault.calls === 2) throw new Error("Injected failure after first item")
    return actual.addMealItemForUser(...args)
  } }
})
import { prisma } from "../lib/prisma"
import { acceptAIProgram, acceptAIMealPlan, acceptDailyWorkout } from "./ai.service"
import { buildNutritionContext } from "./ai/context/nutrition-context"
import { buildProgressionContext } from "./ai/context/progression-context"

// Opt-in only, and refuse any non-local/non-disposable database URL.
const testUrl = process.env.AI_TEST_DATABASE_URL
if (testUrl) {
  const url = new URL(testUrl)
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ai_hardening_test" || process.env.DATABASE_URL !== testUrl) {
    throw new Error("Integration tests require the dedicated local ai_hardening_test database")
  }
}
const db = prisma!
const asJson = (value: unknown) => value as Prisma.InputJsonValue
describe.skipIf(!testUrl)("AI acceptance with real PostgreSQL transactions", () => {
  let profile: SerializedProfile
  let variationId: string
  let foodId: string
  const date = "2026-09-11"
  const input = { goal: "strength", experienceLevel: "beginner", availableEquipment: "bodyweight", daysPerWeek: 2, durationWeeks: 1, sessionDuration: 30 }
  beforeEach(async () => {
    fault.calls = 0; fault.failSecond = false
    const id = randomUUID()
    const user = await db.user.create({ data: { id, name: "AI test", email: `${id}@example.invalid`, role: "trainee", dailyCalorieGoal: 2000 } })
    profile = user as unknown as SerializedProfile
    const exercise = await db.exercise.create({ data: { name: "Test squat", muscleGroup: "Legs", createdById: id, variations: { create: { name: "Default", equipment: "Bodyweight" } } }, include: { variations: true } })
    variationId = exercise.variations[0].id
    const food = await db.food.create({ data: { name: "Test rice", slug: id, category: "staple", source: "user", createdById: id, calories: 250, protein: 10, carbs: 40, fat: 6, servingLabel: "100 g", servingAmount: 100, servingUnit: "g" } })
    foodId = food.id
  })
  afterEach(async () => {
    fault.failSecond = false
    if (profile) {
      // Remove only this test's fixtures. Never truncate shared tables.
      await db.program.deleteMany({ where: { createdById: profile.id } })
      await db.meal.deleteMany({ where: { userId: profile.id } })
      await db.food.deleteMany({ where: { createdById: profile.id } })
      await db.exercise.deleteMany({ where: { createdById: profile.id } })
      await db.user.delete({ where: { id: profile.id } })
    }
  })
  afterAll(async () => { await db.$disconnect() })

  async function programDraft(daily = false) {
    const exercise = { variationId, sets: 3, repsMin: 30 }
    const workout = { name: "Full Body Day", kind: "full_body", duration: 30, exercises: [exercise] }
    return db.aIGeneration.create({ data: {
      userId: profile.id, type: "workout_program", status: "completed", input: asJson(daily ? { ...input, date, energyLevel: "normal", mode: "daily" } : input),
      output: asJson(daily ? { mode: "daily", mapped: { ...workout, date, warmup: "Warmup", description: "", difficulty: "beginner" } } : { mapped: { name: "Program", description: "", difficulty: "beginner", duration: 1, workoutsPerWeek: 2, workouts: [1, 3].map(scheduledDay => ({ ...workout, weekIndex: 0, scheduledDay })) } }),
    } })
  }
  async function mealDraft() {
    return db.aIGeneration.create({ data: { userId: profile.id, type: "meal_plan", status: "completed", input: { date }, output: asJson({ mapped: ["breakfast", "lunch", "dinner", "snack"].map(type => ({ type, suggestion: "", items: [1, 2].map(() => ({ foodId, amountValue: 100, amountUnit: "g" })) })) }) } })
  }

  it.each([false, true])("concurrent program/daily accept writes once (daily=%s)", async daily => {
    const draft = await programDraft(daily)
    const accept = daily ? acceptDailyWorkout : acceptAIProgram
    const results = await Promise.allSettled([accept(profile, draft.id), accept(profile, draft.id)])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    expect(await db.program.count({ where: { createdById: profile.id } })).toBe(1)
    const sets = await db.exerciseSet.findMany({ where: { workoutExercise: { workout: { program: { createdById: profile.id } } } } })
    expect(sets).toHaveLength(daily ? 3 : 6)
    expect(sets.every(set => set.targetReps === 30)).toBe(true)
  })
  it("concurrent meal accept appends exactly eight items and correct totals", async () => {
    const draft = await mealDraft()
    const results = await Promise.allSettled([acceptAIMealPlan(profile, draft.id, date), acceptAIMealPlan(profile, draft.id, date)])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    const meals = await db.meal.findMany({ where: { userId: profile.id }, include: { items: true } })
    expect(meals.flatMap(m => m.items)).toHaveLength(8)
    expect(meals.reduce((sum, meal) => sum + meal.calories, 0)).toBe(2000)
    expect((await db.aIGeneration.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("accepted")
  })
  it("failure after the first item rolls back all meals and the claim; retry works", async () => {
    const draft = await mealDraft()
    fault.failSecond = true
    await expect(acceptAIMealPlan(profile, draft.id, date)).rejects.toThrow("Injected failure")
    expect(await db.meal.count({ where: { userId: profile.id } })).toBe(0)
    expect((await db.aIGeneration.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("completed")
    fault.failSecond = false
    await expect(acceptAIMealPlan(profile, draft.id, date)).resolves.toMatchObject({ accepted: true, logged: 8, skipped: 0 })
  })
  it("two distinct drafts targeting the same meals preserve all item totals", async () => {
    const drafts = await Promise.all([mealDraft(), mealDraft()])
    await Promise.all(drafts.map(draft => acceptAIMealPlan(profile, draft.id, date)))
    const meals = await db.meal.findMany({ where: { userId: profile.id }, include: { items: true } })
    expect(meals.flatMap(m => m.items)).toHaveLength(16)
    expect(meals.reduce((sum, m) => sum + m.calories, 0)).toBe(4000)
  })
  it("rejects stale food and wrong generation types without consuming the draft", async () => {
    const draft = await mealDraft()
    await expect(acceptAIProgram(profile, draft.id)).rejects.toMatchObject({ status: 400 })
    await expect(acceptDailyWorkout(profile, draft.id)).rejects.toMatchObject({ status: 400 })
    await expect(acceptAIMealPlan({ ...profile, id: randomUUID() }, draft.id, date)).rejects.toMatchObject({ status: 404 })
    await db.food.delete({ where: { id: foodId } })
    await expect(acceptAIMealPlan(profile, draft.id, date)).rejects.toMatchObject({ status: 422 })
    expect((await db.aIGeneration.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("completed")
  })
  it("excludes future meals and uses the Vietnamese day at UTC midnight boundaries", async () => {
    await db.meal.createMany({ data: [
      { userId: profile.id, name: "Today", type: "breakfast", loggedDate: new Date("2026-09-11T00:00:00Z"), recordedAt: new Date(), calories: 500 },
      { userId: profile.id, name: "Future", type: "breakfast", loggedDate: new Date("2026-09-12T00:00:00Z"), recordedAt: new Date(), calories: 9000 },
    ] })
    const context = await buildNutritionContext(db, profile, new Date("2026-09-10T17:05:00Z"))
    expect(context?.content).toContain("2026-09-11")
    expect(context?.content).toContain("500 / 2000")
    expect(context?.content).not.toContain("9.000")
    expect(context?.content).toContain("log 1/14")
  })
  it("progression uses completed actual snapshots, excluding future and unfinished logs", async () => {
    for (const [day, weight, completed] of [[8, 20, true], [9, 30, true], [10, 900, false], [12, 1000, true]] as const) {
      const startedAt = new Date(`2026-09-${String(day).padStart(2, "0")}T08:00:00Z`)
      await db.workoutLog.create({ data: { userId: profile.id, startedAt, completedAt: completed ? startedAt : null, exerciseSnapshot: [{ exercise: { name: "Squat" }, variation: { name: "Default" }, sets: [{ weight, actualReps: 8, targetReps: 99, completed: true }] }] } })
    }
    const context = await buildProgressionContext(db, profile, new Date("2026-09-11T12:00:00Z"))
    expect(context?.content).toContain("20,0kgx8")
    expect(context?.content).toContain("30,0kgx8")
    expect(context?.content).not.toContain("900")
    expect(context?.content).not.toContain("1.000")
    expect(context?.content).toContain("2 set")
  })
})
