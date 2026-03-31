import { AuthServiceError } from "./auth.service"
import { env } from "../config/env"
import type { UsdaFoodNutrientRecord } from "../lib/meal-log/nutrient-parser"

type UsdaSearchFood = {
  brandOwner?: string | null
  dataType?: string | null
  description: string
  fdcId: number
  foodNutrients?: UsdaFoodNutrientRecord[]
  servingSize?: number | null
  servingSizeUnit?: string | null
}

type UsdaSearchResponse = {
  foods?: UsdaSearchFood[]
}

type UsdaFoodDetail = {
  brandOwner?: string | null
  brandName?: string | null
  dataType?: string | null
  description: string
  fdcId: number
  foodNutrients?: UsdaFoodNutrientRecord[]
  servingSize?: number | null
  servingSizeUnit?: string | null
  [key: string]: unknown
}

async function callUsdaApi<T>(path: string, params?: Record<string, string>) {
  if (!env.usdaApiKey) {
    throw new AuthServiceError("USDA API chưa được cấu hình.", 500)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.usdaTimeoutMs)

  try {
    const baseUrl = env.usdaApiBaseUrl.replace(/\/+$/, "")
    const url = new URL(`${baseUrl}${path}`)

    url.searchParams.set("api_key", env.usdaApiKey)

    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      const message = payload?.error ?? payload?.message ?? `USDA request failed with status ${response.status}.`
      throw new AuthServiceError(message, 502)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthServiceError("USDA API timeout.", 502)
    }

    throw new AuthServiceError("Không thể kết nối USDA API.", 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function searchFoods(query: string, pageSize = 10) {
  const payload = await callUsdaApi<UsdaSearchResponse>("/foods/search", {
    pageSize: String(pageSize),
    query,
  })

  return payload.foods ?? []
}

async function getFoodDetail(fdcId: number | string) {
  return callUsdaApi<UsdaFoodDetail>(`/food/${encodeURIComponent(String(fdcId))}`)
}

export type { UsdaFoodDetail, UsdaSearchFood }
export { getFoodDetail, searchFoods }
