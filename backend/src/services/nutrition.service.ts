import { FoodCategory, FoodSource, MealType } from "@prisma/client"

import { buildFoodSlug, parseServingLabel, roundNutrition } from "../lib/nutrition/food-utils"
import { prisma } from "../lib/prisma"
import { AuthServiceError, type SerializedProfile } from "./auth.service"
import { MEAL_WITH_FOOD_INCLUDE, serializeMealRecord, type MealWithFoodRecord } from "./meal-log.service"

const DEFAULT_CALORIE_TARGET = 2500

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Bữa sáng",
  dinner: "Bữa tối",
  lunch: "Bữa trưa",
  snack: "Ăn vặt",
}

const MEAL_ORDER: MealType[] = [MealType.breakfast, MealType.lunch, MealType.dinner, MealType.snack]

type NutritionTotals = {
  calories: number
  carbs: number
  fat: number
  fiber: number
  protein: number
  sodium: number
  sugar: number
}

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function emptyTotals(): NutritionTotals {
  return {
    calories: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    protein: 0,
    sodium: 0,
    sugar: 0,
  }
}

function parseDateKey(value?: unknown) {
  if (value == null || value === "") {
    return new Date(new Date().toISOString().slice(0, 10))
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AuthServiceError("date phải có định dạng YYYY-MM-DD.", 400)
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new AuthServiceError("date không hợp lệ.", 400)
  }

  return parsed
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function parseMealType(value: unknown) {
  if (value == null) {
    return MealType.breakfast
  }

  if (!Object.values(MealType).includes(value as MealType)) {
    throw new AuthServiceError("mealType không hợp lệ.", 400)
  }

  return value as MealType
}

function parseFoodCategory(value: unknown) {
  if (value == null || value === "" || value === "all") {
    return undefined
  }

  if (!Object.values(FoodCategory).includes(value as FoodCategory)) {
    throw new AuthServiceError("category không hợp lệ.", 400)
  }

  return value as FoodCategory
}

function parsePositiveNumber(value: unknown, field: string, max = 10000) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthServiceError(`${field} phải lớn hơn 0.`, 400)
  }

  if (parsed > max) {
    throw new AuthServiceError(`${field} không được vượt quá ${max}.`, 400)
  }

  return parsed
}

function parseOptionalMacro(value: unknown) {
  if (value == null || value === "") {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AuthServiceError("Giá trị dinh dưỡng không hợp lệ.", 400)
  }

  return roundNutrition(parsed)
}

function sanitizeText(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new AuthServiceError(`${field} không hợp lệ.`, 400)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new AuthServiceError(`${field} không được để trống.`, 400)
  }

  return trimmed
}

function sumItems(items: Array<Partial<Record<keyof NutritionTotals, number | null>>>) {
  return items.reduce<NutritionTotals>((totals, item) => {
    totals.calories += item.calories ?? 0
    totals.carbs += item.carbs ?? 0
    totals.fat += item.fat ?? 0
    totals.fiber += item.fiber ?? 0
    totals.protein += item.protein ?? 0
    totals.sodium += item.sodium ?? 0
    totals.sugar += item.sugar ?? 0
    return totals
  }, emptyTotals())
}

function serializeFood(food: {
  calories: number
  carbs: number | null
  category: FoodCategory
  fat: number | null
  fiber?: number | null
  id: string
  name: string
  protein: number | null
  servingAmount: number
  servingLabel: string
  servingUnit: string
  slug: string
  sodium?: number | null
  source: FoodSource
  sugar?: number | null
}) {
  return {
    calories: food.calories,
    carbs: food.carbs ?? 0,
    category: food.category,
    fat: food.fat ?? 0,
    fiber: food.fiber ?? undefined,
    id: food.id,
    name: food.name,
    protein: food.protein ?? 0,
    servingAmount: food.servingAmount,
    servingLabel: food.servingLabel,
    servingUnit: food.servingUnit,
    slug: food.slug,
    sodium: food.sodium ?? undefined,
    source: food.source,
    sugar: food.sugar ?? undefined,
  }
}

function emptyMealSection(type: MealType) {
  return {
    calories: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    id: undefined,
    items: [],
    name: MEAL_LABELS[type],
    protein: 0,
    sodium: 0,
    sugar: 0,
    type,
  }
}

function serializeMealSection(meal: MealWithFoodRecord) {
  const serialized = serializeMealRecord(meal)

  return {
    ...serialized,
    carbs: serialized.carbs ?? 0,
    fat: serialized.fat ?? 0,
    fiber: serialized.fiber ?? 0,
    protein: serialized.protein ?? 0,
    sodium: serialized.sodium ?? 0,
    sugar: serialized.sugar ?? 0,
  }
}

function buildTargets(profile: SerializedProfile) {
  return {
    calories: profile.dailyCalorieGoal ?? DEFAULT_CALORIE_TARGET,
    carbs: profile.dailyCarbsGoal ?? 280,
    fat: profile.dailyFatGoal ?? 70,
    protein: profile.dailyProteinGoal ?? 140,
  }
}

async function listRecentFoodsForUser(profile: SerializedProfile) {
  const db = ensurePrisma()
  const recentItems = await db.mealFoodItem.findMany({
    include: {
      food: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 40,
    where: {
      meal: {
        userId: profile.id,
      },
    },
  })
  const seenFoodIds = new Set<string>()
  const foods: Array<ReturnType<typeof serializeFood>> = []

  for (const item of recentItems) {
    if (seenFoodIds.has(item.foodId)) {
      continue
    }

    seenFoodIds.add(item.foodId)
    foods.push(serializeFood(item.food))

    if (foods.length >= 10) {
      break
    }
  }

  return foods
}

async function listNutritionDayForUser(profile: SerializedProfile, rawDate?: unknown) {
  const db = ensurePrisma()
  const loggedDate = parseDateKey(rawDate)
  const [meals, recentFoods] = await Promise.all([
    db.meal.findMany({
      include: MEAL_WITH_FOOD_INCLUDE,
      orderBy: {
        type: "asc",
      },
      where: {
        loggedDate,
        userId: profile.id,
      },
    }),
    listRecentFoodsForUser(profile),
  ])
  const mealsByType = new Map(meals.map((meal) => [meal.type, meal]))
  const sections = MEAL_ORDER.map((type) => {
    const meal = mealsByType.get(type)
    return meal ? serializeMealSection(meal as MealWithFoodRecord) : emptyMealSection(type)
  })
  const totals = sumItems(sections)

  return {
    date: formatDateKey(loggedDate),
    meals: sections,
    recentFoods,
    targets: buildTargets(profile),
    totals: {
      calories: roundNutrition(totals.calories, 0),
      carbs: roundNutrition(totals.carbs),
      fat: roundNutrition(totals.fat),
      fiber: roundNutrition(totals.fiber),
      protein: roundNutrition(totals.protein),
      sodium: roundNutrition(totals.sodium, 0),
      sugar: roundNutrition(totals.sugar),
    },
  }
}

async function listFoodsForUser(profile: SerializedProfile, options?: { category?: unknown; query?: unknown }) {
  const db = ensurePrisma()
  const query = typeof options?.query === "string" ? options.query.trim() : ""
  const category = parseFoodCategory(options?.category)
  const foods = await db.food.findMany({
    orderBy: [{ source: "asc" }, { name: "asc" }],
    take: 80,
    where: {
      AND: [
        category ? { category } : {},
        query
          ? {
              name: {
                contains: query,
                mode: "insensitive",
              },
            }
          : {},
        {
          OR: [
            { source: FoodSource.system },
            {
              createdById: profile.id,
              source: FoodSource.user,
            },
          ],
        },
      ],
    },
  })

  return foods.map(serializeFood)
}

async function createFoodForUser(profile: SerializedProfile, input: Record<string, unknown>) {
  const db = ensurePrisma()
  const name = sanitizeText(input.name, "Tên món")
  const category = parseFoodCategory(input.category) ?? FoodCategory.dish
  const servingLabel = sanitizeText(input.servingLabel, "Khẩu phần")
  const serving = parseServingLabel(servingLabel)
  const calories = parsePositiveNumber(input.calories, "Calo", 10000)
  const protein = parseOptionalMacro(input.protein) ?? 0
  const carbs = parseOptionalMacro(input.carbs) ?? 0
  const fat = parseOptionalMacro(input.fat) ?? 0
  const slug = buildFoodSlug(name, { userId: profile.id })

  const food = await db.food.upsert({
    create: {
      calories: roundNutrition(calories),
      carbs,
      category,
      createdById: profile.id,
      fat,
      name,
      protein,
      servingAmount: serving.servingAmount,
      servingLabel,
      servingUnit: serving.servingUnit,
      slug,
      source: FoodSource.user,
    },
    update: {
      calories: roundNutrition(calories),
      carbs,
      category,
      fat,
      name,
      protein,
      servingAmount: serving.servingAmount,
      servingLabel,
      servingUnit: serving.servingUnit,
      source: FoodSource.user,
    },
    where: {
      slug,
    },
  })

  return serializeFood(food)
}

function calculateItemNutrition(
  food: {
    calories: number
    carbs: number | null
    fat: number | null
    fiber: number | null
    protein: number | null
    servingAmount: number
    servingUnit: string
    sodium: number | null
    sugar: number | null
  },
  input: {
    amountUnit: string
    amountValue: number
  },
) {
  const amountUnit = input.amountUnit === "g" || input.amountUnit === "ml" ? input.amountUnit : "serving"
  const multiplier =
    amountUnit !== "serving" && food.servingUnit === amountUnit && food.servingAmount > 0
      ? input.amountValue / food.servingAmount
      : input.amountValue
  const amountLabel = amountUnit === "serving" ? (input.amountValue === 1 ? undefined : `×${input.amountValue}`) : `${input.amountValue} ${amountUnit}`

  return {
    amountLabel,
    amountUnit,
    calories: roundNutrition(food.calories * multiplier),
    carbs: roundNutrition((food.carbs ?? 0) * multiplier),
    fat: roundNutrition((food.fat ?? 0) * multiplier),
    fiber: food.fiber == null ? undefined : roundNutrition(food.fiber * multiplier),
    protein: roundNutrition((food.protein ?? 0) * multiplier),
    quantity: roundNutrition(multiplier, 4),
    sodium: food.sodium == null ? undefined : roundNutrition(food.sodium * multiplier, 0),
    sugar: food.sugar == null ? undefined : roundNutrition(food.sugar * multiplier),
    weightGrams: amountUnit === "g" ? input.amountValue : undefined,
  }
}

async function recalculateMeal(mealId: string) {
  const db = ensurePrisma()
  const items = await db.mealFoodItem.findMany({
    select: {
      calories: true,
      carbs: true,
      fat: true,
      fiber: true,
      protein: true,
      sodium: true,
      sugar: true,
    },
    where: {
      mealId,
    },
  })
  const totals = sumItems(items)

  return db.meal.update({
    data: {
      calories: roundNutrition(totals.calories),
      carbs: roundNutrition(totals.carbs),
      fat: roundNutrition(totals.fat),
      fiber: roundNutrition(totals.fiber),
      protein: roundNutrition(totals.protein),
      sodium: roundNutrition(totals.sodium, 0),
      sugar: roundNutrition(totals.sugar),
    },
    include: MEAL_WITH_FOOD_INCLUDE,
    where: {
      id: mealId,
    },
  })
}

async function addMealItemForUser(profile: SerializedProfile, input: Record<string, unknown>) {
  const db = ensurePrisma()
  const loggedDate = parseDateKey(input.date)
  const type = parseMealType(input.mealType)
  const foodId = sanitizeText(input.foodId, "foodId")
  const amountValue = parsePositiveNumber(input.amountValue, "amountValue", 5000)
  const amountUnit = typeof input.amountUnit === "string" ? input.amountUnit.trim().toLowerCase() : "serving"
  const food = await db.food.findFirst({
    where: {
      id: foodId,
      OR: [
        { source: FoodSource.system },
        {
          createdById: profile.id,
          source: FoodSource.user,
        },
      ],
    },
  })

  if (!food) {
    throw new AuthServiceError("Không tìm thấy món ăn.", 404)
  }

  const calculated = calculateItemNutrition(food, { amountUnit, amountValue })
  const meal = await db.meal.upsert({
    create: {
      calories: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      loggedDate,
      name: MEAL_LABELS[type],
      protein: 0,
      recordedAt: new Date(),
      sodium: 0,
      sugar: 0,
      type,
      userId: profile.id,
    },
    update: {
      name: MEAL_LABELS[type],
    },
    where: {
      userId_loggedDate_type: {
        loggedDate,
        type,
        userId: profile.id,
      },
    },
  })

  await db.mealFoodItem.create({
    data: {
      amountLabel: calculated.amountLabel,
      amountUnit: calculated.amountUnit,
      amountValue,
      calories: calculated.calories,
      carbs: calculated.carbs,
      fat: calculated.fat,
      fiber: calculated.fiber,
      foodId: food.id,
      foodNameSnapshot: food.name,
      mealId: meal.id,
      protein: calculated.protein,
      quantity: calculated.quantity,
      sodium: calculated.sodium,
      sugar: calculated.sugar,
      weightGrams: calculated.weightGrams,
    },
  })

  return serializeMealSection((await recalculateMeal(meal.id)) as MealWithFoodRecord)
}

async function deleteMealItemForUser(profile: SerializedProfile, itemId: string) {
  const db = ensurePrisma()
  const item = await db.mealFoodItem.findFirst({
    include: {
      meal: true,
    },
    where: {
      id: itemId,
      meal: {
        userId: profile.id,
      },
    },
  })

  if (!item) {
    throw new AuthServiceError("Không tìm thấy món trong bữa ăn.", 404)
  }

  await db.mealFoodItem.delete({
    where: {
      id: itemId,
    },
  })

  return serializeMealSection((await recalculateMeal(item.mealId)) as MealWithFoodRecord)
}

export {
  addMealItemForUser,
  createFoodForUser,
  deleteMealItemForUser,
  listFoodsForUser,
  listNutritionDayForUser,
}
