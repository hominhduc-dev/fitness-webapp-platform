import { FoodReviewStatus, FoodSource, NutrientSource } from "@prisma/client"

import { readFoodNutrientData } from "../lib/nutrition/food-nutrient-data"
import { buildFoodSlug, parseServingLabel } from "../lib/nutrition/food-utils"
import { NUTRIENT_CODES } from "../lib/nutrition/nutrients"
import { VIETNAMESE_FOODS } from "../lib/nutrition/vietnamese-foods"
import { prisma } from "../lib/prisma"

async function main() {
  if (!prisma) {
    throw new Error("Database is not configured.")
  }

  let created = 0
  let updated = 0
  const nutrientData = readFoodNutrientData()
  const withoutNutrients: string[] = []
  const staleServings: string[] = []

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

    const saved = await prisma.food.upsert({
      create: {
        calories: food.calories,
        carbs: food.carbs,
        category: food.category,
        fat: food.fat,
        isVerified: true,
        name: food.name,
        nameEn: food.nameEn,
        protein: food.protein,
        reviewStatus: FoodReviewStatus.approved,
        servingAmount: serving.servingAmount,
        servingGrams: food.servingGrams,
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
        nameEn: food.nameEn,
        protein: food.protein,
        reviewStatus: FoodReviewStatus.approved,
        servingAmount: serving.servingAmount,
        servingGrams: food.servingGrams,
        servingLabel: food.servingLabel,
        servingUnit: serving.servingUnit,
        source: FoodSource.system,
      },
      where: {
        slug,
      },
    })

    // Nutrient rows are replaced wholesale so a nutrient dropped from the data
    // file does not linger with an old value.
    const entry = nutrientData[food.name]
    if (entry) {
      if (entry.servingGrams !== food.servingGrams) staleServings.push(`${food.name} (${entry.servingGrams} g → ${food.servingGrams} g)`)
      const rows = NUTRIENT_CODES.flatMap((code) => {
        const amount = entry.nutrients[code]
        return amount == null
          ? []
          : [{ amount, foodId: saved.id, nutrientCode: code, source: entry.source === "usda" ? NutrientSource.usda : NutrientSource.ai, sourceRef: entry.sourceRef }]
      })
      await prisma.$transaction([
        prisma.foodNutrient.deleteMany({ where: { foodId: saved.id } }),
        prisma.foodNutrient.createMany({ data: rows }),
      ])
    } else {
      withoutNutrients.push(food.name)
    }

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
        withoutNutrients,
        // Amounts were scaled to a serving weight that has since changed; rerun the import.
        staleServings,
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
