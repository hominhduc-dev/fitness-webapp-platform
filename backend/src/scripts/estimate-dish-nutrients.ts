/**
 * Estimates micronutrients for library foods USDA does not carry — prepared
 * dishes and a few Vietnamese-specific items — from a standard recipe.
 *
 *   npm --prefix backend run estimate:dish-nutrients            # only foods with no data yet
 *   npm --prefix backend run estimate:dish-nutrients -- --all   # re-estimate every AI row
 *
 * Writes `source: "ai"` rows into `food-nutrients.data.json` next to the USDA
 * ones; USDA rows are never overwritten. Uses the configured AI provider.
 */
import { getAIProvider } from "../lib/ai/ai-client"
import { readFoodNutrientData, writeFoodNutrientData } from "../lib/nutrition/food-nutrient-data"
import { USDA_MAPPING } from "../lib/nutrition/usda-mapping"
import { VIETNAMESE_FOODS } from "../lib/nutrition/vietnamese-foods"
import { estimateDishNutrients } from "../services/ai/dish-nutrients"

/** Provider rate limits reset within a minute; back off instead of failing the batch. */
async function withRateLimitRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      const rateLimited = error instanceof Error && /\b429\b/.test(error.message)
      if (!rateLimited || attempt >= attempts) throw error
      const waitSeconds = 20 * attempt
      console.log(`  rate limited, retrying in ${waitSeconds}s…`)
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
    }
  }
}

async function main() {
  const redoAll = process.argv.includes("--all")
  const data = readFoodNutrientData()
  const dishes = VIETNAMESE_FOODS.filter(
    (food) => !USDA_MAPPING[food.name] && data[food.name]?.source !== "usda" && (redoAll || !data[food.name]),
  )

  const provider = getAIProvider()
  let tokens = 0
  for (const dish of dishes) {
    const result = await withRateLimitRetry(() => estimateDishNutrients(provider, dish))
    tokens += result.tokenUsage
    data[dish.name] = { nutrients: result.nutrients, servingGrams: dish.servingGrams, source: "ai", sourceRef: result.recipe }
    // Written after every dish so an interrupted run keeps what it already paid for.
    writeFoodNutrientData(data)
    console.log(`✓ ${dish.name} — ${result.recipe}`)
  }

  console.log(`Estimated ${dishes.length} dishes (${tokens} tokens).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
