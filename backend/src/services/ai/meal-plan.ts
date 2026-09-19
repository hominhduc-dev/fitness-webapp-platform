/**
 * Pure building blocks for AI meal plans: day targets, portion fitting,
 * target validation, shopping lists and prompts. Database and provider calls
 * stay in `ai.service.ts`.
 */
import { dateKeyInstant, plusDays } from "../../lib/ai/calendar"
import { formatFoodQuantity, roundNutrition } from "../../lib/nutrition/food-utils"
import { fitPortions, type Nutrients, type ScalableItem } from "../../lib/nutrition/portion-scaler"
import { AppError } from "../errors"
import { SAFETY_RULES, traineeInput } from "./prompts/shared"

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const
type PlanMealType = (typeof MEAL_TYPES)[number]
type PlanAmountUnit = "serving" | "g" | "ml"

type PlanFood = {
  id: string
  name: string
  category: string
  calories: number
  protein: number | null
  carbs: number | null
  fat: number | null
  servingAmount: number
  servingUnit: string
  servingLabel: string
  priceTier?: string | null
  prepMinutes?: number | null
}

type DraftItem = { foodId: string; amountValue: number; amountUnit: PlanAmountUnit }
type DraftMeal = { type: PlanMealType; suggestion: string; items: DraftItem[] }
type MappedItem = DraftItem & Nutrients & { foodName: string; quantityLabel: string }
type MappedMeal = { type: PlanMealType; suggestion: string; items: MappedItem[] }
type PlanDay = { date: string; targets: Nutrients; consumed: Nutrients; meals: MappedMeal[] }
type ShoppingItem = { foodId: string; foodName: string; category: string; amountValue: number; amountUnit: PlanAmountUnit; quantityLabel: string }
type MealPlanOverrides = Array<{ date: string; meals: Array<{ type: PlanMealType; items: DraftItem[] }> }>

type PromptFilters = {
  allergies: readonly string[]
  dietType: string | null
  budget?: string
  cookingTime?: string
  preferences?: string
}

const DEFAULT_MACRO_GOALS = { protein: 140, carbs: 280, fat: 70 }
/** Below this there is no meaningful meal left to plan for the day. */
const MIN_PLANNABLE_CALORIES = 200

const BUDGET_LABELS: Record<string, string> = { low: "Tiết kiệm", medium: "Trung bình", high: "Không giới hạn" }
const COOKING_TIME_LABELS: Record<string, string> = { quick: "Nhanh (15-20 phút)", normal: "Bình thường (30-60 phút)" }
const DIET_LABELS: Record<string, string> = {
  vegetarian: "Ăn chay (không thịt, không cá/hải sản; trứng và sữa được)",
  pescatarian: "Không ăn thịt (được ăn cá và hải sản)",
}

function emptyNutrients(): Nutrients {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

function sumNutrients(values: Nutrients[]): Nutrients {
  return values.reduce(
    (total, value) => ({
      calories: total.calories + value.calories,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat,
    }),
    emptyNutrients(),
  )
}

function roundNutrients(value: Nutrients): Nutrients {
  return {
    calories: roundNutrition(value.calories),
    protein: roundNutrition(value.protein),
    carbs: roundNutrition(value.carbs),
    fat: roundNutrition(value.fat),
  }
}

function dayNutrients(meals: Array<{ items: Nutrients[] }>): Nutrients {
  return sumNutrients(meals.flatMap((meal) => meal.items))
}

function planDates(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => plusDays(dateKeyInstant(start), index).toISOString().slice(0, 10))
}

/** Macro checks only apply once the trainee has moved off the schema defaults. */
function hasCustomMacroGoals(goals: { protein: number; carbs: number; fat: number }) {
  return goals.protein !== DEFAULT_MACRO_GOALS.protein || goals.carbs !== DEFAULT_MACRO_GOALS.carbs || goals.fat !== DEFAULT_MACRO_GOALS.fat
}

function remainingTargets(goals: Nutrients, used: Nutrients): Nutrients {
  return {
    calories: goals.calories - used.calories,
    protein: Math.max(0, goals.protein - used.protein),
    carbs: Math.max(0, goals.carbs - used.carbs),
    fat: Math.max(0, goals.fat - used.fat),
  }
}

function canPlanCalories(targets: Nutrients) {
  return targets.calories >= MIN_PLANNABLE_CALORIES
}

/** Mirrors `calculateItemNutrition`: g/ml scale by the serving size, servings multiply. */
function unitMultiplier(food: PlanFood, unit: PlanAmountUnit) {
  return unit !== "serving" && food.servingUnit === unit && food.servingAmount > 0 ? 1 / food.servingAmount : 1
}

function requirePlanFood(foodsById: ReadonlyMap<string, PlanFood>, item: DraftItem) {
  const food = foodsById.get(item.foodId)
  if (!food) {
    throw new AppError(`Món ${item.foodId} không thuộc thư viện được phép (đã lọc dị ứng, chế độ ăn, ngân sách). Không có món nào bị bỏ qua; hãy tạo lại.`, { status: 422, code: "AI_UNAVAILABLE_FOOD" })
  }
  if (item.amountUnit !== "serving" && (food.servingUnit !== item.amountUnit || food.servingAmount <= 0)) {
    throw new AppError(`Không thể quy đổi đơn vị ${item.amountUnit} cho món ${food.name}. Hãy dùng serving hoặc đúng servingUnit của món.`, { status: 422 })
  }
  return food
}

function mapPlanItem(food: PlanFood, amountValue: number, amountUnit: PlanAmountUnit): MappedItem {
  const multiplier = amountValue * unitMultiplier(food, amountUnit)
  return {
    foodId: food.id,
    foodName: food.name,
    amountValue,
    amountUnit,
    quantityLabel: formatFoodQuantity(food, { amountValue, amountUnit }),
    calories: roundNutrition(food.calories * multiplier),
    protein: roundNutrition((food.protein ?? 0) * multiplier),
    carbs: roundNutrition((food.carbs ?? 0) * multiplier),
    fat: roundNutrition((food.fat ?? 0) * multiplier),
  }
}

function amountStep(unit: PlanAmountUnit) {
  return unit === "serving" ? 0.25 : 5
}

/**
 * Keeps the model's food choices and solves the portions against `target`.
 * Portions may shrink to 40% or grow to 250% of the suggestion, so the model's
 * sense of a realistic plate still bounds the result.
 */
function fitMealsToTarget(meals: DraftMeal[], foodsById: ReadonlyMap<string, PlanFood>, target: Nutrients, customMacros: boolean): MappedMeal[] {
  const entries = meals.flatMap((meal, mealIndex) =>
    meal.items.map((item) => {
      const food = requirePlanFood(foodsById, item)
      const step = amountStep(item.amountUnit)
      const factor = unitMultiplier(food, item.amountUnit)
      const scalable: ScalableItem = {
        perUnit: { calories: food.calories * factor, protein: (food.protein ?? 0) * factor, carbs: (food.carbs ?? 0) * factor, fat: (food.fat ?? 0) * factor },
        amount: item.amountValue,
        min: Math.max(step, item.amountValue * 0.4),
        max: Math.min(item.amountUnit === "serving" ? 6 : 1500, Math.max(item.amountValue * 2.5, step * 4)),
        step,
      }
      return { mealIndex, food, unit: item.amountUnit, scalable }
    }),
  )
  const weights = customMacros ? { calories: 4, protein: 1.5, carbs: 1, fat: 1 } : { calories: 4, protein: 0.5, carbs: 0.25, fat: 0.25 }
  const amounts = fitPortions(entries.map((entry) => entry.scalable), target, weights)

  return meals.map((meal, mealIndex) => ({
    type: meal.type,
    suggestion: meal.suggestion,
    items: entries.flatMap((entry, index) => (entry.mealIndex === mealIndex ? [mapPlanItem(entry.food, amounts[index], entry.unit)] : [])),
  }))
}

function validateDayTargets(date: string, totals: Nutrients, targets: Nutrients, customMacros: boolean) {
  if (!Number.isFinite(targets.calories) || targets.calories <= 0) {
    throw new AppError("Hãy cập nhật mục tiêu calories trước khi tạo thực đơn.", { status: 422 })
  }
  if (!Number.isFinite(totals.calories) || Math.abs(totals.calories - targets.calories) > targets.calories * 0.1 + 0.01) {
    throw new AppError(`Ngày ${date}: thực đơn có ${Math.round(totals.calories)} kcal, nằm ngoài ±10% mục tiêu ${Math.round(targets.calories)} kcal. Hãy chọn món có năng lượng phù hợp hơn.`, { status: 422, code: "AI_NUTRITION_TARGET_MISMATCH" })
  }
  if (!customMacros) return
  const checks: Array<[string, number, number, number]> = [
    ["protein", totals.protein, targets.protein, 20],
    ["carbs", totals.carbs, targets.carbs, 40],
    ["fat", totals.fat, targets.fat, 15],
  ]
  const failed = checks.filter(([, actual, goal, floor]) => goal > 0 && Math.abs(actual - goal) > Math.max(goal * 0.25, floor))
  if (failed.length > 0) {
    throw new AppError(`Ngày ${date}: macro ngoài ngưỡng mục tiêu: ${failed.map(([name, actual, goal]) => `${name} ${Math.round(actual)} so với ${Math.round(goal)}g`).join(", ")}. Hãy đổi món để cân bằng macro.`, { status: 422, code: "AI_MACRO_TARGET_MISMATCH" })
  }
}

/**
 * Trainee edits may change amounts or drop items, meals or days, but not bring
 * in foods the draft never contained — those would bypass the allergy filter.
 */
function applyMealPlanOverrides(
  days: Array<{ date: string; targets: Nutrients; meals: Array<{ type: PlanMealType; items: DraftItem[] }> }>,
  overrides: MealPlanOverrides,
) {
  const draftFoodIds = new Set(days.flatMap((day) => day.meals.flatMap((meal) => meal.items.map((item) => item.foodId))))
  return overrides
    .map((override) => {
      const day = days.find((candidate) => candidate.date === override.date)
      if (!day) throw new AppError(`Ngày ${override.date} không có trong bản nháp.`, { status: 400 })
      const seen = new Set<string>()
      const meals = override.meals
        .map((meal) => {
          if (seen.has(meal.type) || !day.meals.some((candidate) => candidate.type === meal.type)) {
            throw new AppError(`Bữa ${meal.type} ngày ${override.date} không có trong bản nháp.`, { status: 400 })
          }
          seen.add(meal.type)
          if (meal.items.some((item) => !draftFoodIds.has(item.foodId))) {
            throw new AppError("Chỉ được chỉnh khẩu phần hoặc bỏ món có sẵn trong bản nháp.", { status: 400 })
          }
          return meal
        })
        .filter((meal) => meal.items.length > 0)
      return { date: day.date, targets: day.targets, meals }
    })
    .filter((day) => day.meals.length > 0)
}

function buildShoppingList(days: Array<{ meals: Array<{ items: MappedItem[] }> }>, foodsById: ReadonlyMap<string, PlanFood>): ShoppingItem[] {
  const totals = new Map<string, ShoppingItem>()
  for (const item of days.flatMap((day) => day.meals.flatMap((meal) => meal.items))) {
    const key = `${item.foodId}|${item.amountUnit}`
    const amountValue = roundNutrition((totals.get(key)?.amountValue ?? 0) + item.amountValue, 2)
    const food = foodsById.get(item.foodId)
    totals.set(key, {
      foodId: item.foodId,
      foodName: item.foodName,
      category: food?.category ?? "other",
      amountValue,
      amountUnit: item.amountUnit,
      quantityLabel: food ? formatFoodQuantity(food, { amountValue, amountUnit: item.amountUnit }) : `${amountValue} ${item.amountUnit}`,
    })
  }
  return [...totals.values()].sort((left, right) => left.category.localeCompare(right.category) || left.foodName.localeCompare(right.foodName, "vi"))
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function formatTargets(targets: Nutrients) {
  return `${Math.round(targets.calories)} kcal, P ${Math.round(targets.protein)}g, C ${Math.round(targets.carbs)}g, F ${Math.round(targets.fat)}g`
}

function catalogForPrompt(foods: readonly PlanFood[]) {
  return foods.map((food) => ({
    id: food.id,
    name: food.name,
    category: food.category,
    calories: food.calories,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fat: food.fat ?? 0,
    servingLabel: food.servingLabel,
    servingAmount: food.servingAmount,
    servingUnit: food.servingUnit,
    ...(food.priceTier ? { priceTier: food.priceTier } : {}),
    ...(food.prepMinutes != null ? { prepMinutes: food.prepMinutes } : {}),
  }))
}

function constraintSection(filters: PromptFilters, recentFoodNames: readonly string[]) {
  return [
    `## Dị ứng (đã loại khỏi catalog, tuyệt đối không dùng): ${filters.allergies.length > 0 ? filters.allergies.join(", ") : "Không có"}`,
    `## Chế độ ăn: ${filters.dietType ? DIET_LABELS[filters.dietType] ?? filters.dietType : "Bình thường"}`,
    filters.preferences ? `## Sở thích / hạn chế thêm\n${traineeInput(filters.preferences, "Không có")}` : "",
    `## Ngân sách: ${BUDGET_LABELS[filters.budget ?? "medium"] ?? "Trung bình"}`,
    `## Thời gian nấu: ${COOKING_TIME_LABELS[filters.cookingTime ?? "normal"] ?? "Bình thường"}`,
    `## Món đã ăn gần đây (tránh lặp)\n${recentFoodNames.length > 0 ? recentFoodNames.join(", ") : "Chưa có dữ liệu"}`,
  ]
    .filter(Boolean)
    .join("\n")
}

const PORTION_RULES = `- foodId BẮT BUỘC là id trong Food Catalog. Không tự nghĩ ra món.
- Bữa chính (breakfast, lunch, dinner) có 2-3 items; snack có 1-3 items.
- amountUnit CHỈ là "serving", "g" hoặc "ml"; chỉ dùng g/ml khi trùng servingUnit của món. amountValue là khẩu phần ước lượng hợp lý cho một người.
- Backend sẽ tự tinh chỉnh khẩu phần cho khớp mục tiêu, nên KHÔNG cần tính calories chính xác. Việc của bạn là chọn món hợp nhau và có tỉ lệ protein/carbs/fat gần mục tiêu.
- Trả JSON thuần, bắt đầu bằng { và kết thúc bằng }. Không markdown, không giải thích, không thẻ <thought>/<thinking>.`

function buildDayPlanPrompt(input: {
  days: Array<{ date: string; mealTypes: readonly PlanMealType[]; targets: Nutrients }>
  catalog: readonly PlanFood[]
  filters: PromptFilters
  recentFoodNames: readonly string[]
}) {
  const systemPrompt = `Bạn là chuyên gia dinh dưỡng AI. Lên thực đơn theo ẩm thực Việt Nam, đa dạng, dễ nấu và thực tế.

QUY TẮC BẮT BUỘC:
${SAFETY_RULES}
${PORTION_RULES}
- Mỗi ngày trả ĐÚNG các bữa được yêu cầu cho ngày đó (không thêm, không bớt), mỗi loại bữa một lần, đúng thứ tự ngày.
- Nhiều ngày thì đổi món chính giữa các ngày và tránh các món đã ăn gần đây.`

  const example = {
    days: input.days.slice(0, 1).map((day) => ({
      date: day.date,
      meals: day.mealTypes.map((type) => ({
        type,
        suggestion: "mô tả ngắn bữa ăn",
        items: Array.from({ length: type === "snack" ? 1 : 2 }, () => ({ foodId: "UUID chính xác từ catalog", amountValue: 1, amountUnit: "serving" })),
      })),
    })),
    notes: "ghi chú dinh dưỡng ngắn bằng tiếng Việt",
  }

  const userPrompt = [
    "## Các ngày cần lên thực đơn",
    ...input.days.map((day) => `- ${day.date}: bữa ${day.mealTypes.join(", ")} — mục tiêu ${formatTargets(day.targets)}`),
    "",
    constraintSection(input.filters, input.recentFoodNames),
    "",
    "## Food Catalog (CHỈ dùng foods trong list này)",
    JSON.stringify(catalogForPrompt(input.catalog)),
    "",
    "## Output JSON Shape (ví dụ cho ngày đầu; mọi ngày trong danh sách đều phải có)",
    JSON.stringify(example, null, 2),
  ].join("\n")

  return { systemPrompt, userPrompt }
}

function buildMealSwapPrompt(input: {
  date: string
  mealType: PlanMealType
  target: Nutrients
  currentFoodNames: readonly string[]
  otherFoodNames: readonly string[]
  catalog: readonly PlanFood[]
  filters: PromptFilters
  recentFoodNames: readonly string[]
}) {
  const systemPrompt = `Bạn là chuyên gia dinh dưỡng AI. Đề xuất MỘT bữa ăn thay thế theo ẩm thực Việt Nam.

QUY TẮC BẮT BUỘC:
${SAFETY_RULES}
${PORTION_RULES}
- Chỉ trả đúng một bữa có type "${input.mealType}".`

  const userPrompt = [
    `## Đổi bữa ${input.mealType} ngày ${input.date}`,
    `Mục tiêu cho bữa này: ${formatTargets(input.target)}`,
    `Bữa hiện tại trainee muốn đổi (dùng món khác): ${input.currentFoodNames.join(", ") || "Không có"}`,
    `Các bữa khác trong ngày đã có (tránh trùng): ${input.otherFoodNames.join(", ") || "Không có"}`,
    "",
    constraintSection(input.filters, input.recentFoodNames),
    "",
    "## Food Catalog (CHỈ dùng foods trong list này)",
    JSON.stringify(catalogForPrompt(input.catalog)),
    "",
    "## Output JSON Shape",
    JSON.stringify({ type: input.mealType, suggestion: "mô tả ngắn bữa ăn", items: [{ foodId: "UUID chính xác từ catalog", amountValue: 1, amountUnit: "serving" }] }, null, 2),
  ].join("\n")

  return { systemPrompt, userPrompt }
}

export {
  applyMealPlanOverrides,
  buildDayPlanPrompt,
  buildMealSwapPrompt,
  buildShoppingList,
  canPlanCalories,
  dayNutrients,
  emptyNutrients,
  fitMealsToTarget,
  hasCustomMacroGoals,
  MEAL_TYPES,
  planDates,
  remainingTargets,
  roundNutrients,
  sumNutrients,
  validateDayTargets,
}
export type { DraftItem, DraftMeal, MappedItem, MappedMeal, MealPlanOverrides, PlanDay, PlanFood, PlanMealType, PromptFilters, ShoppingItem }
