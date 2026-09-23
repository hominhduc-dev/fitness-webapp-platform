/**
 * Micronutrient estimate for a prepared dish, built from a standard recipe.
 *
 * USDA covers ingredients, not phở or cơm tấm, so for dishes the model breaks
 * the portion into ingredients by weight and adds them up from reference
 * tables. The library's own kcal/macros are passed in so the estimate
 * describes the same portion, and the validator rejects numbers no real dish
 * of that weight could carry.
 */
import { z } from "zod"

import { parseAI } from "../../lib/ai/output-schemas"
import type { AIProvider } from "../../lib/ai/types"
import { generateValidatedJSON } from "../../lib/ai/validated-generation"
import { NUTRIENT_CODES, roundNutrientAmount, type NutrientAmounts, type NutrientCode } from "../../lib/nutrition/nutrients"
import { AppError } from "../errors"

const DISH_NUTRIENTS_PROMPT_VERSION = "2026-09-23.1"

type DishInput = {
  name: string
  servingLabel: string
  servingGrams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

/**
 * Upper bounds per 100 g for a mixed dish or drink. Deliberately generous —
 * they catch unit slips (mg written as µg, a per-kg figure) rather than judge
 * a recipe.
 */
const MAX_PER_100G: Record<NutrientCode, number> = {
  fiber: 30,
  sugar: 70,
  saturated_fat: 40,
  cholesterol: 600,
  sodium: 2500,
  potassium: 1500,
  calcium: 1000,
  iron: 20,
  magnesium: 400,
  zinc: 15,
  vitamin_a: 3000,
  vitamin_c: 300,
  vitamin_d: 25,
  vitamin_b12: 20,
  folate: 800,
}

const amount = z.number().min(0)
const outputSchema = z.object({
  recipe: z.string().trim().min(1).max(400),
  nutrients: z.object(Object.fromEntries(NUTRIENT_CODES.map((code) => [code, amount])) as Record<NutrientCode, typeof amount>),
})

function invalid(message: string): never {
  throw new AppError(`Dữ liệu AI không hợp lệ. ${message}`, { status: 422, code: "AI_VALIDATION_ERROR" })
}

function validateDishNutrients(value: unknown, dish: DishInput) {
  const result = parseAI(outputSchema, value)
  const scale = dish.servingGrams / 100

  for (const code of NUTRIENT_CODES) {
    const cap = MAX_PER_100G[code] * scale
    if (result.nutrients[code] > cap) {
      invalid(`${code} = ${result.nutrients[code]} cho ${dish.servingGrams} g là quá cao (tối đa hợp lý ~${Math.round(cap)}). Kiểm tra đơn vị (mg/µg) và khẩu phần.`)
    }
  }
  if (result.nutrients.saturated_fat > dish.fat + 0.5) {
    invalid(`saturated_fat (${result.nutrients.saturated_fat} g) không thể lớn hơn tổng fat của món (${dish.fat} g).`)
  }
  if (result.nutrients.fiber + result.nutrients.sugar > dish.carbs + 2) {
    invalid(`fiber + sugar (${result.nutrients.fiber + result.nutrients.sugar} g) không thể lớn hơn tổng carbs (${dish.carbs} g).`)
  }

  return result
}

const SYSTEM_PROMPT = `Bạn là chuyên gia dinh dưỡng. Ước tính vi chất cho MỘT khẩu phần món ăn/đồ uống Việt Nam, dùng làm dữ liệu tham chiếu cho app theo dõi ăn uống. Độ chính xác quan trọng hơn mọi thứ.

## Cách làm
1. Chọn công thức chuẩn, phổ biến nhất của món. Tách khẩu phần đã cho thành nguyên liệu theo gram (tính cả nước dùng, nước chấm, rau ăn kèm mặc định). Tổng gram nguyên liệu phải bằng khối lượng khẩu phần.
2. Công thức phải khớp với calo/macro đã cho — đó là số liệu của cùng khẩu phần này. Nếu công thức bạn nghĩ ra cho ra calo khác xa, chỉnh lượng nguyên liệu cho khớp.
3. Cộng vi chất từng nguyên liệu theo Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng) hoặc USDA FoodData Central. Nước mắm, nước dùng, muối, bột ngọt đóng góp phần lớn natri của món nước — đừng bỏ sót.
4. Không bịa số. Không làm tròn quá tay.

## Đơn vị (bắt buộc đúng)
fiber, sugar, saturated_fat: g · cholesterol, sodium, potassium, calcium, iron, magnesium, zinc, vitamin_c: mg · vitamin_a (RAE), vitamin_d, vitamin_b12, folate (DFE): µg.
Tất cả là cho CẢ khẩu phần đã cho, không phải cho 100 g.

## Trả về
Chỉ một JSON object, không markdown:
{"recipe": "<nguyên liệu chính theo gram, ngắn gọn>", "nutrients": {"fiber": n, "sugar": n, "saturated_fat": n, "cholesterol": n, "sodium": n, "potassium": n, "calcium": n, "iron": n, "magnesium": n, "zinc": n, "vitamin_a": n, "vitamin_c": n, "vitamin_d": n, "vitamin_b12": n, "folate": n}}`

async function estimateDishNutrients(provider: AIProvider, dish: DishInput) {
  const userPrompt = [
    `Món: ${dish.name}`,
    `Khẩu phần: ${dish.servingLabel} ≈ ${dish.servingGrams} g`,
    `Calo/macro của khẩu phần này: ${dish.calories} kcal, protein ${dish.protein} g, carbs ${dish.carbs} g, fat ${dish.fat} g`,
  ].join("\n")

  const { data, tokenUsage } = await generateValidatedJSON(
    provider,
    {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 900,
      repairInstruction: "Tra lại số liệu nguyên liệu và trả về JSON đầy đủ đã sửa lỗi này. Giữ đúng đơn vị đã quy định.",
    },
    (value) => validateDishNutrients(value, dish),
  )

  const nutrients: NutrientAmounts = {}
  for (const code of NUTRIENT_CODES) nutrients[code] = roundNutrientAmount(data.nutrients[code])
  return { nutrients, recipe: data.recipe, tokenUsage, promptVersion: DISH_NUTRIENTS_PROMPT_VERSION }
}

export { estimateDishNutrients, validateDishNutrients, type DishInput }
