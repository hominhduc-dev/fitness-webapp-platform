import { Prisma } from "@prisma/client"

const MEAL_WITH_FOOD_INCLUDE = {
  items: {
    include: {
      food: {
        select: {
          calories: true,
          carbs: true,
          category: true,
          fat: true,
          id: true,
          name: true,
          protein: true,
          servingAmount: true,
          servingLabel: true,
          servingUnit: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.MealInclude

type MealWithFoodRecord = Prisma.MealGetPayload<{
  include: typeof MEAL_WITH_FOOD_INCLUDE
}>

function serializeMealRecord(meal: MealWithFoodRecord) {
  return {
    calories: meal.calories,
    carbs: meal.carbs ?? undefined,
    fat: meal.fat ?? undefined,
    fiber: meal.fiber ?? undefined,
    id: meal.id,
    items: meal.items.map((item) => ({
      amountLabel: item.amountLabel ?? undefined,
      amountUnit: item.amountUnit,
      amountValue: item.amountValue,
      calories: item.calories,
      carbs: item.carbs ?? undefined,
      fat: item.fat ?? undefined,
      fiber: item.fiber ?? undefined,
      foodId: item.foodId,
      id: item.id,
      name: item.foodNameSnapshot ?? item.food.name,
      protein: item.protein ?? undefined,
      sodium: item.sodium ?? undefined,
      sugar: item.sugar ?? undefined,
      weightGrams: item.weightGrams ?? undefined,
    })),
    loggedDate: meal.loggedDate,
    name: meal.name,
    protein: meal.protein ?? undefined,
    sodium: meal.sodium ?? undefined,
    sugar: meal.sugar ?? undefined,
    time: meal.recordedAt,
    type: meal.type,
  }
}

export { MEAL_WITH_FOOD_INCLUDE, serializeMealRecord }
export type { MealWithFoodRecord }
