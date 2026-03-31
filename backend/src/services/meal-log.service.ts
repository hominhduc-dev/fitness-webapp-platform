import { FoodNutrientKey, FoodSource, MealType, Prisma } from "@prisma/client"

import { prisma } from "../lib/prisma"
import { calculateMealNutrition, type NutrientAmountMap } from "../lib/meal-log/nutrition-calculator"
import { hasRequiredMealNutrients, parseUsdaFoodNutrients } from "../lib/meal-log/nutrient-parser"
import { resolveFoodSearchQuery, type QueryKind } from "../lib/meal-log/vietnamese-food-map"
import { AuthServiceError, type SerializedProfile } from "./auth.service"
import { getFoodDetail, searchFoods, type UsdaFoodDetail, type UsdaSearchFood } from "./usda-food.service"

const MEAL_WITH_FOOD_INCLUDE = {
  food: {
    select: {
      fdcId: true,
    },
  },
} satisfies Prisma.MealInclude

type FoodWithNutrientsRecord = Prisma.FoodGetPayload<{
  include: {
    nutrients: true
  }
}>

type MealWithFoodRecord = Prisma.MealGetPayload<{
  include: typeof MEAL_WITH_FOOD_INCLUDE
}>

type FoodSearchResult = {
  brandOwner?: string
  canLogByGram?: boolean
  dataType?: string
  fdcId: number
  logWarning?: string
  name: string
  nutritionPreview?: {
    calories?: number
    carbs?: number
    fat?: number
    fiber?: number
    protein?: number
    sodium?: number
    sugar?: number
  }
}

type FoodSearchResponse = {
  meta: {
    queryKind: QueryKind
    queryMapped?: string
    queryNormalized: string
    queryOriginal: string
    resolvedQuery: string
    searchFallbackUsed: boolean
  }
  results: FoodSearchResult[]
}

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function parseFdcId(value: unknown) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AuthServiceError("fdcId không hợp lệ.", 400)
  }

  return parsed
}

function parseWeightGrams(value: unknown) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthServiceError("weightGrams phải lớn hơn 0.", 400)
  }

  if (parsed > 5000) {
    throw new AuthServiceError("weightGrams không được vượt quá 5000g.", 400)
  }

  return parsed
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

function parseEatenAt(value: unknown) {
  if (value == null) {
    return new Date()
  }

  if (typeof value !== "string") {
    throw new AuthServiceError("eatenAt không hợp lệ.", 400)
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new AuthServiceError("eatenAt không hợp lệ.", 400)
  }

  return parsed
}

function normalizeDataType(value?: string | null) {
  return (value ?? "").toLowerCase()
}

function getSearchBoostScore(queryKind: QueryKind, dataType?: string | null) {
  const normalized = normalizeDataType(dataType)

  if (queryKind === "branded") {
    if (normalized === "branded") {
      return 30
    }

    if (normalized === "foundation" || normalized === "sr legacy" || normalized.includes("survey")) {
      return 5
    }

    return 0
  }

  if (normalized === "foundation") {
    return 30
  }

  if (normalized === "sr legacy") {
    return 20
  }

  if (normalized.includes("survey")) {
    return 10
  }

  if (normalized === "branded") {
    return 0
  }

  return 0
}

function sortUsdaSearchResults(results: UsdaSearchFood[], queryKind: QueryKind) {
  return results
    .map((result, index) => ({
      index,
      result,
      score: getSearchBoostScore(queryKind, result.dataType),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map((entry) => entry.result)
}

function serializeSearchResult(result: UsdaSearchFood): FoodSearchResult {
  const parsed = parseUsdaFoodNutrients(result)
  const isUnsupportedBrandedServing =
    normalizeDataType(result.dataType) === "branded" && parsed.normalizationIssue === "unsupported_serving_size_unit"
  const nutrientAmountMap = parsed.nutrients.reduce<NutrientAmountMap>((accumulator, nutrient) => {
    accumulator[nutrient.nutrientKey] = nutrient.amountPer100g
    return accumulator
  }, {})

  return {
    brandOwner: result.brandOwner ?? undefined,
    canLogByGram: isUnsupportedBrandedServing ? false : undefined,
    dataType: result.dataType ?? undefined,
    fdcId: result.fdcId,
    logWarning: isUnsupportedBrandedServing
      ? "This branded USDA item does not expose a gram-based serving size, so it cannot be logged by grams in the current MVP."
      : undefined,
    name: result.description,
    nutritionPreview:
      parsed.nutrients.length > 0
        ? {
            calories: nutrientAmountMap[FoodNutrientKey.calories],
            carbs: nutrientAmountMap[FoodNutrientKey.carbs],
            fat: nutrientAmountMap[FoodNutrientKey.fat],
            fiber: nutrientAmountMap[FoodNutrientKey.fiber],
            protein: nutrientAmountMap[FoodNutrientKey.protein],
            sodium: nutrientAmountMap[FoodNutrientKey.sodium],
            sugar: nutrientAmountMap[FoodNutrientKey.sugar],
          }
        : undefined,
  }
}

function serializeMealRecord(meal: MealWithFoodRecord) {
  const parsedFdcId = meal.food?.fdcId ? Number(meal.food.fdcId) : undefined

  return {
    calories: meal.calories,
    carbs: meal.carbs ?? undefined,
    fat: meal.fat ?? undefined,
    fdcId: Number.isFinite(parsedFdcId) ? parsedFdcId : undefined,
    fiber: meal.fiber ?? undefined,
    foodId: meal.foodId ?? undefined,
    id: meal.id,
    name: meal.foodNameSnapshot ?? meal.name,
    protein: meal.protein ?? undefined,
    sodium: meal.sodium ?? undefined,
    sugar: meal.sugar ?? undefined,
    time: meal.recordedAt,
    type: meal.type,
    weightGrams: meal.weightGrams ?? undefined,
  }
}

async function searchFoodsForUser(query: string): Promise<FoodSearchResponse> {
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    throw new AuthServiceError("Vui lòng nhập tên món ăn để tìm kiếm.", 400)
  }

  const resolved = resolveFoodSearchQuery(trimmedQuery)
  let resolvedQuery = resolved.resolvedQuery
  let searchFallbackUsed = false
  let searchResults = await searchFoods(resolvedQuery)

  if (!searchResults.length && resolved.queryMapped && resolved.queryOriginal !== resolved.resolvedQuery) {
    searchResults = await searchFoods(resolved.queryOriginal)
    resolvedQuery = resolved.queryOriginal
    searchFallbackUsed = true
  }

  const dedupedResults = Array.from(
    new Map(sortUsdaSearchResults(searchResults, resolved.queryKind).map((result) => [result.fdcId, result])).values(),
  )

  return {
    meta: {
      queryKind: resolved.queryKind,
      queryMapped: resolved.queryMapped,
      queryNormalized: resolved.queryNormalized,
      queryOriginal: resolved.queryOriginal,
      resolvedQuery,
      searchFallbackUsed,
    },
    results: dedupedResults.map(serializeSearchResult),
  }
}

function buildNutrientAmountMap(food: FoodWithNutrientsRecord): NutrientAmountMap {
  return food.nutrients.reduce<NutrientAmountMap>((accumulator, nutrient) => {
    accumulator[nutrient.nutrientKey] = nutrient.amountPer100g
    return accumulator
  }, {})
}

function getFoodBaseNutrition(foodDetail: UsdaFoodDetail) {
  const parsed = parseUsdaFoodNutrients(foodDetail)

  if (parsed.normalizationIssue === "unsupported_serving_size_unit") {
    throw new AuthServiceError(
      "Món USDA bạn chọn không có serving size theo gram, nên chưa log được ở MVP hiện tại. Hãy chọn một item generic/Foundation/Survey/SR Legacy khác.",
      422,
    )
  }

  if (parsed.missingRequired.length > 0) {
    throw new AuthServiceError("USDA không trả đủ dữ liệu dinh dưỡng cho món này.", 422)
  }

  const nutrientAmountMap = parsed.nutrients.reduce<NutrientAmountMap>((accumulator, nutrient) => {
    accumulator[nutrient.nutrientKey] = nutrient.amountPer100g
    return accumulator
  }, {})

  return {
    nutrientAmountMap,
    nutrients: parsed.nutrients,
  }
}

async function upsertFoodFromUsdaDetail(foodDetail: UsdaFoodDetail) {
  const db = ensurePrisma()
  const { nutrientAmountMap, nutrients } = getFoodBaseNutrition(foodDetail)
  const fdcId = String(foodDetail.fdcId)

  const refreshedFood = await db.$transaction(async (tx) => {
    const food = await tx.food.upsert({
      create: {
        brand: foodDetail.brandName ?? foodDetail.brandOwner ?? undefined,
        brandOwner: foodDetail.brandOwner ?? undefined,
        calories: nutrientAmountMap[FoodNutrientKey.calories] ?? 0,
        carbs: nutrientAmountMap[FoodNutrientKey.carbs],
        dataType: foodDetail.dataType ?? undefined,
        fat: nutrientAmountMap[FoodNutrientKey.fat],
        fdcId,
        fiber: nutrientAmountMap[FoodNutrientKey.fiber],
        isVerified: false,
        name: foodDetail.description,
        protein: nutrientAmountMap[FoodNutrientKey.protein],
        rawJson: foodDetail as unknown as Prisma.InputJsonValue,
        servingAmount: 100,
        servingUnit: "g",
        sodium: nutrientAmountMap[FoodNutrientKey.sodium],
        source: FoodSource.imported,
        sugar: nutrientAmountMap[FoodNutrientKey.sugar],
      },
      update: {
        brand: foodDetail.brandName ?? foodDetail.brandOwner ?? undefined,
        brandOwner: foodDetail.brandOwner ?? undefined,
        calories: nutrientAmountMap[FoodNutrientKey.calories] ?? 0,
        carbs: nutrientAmountMap[FoodNutrientKey.carbs],
        dataType: foodDetail.dataType ?? undefined,
        fat: nutrientAmountMap[FoodNutrientKey.fat],
        fiber: nutrientAmountMap[FoodNutrientKey.fiber],
        name: foodDetail.description,
        protein: nutrientAmountMap[FoodNutrientKey.protein],
        rawJson: foodDetail as unknown as Prisma.InputJsonValue,
        servingAmount: 100,
        servingUnit: "g",
        sodium: nutrientAmountMap[FoodNutrientKey.sodium],
        source: FoodSource.imported,
        sugar: nutrientAmountMap[FoodNutrientKey.sugar],
      },
      where: {
        fdcId,
      },
    })

    await tx.foodNutrient.deleteMany({
      where: {
        foodId: food.id,
      },
    })

    await tx.foodNutrient.createMany({
      data: nutrients.map((nutrient) => ({
        amountPer100g: nutrient.amountPer100g,
        foodId: food.id,
        nutrientKey: nutrient.nutrientKey,
        nutrientName: nutrient.nutrientName,
        unit: nutrient.unit,
      })),
    })

    return tx.food.findUnique({
      include: {
        nutrients: true,
      },
      where: {
        id: food.id,
      },
    })
  })

  if (!refreshedFood) {
    throw new AuthServiceError("Không thể lưu dữ liệu món ăn.", 500)
  }

  return refreshedFood
}

async function getCachedFood(fdcId: number) {
  const db = ensurePrisma()

  return db.food.findUnique({
    include: {
      nutrients: true,
    },
    where: {
      fdcId: String(fdcId),
    },
  })
}

async function getFoodForLogging(fdcId: number, options?: { forceRefresh?: boolean }) {
  const cachedFood = await getCachedFood(fdcId)

  if (cachedFood && !options?.forceRefresh && hasRequiredMealNutrients(cachedFood.nutrients)) {
    return cachedFood
  }

  const foodDetail = await getFoodDetail(fdcId)
  return upsertFoodFromUsdaDetail(foodDetail)
}

async function logMealForUser(
  profile: SerializedProfile,
  input: {
    eatenAt?: string | null
    fdcId: unknown
    forceRefresh?: boolean
    mealType?: unknown
    weightGrams: unknown
  },
) {
  const db = ensurePrisma()
  const fdcId = parseFdcId(input.fdcId)
  const weightGrams = parseWeightGrams(input.weightGrams)
  const type = parseMealType(input.mealType)
  const eatenAt = parseEatenAt(input.eatenAt)
  const food = await getFoodForLogging(fdcId, { forceRefresh: input.forceRefresh })
  const calculatedNutrition = calculateMealNutrition(buildNutrientAmountMap(food), weightGrams)
  const foodNameSnapshot = food.name.trim()

  const meal = await db.meal.create({
    data: {
      calories: calculatedNutrition.calories,
      carbs: calculatedNutrition.carbs,
      fat: calculatedNutrition.fat,
      fiber: calculatedNutrition.fiber,
      foodId: food.id,
      foodNameSnapshot,
      name: foodNameSnapshot,
      protein: calculatedNutrition.protein,
      recordedAt: eatenAt,
      sodium: calculatedNutrition.sodium,
      sugar: calculatedNutrition.sugar,
      type,
      userId: profile.id,
      weightGrams,
    },
    include: MEAL_WITH_FOOD_INCLUDE,
  })

  return serializeMealRecord(meal)
}

export { MEAL_WITH_FOOD_INCLUDE, logMealForUser, searchFoodsForUser, serializeMealRecord }
