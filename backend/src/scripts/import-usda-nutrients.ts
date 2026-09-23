/**
 * Pulls micronutrients for library ingredients from USDA FoodData Central.
 *
 *   FDC_API_KEY=... npm --prefix backend run import:usda-nutrients
 *
 * Every entry in `USDA_MAPPING` is looked up by its exact SR Legacy
 * description; anything that is not an exact match stops the run with the
 * closest candidates listed, so a wrong food can never slip in. USDA reports
 * per 100 g, and the result is scaled to the library serving weight and
 * written to `food-nutrients.data.json` (AI-estimated dishes in that file are
 * kept). Nothing touches the database — the food seed loads the file.
 */
import "dotenv/config"

import { readFoodNutrientData, writeFoodNutrientData, type FoodNutrientData } from "../lib/nutrition/food-nutrient-data"
import { FDC_NUTRIENT_IDS, NUTRIENT_CODES, roundNutrientAmount, type NutrientAmounts } from "../lib/nutrition/nutrients"
import { USDA_MAPPING } from "../lib/nutrition/usda-mapping"
import { VIETNAMESE_FOODS } from "../lib/nutrition/vietnamese-foods"

const API = "https://api.nal.usda.gov/fdc/v1"
const DATA_TYPE = "SR Legacy"

type SearchResponse = { foods?: Array<{ fdcId: number; description: string; dataType: string }> }
type FoodDetail = {
  fdcId: number
  description: string
  foodNutrients?: Array<{ amount?: number; nutrient?: { id: number } }>
}

function apiKey() {
  const key = process.env.FDC_API_KEY?.trim()
  if (!key) {
    throw new Error("FDC_API_KEY is not set. Get a free key at https://api.data.gov/signup and add it to backend/.env.")
  }
  return key
}

async function fdc<T>(path: string, init?: RequestInit): Promise<T> {
  const separator = path.includes("?") ? "&" : "?"
  const response = await fetch(`${API}${path}${separator}api_key=${apiKey()}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!response.ok) {
    throw new Error(`FDC ${path.split("?")[0]} → ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T
}

async function resolveFdcId(description: string) {
  const query = encodeURIComponent(description)
  const result = await fdc<SearchResponse>(`/foods/search?query=${query}&dataType=${encodeURIComponent(DATA_TYPE)}&pageSize=50`)
  const candidates = result.foods ?? []
  const exact = candidates.find((food) => food.description.trim().toLowerCase() === description.trim().toLowerCase())
  return { exact, candidates: candidates.slice(0, 5).map((food) => `${food.fdcId} ${food.description}`) }
}

async function fetchDetails(ids: number[]) {
  const details: FoodDetail[] = []
  // The bulk endpoint takes at most 20 ids per call.
  for (let index = 0; index < ids.length; index += 20) {
    const batch = ids.slice(index, index + 20)
    details.push(...(await fdc<FoodDetail[]>("/foods", { body: JSON.stringify({ fdcIds: batch, format: "full" }), method: "POST" })))
  }
  return new Map(details.map((detail) => [detail.fdcId, detail]))
}

function per100g(detail: FoodDetail) {
  const byId = new Map<number, number>()
  for (const entry of detail.foodNutrients ?? []) {
    if (entry.nutrient?.id != null && typeof entry.amount === "number") byId.set(entry.nutrient.id, entry.amount)
  }
  const amounts: NutrientAmounts = {}
  const missing: string[] = []
  for (const code of NUTRIENT_CODES) {
    const amount = byId.get(FDC_NUTRIENT_IDS[code])
    if (amount == null) missing.push(code)
    else amounts[code] = amount
  }
  return { amounts, missing }
}

async function main() {
  const servingGramsByName = new Map(VIETNAMESE_FOODS.map((food) => [food.name, food.servingGrams]))
  const entries = Object.entries(USDA_MAPPING)
  const unknownNames = entries.filter(([name]) => !servingGramsByName.has(name)).map(([name]) => name)
  if (unknownNames.length > 0) {
    throw new Error(`Mapped names not in vietnamese-foods.ts: ${unknownNames.join(", ")}`)
  }

  // Resolve every description before writing anything.
  const resolved = new Map<string, number>()
  const failures: string[] = []
  for (const [name, mapping] of entries) {
    const { exact, candidates } = await resolveFdcId(mapping.description)
    if (exact) {
      resolved.set(name, exact.fdcId)
    } else {
      failures.push(`- ${name}: no exact SR Legacy match for "${mapping.description}"\n    ${candidates.join("\n    ")}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(`Fix these descriptions in usda-mapping.ts, then rerun:\n${failures.join("\n")}`)
  }

  const details = await fetchDetails([...new Set(resolved.values())])
  const data: FoodNutrientData = readFoodNutrientData()
  const gaps: string[] = []

  for (const [name, fdcId] of resolved) {
    const detail = details.get(fdcId)
    if (!detail) throw new Error(`FDC returned no details for ${fdcId} (${name}).`)
    const servingGrams = servingGramsByName.get(name) ?? 100
    const { amounts, missing } = per100g(detail)
    const nutrients: NutrientAmounts = {}
    for (const code of NUTRIENT_CODES) {
      const amount = amounts[code]
      if (amount != null) nutrients[code] = roundNutrientAmount((amount * servingGrams) / 100)
    }
    data[name] = { nutrients, servingGrams, source: "usda", sourceRef: `fdc:${fdcId} ${detail.description}` }
    if (missing.length > 0) gaps.push(`- ${name}: USDA does not report ${missing.join(", ")}`)
  }

  writeFoodNutrientData(data)
  console.log(`Wrote ${resolved.size} USDA foods.`)
  if (gaps.length > 0) console.log(`Left unknown (not zero):\n${gaps.join("\n")}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
