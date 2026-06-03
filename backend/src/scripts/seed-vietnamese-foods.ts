import { FoodSource } from "@prisma/client"

import { buildFoodSlug, parseServingLabel } from "../lib/nutrition/food-utils"
import { VIETNAMESE_FOODS } from "../lib/nutrition/vietnamese-foods"
import { prisma } from "../lib/prisma"

async function main() {
  if (!prisma) {
    throw new Error("Database is not configured.")
  }

  let created = 0
  let updated = 0

  for (const food of VIETNAMESE_FOODS) {
    const slug = buildFoodSlug(food.name, "system")
    const serving = parseServingLabel(food.servingLabel)
    const existing = await prisma.food.findUnique({
      select: {
        id: true,
      },
      where: {
        slug,
      },
    })

    await prisma.food.upsert({
      create: {
        calories: food.calories,
        carbs: food.carbs,
        category: food.category,
        fat: food.fat,
        isVerified: true,
        name: food.name,
        protein: food.protein,
        servingAmount: serving.servingAmount,
        servingLabel: food.servingLabel,
        servingUnit: serving.servingUnit,
        slug,
        source: FoodSource.system,
      },
      update: {
        calories: food.calories,
        carbs: food.carbs,
        category: food.category,
        fat: food.fat,
        isVerified: true,
        name: food.name,
        protein: food.protein,
        servingAmount: serving.servingAmount,
        servingLabel: food.servingLabel,
        servingUnit: serving.servingUnit,
        source: FoodSource.system,
      },
      where: {
        slug,
      },
    })

    if (existing) {
      updated += 1
    } else {
      created += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        created,
        total: VIETNAMESE_FOODS.length,
        updated,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma?.$disconnect()
  })
