import { MealStatus, NutrientSource, type Nutrient, type Prisma, type PrismaClient } from "@prisma/client"

import { libraryCache } from "../lib/library-cache"
import { buildNutrientTargets, type NutrientTarget } from "../lib/nutrition/nutrient-targets"
import { addNutrients, NUTRIENT_CODES, parseNutrientAmounts, roundNutrientAmount, type NutrientAmounts, type NutrientCode } from "../lib/nutrition/nutrients"
import type { SerializedProfile } from "./auth.service"

type Db = PrismaClient | Prisma.TransactionClient

/** Who the targets are for; coaches read a trainee's day with the trainee's profile. */
type IntakeOwner = Pick<SerializedProfile, "id" | "dailyCalorieGoal"> & Partial<Pick<SerializedProfile, "sex" | "birthDate">>

const NUTRIENT_CATALOG_KEY = "nutrition:nutrient-catalog"
const NUTRIENT_CATALOG_TTL_MS = 30 * 60_000

/** The catalog changes only by migration, so it is cached like the food library. */
function loadNutrientCatalog(db: Db): Promise<Nutrient[]> {
  return libraryCache.getOrLoad(NUTRIENT_CATALOG_KEY, NUTRIENT_CATALOG_TTL_MS, () =>
    db.nutrient.findMany({ orderBy: { sortOrder: "asc" } }),
  )
}

type IntakeItem = { foodId: string; nutrients: Prisma.JsonValue | null }

/**
 * Adds up the snapshots on logged items. Items without a snapshot are counted,
 * not treated as zero, so the UI can say how much of the day it can see.
 */
function sumItemNutrients(items: IntakeItem[]) {
  const amounts: NutrientAmounts = {}
  let itemsWithData = 0
  for (const item of items) {
    const snapshot = parseNutrientAmounts(item.nutrients)
    if (Object.keys(snapshot).length === 0) continue
    itemsWithData += 1
    addNutrients(amounts, snapshot)
  }
  return { amounts, coverage: { items: items.length, itemsWithData } }
}

type MicronutrientLine = {
  code: NutrientCode
  nameVi: string
  nameEn: string
  unit: string
  kind: Nutrient["kind"]
  isLimit: boolean
  amount: number | null
  target: NutrientTarget | null
}

function buildMicronutrientLines(catalog: Nutrient[], amounts: NutrientAmounts, targets: ReturnType<typeof buildNutrientTargets>): MicronutrientLine[] {
  return catalog
    .filter((nutrient): nutrient is Nutrient & { code: NutrientCode } => (NUTRIENT_CODES as readonly string[]).includes(nutrient.code))
    .map((nutrient) => {
      const amount = amounts[nutrient.code]
      return {
        amount: amount == null ? null : roundNutrientAmount(amount),
        code: nutrient.code,
        isLimit: nutrient.isLimit,
        kind: nutrient.kind,
        nameEn: nutrient.nameEn,
        nameVi: nutrient.nameVi,
        target: targets[nutrient.code] ?? null,
        unit: nutrient.unit,
      }
    })
}

/** True when any of these foods has a nutrient number that came from an AI estimate. */
async function hasAIEstimatedNutrients(db: Db, foodIds: string[]) {
  if (foodIds.length === 0) return false
  const row = await db.foodNutrient.findFirst({
    select: { foodId: true },
    where: { foodId: { in: [...new Set(foodIds)] }, source: NutrientSource.ai },
  })
  return row != null
}

/** Micronutrient section of one day's nutrition response. */
async function buildDayMicronutrients(db: Db, owner: IntakeOwner, items: IntakeItem[], today = new Date()) {
  const [catalog, aiEstimated] = await Promise.all([loadNutrientCatalog(db), hasAIEstimatedNutrients(db, items.map((item) => item.foodId))])
  const { amounts, coverage } = sumItemNutrients(items)
  const targets = buildNutrientTargets(owner, today)
  return {
    fiber: { amount: amounts.fiber == null ? 0 : roundNutrientAmount(amounts.fiber), target: targets.fiber?.amount ?? 0 },
    micronutrients: buildMicronutrientLines(catalog, amounts, targets),
    nutrientCoverage: { ...coverage, aiEstimated },
  }
}

type DayIntake = {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  nutrients: NutrientAmounts
  items: number
  itemsWithData: number
}

/**
 * Per-day totals for the `days` days ending on `endDate` (a UTC date-key
 * instant, like `Meal.loggedDate`), plus averages over the days that have any
 * log. Averaging over empty days would call a trainee who skipped logging
 * "deficient".
 */
async function getIntakeSummary(db: Db, userId: string, endDate: Date, days = 7) {
  const start = new Date(endDate.getTime() - (days - 1) * 86_400_000)
  const meals = await db.meal.findMany({
    select: {
      calories: true,
      carbs: true,
      fat: true,
      items: { select: { foodId: true, nutrients: true } },
      loggedDate: true,
      protein: true,
    },
    where: { loggedDate: { gte: start, lte: endDate }, status: MealStatus.consumed, userId },
  })

  const byDate = new Map<string, DayIntake>()
  for (const meal of meals) {
    const date = meal.loggedDate.toISOString().slice(0, 10)
    const day = byDate.get(date) ?? { calories: 0, carbs: 0, date, fat: 0, items: 0, itemsWithData: 0, nutrients: {}, protein: 0 }
    day.calories += meal.calories
    day.protein += meal.protein ?? 0
    day.carbs += meal.carbs ?? 0
    day.fat += meal.fat ?? 0
    const { amounts, coverage } = sumItemNutrients(meal.items)
    addNutrients(day.nutrients, amounts)
    day.items += coverage.items
    day.itemsWithData += coverage.itemsWithData
    byDate.set(date, day)
  }

  const loggedDays = [...byDate.values()].filter((day) => day.items > 0).sort((left, right) => left.date.localeCompare(right.date))
  const average = { calories: 0, carbs: 0, fat: 0, nutrients: {} as NutrientAmounts, protein: 0 }
  const nutrientDays: Partial<Record<NutrientCode, number>> = {}

  for (const day of loggedDays) {
    average.calories += day.calories / loggedDays.length
    average.protein += day.protein / loggedDays.length
    average.carbs += day.carbs / loggedDays.length
    average.fat += day.fat / loggedDays.length
    for (const code of NUTRIENT_CODES) {
      if (day.nutrients[code] != null) nutrientDays[code] = (nutrientDays[code] ?? 0) + 1
    }
    addNutrients(average.nutrients, day.nutrients)
  }
  // Each nutrient averages over the days it was actually measured on.
  for (const code of NUTRIENT_CODES) {
    const total = average.nutrients[code]
    const count = nutrientDays[code]
    if (total != null && count) average.nutrients[code] = roundNutrientAmount(total / count)
  }

  return { average, days: loggedDays, loggedDays: loggedDays.length, windowDays: days }
}

export {
  buildDayMicronutrients,
  buildMicronutrientLines,
  getIntakeSummary,
  loadNutrientCatalog,
  sumItemNutrients,
  type DayIntake,
  type IntakeOwner,
  type MicronutrientLine,
}
