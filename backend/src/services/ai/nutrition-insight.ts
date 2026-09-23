/**
 * AI Nutrition Insight.
 *
 * The backend decides *what* is true — today against targets, the 7-day
 * average against targets, which nutrients are short or over — and the model
 * only turns those findings into a few readable sentences and picks foods
 * from a list it is handed. It never sees raw meals to reinterpret, so it
 * cannot call a day "low in iron" that the numbers do not say is low.
 */
import { createHash } from "node:crypto"
import { z } from "zod"

import { parseAI } from "../../lib/ai/output-schemas"
import type { AIProvider } from "../../lib/ai/types"
import { generateValidatedJSON } from "../../lib/ai/validated-generation"
import type { NutrientTargets } from "../../lib/nutrition/nutrient-targets"
import { NUTRIENT_CODES, roundNutrientAmount, type NutrientAmounts, type NutrientCode } from "../../lib/nutrition/nutrients"
import { AppError } from "../errors"
import type { DayIntake } from "../nutrition-intake.service"
import { sanitizeUserText } from "./prompts/shared"

const NUTRITION_INSIGHT_PROMPT_VERSION = "2026-09-23.1"

/** Below this share of a "reach" target counts as short. */
const LOW_SHARE = 0.7
/** At or above this share counts as on target. */
const GOOD_SHARE = 0.9
/** A trend needs at least this many logged days in the window. */
const MIN_TREND_DAYS = 3
/** Micronutrient findings need most logged items to carry nutrient data. */
const MIN_COVERAGE = 0.6

type FindingStatus = "low" | "good" | "high"
type Finding = {
  code: NutrientCode | "calories" | "protein"
  name: string
  unit: string
  scope: "today" | "week"
  status: FindingStatus
  amount: number
  target: number
}

type InsightInput = {
  today: DayIntake | null
  week: { average: { calories: number; protein: number; nutrients: NutrientAmounts }; loggedDays: number; days: DayIntake[] }
  goals: { calories: number; protein: number }
  targets: NutrientTargets
  names: Partial<Record<NutrientCode, { name: string; unit: string }>>
}

function coverageOf(days: DayIntake[]) {
  const items = days.reduce((sum, day) => sum + day.items, 0)
  const withData = days.reduce((sum, day) => sum + day.itemsWithData, 0)
  return items === 0 ? 0 : withData / items
}

function classify(amount: number, target: number, kind: "reach" | "limit"): FindingStatus | null {
  if (target <= 0) return null
  if (kind === "limit") return amount > target ? "high" : null
  const share = amount / target
  if (share < LOW_SHARE) return "low"
  if (share >= GOOD_SHARE) return "good"
  return null
}

function buildInsightFindings(input: InsightInput) {
  const findings: Finding[] = []
  const hasTrend = input.week.loggedDays >= MIN_TREND_DAYS
  const microCoverage = coverageOf(hasTrend ? input.week.days : input.today ? [input.today] : [])
  const microsUsable = microCoverage >= MIN_COVERAGE

  const push = (finding: Omit<Finding, "status">, kind: "reach" | "limit") => {
    const status = classify(finding.amount, finding.target, kind)
    if (status) findings.push({ ...finding, amount: roundNutrientAmount(finding.amount), status })
  }

  if (input.today) {
    push({ amount: input.today.protein, code: "protein", name: "Protein", scope: "today", target: input.goals.protein, unit: "g" }, "reach")
  }
  if (hasTrend) {
    push({ amount: input.week.average.protein, code: "protein", name: "Protein", scope: "week", target: input.goals.protein, unit: "g" }, "reach")
    const calories = input.week.average.calories
    // Calories are a band, not a floor: flag only a clear miss either way.
    if (input.goals.calories > 0 && Math.abs(calories - input.goals.calories) / input.goals.calories > 0.15) {
      findings.push({
        amount: Math.round(calories),
        code: "calories",
        name: "Calories",
        scope: "week",
        status: calories > input.goals.calories ? "high" : "low",
        target: input.goals.calories,
        unit: "kcal",
      })
    }
  }

  if (microsUsable) {
    const scope = hasTrend ? "week" : "today"
    const amounts = hasTrend ? input.week.average.nutrients : (input.today?.nutrients ?? {})
    for (const code of NUTRIENT_CODES) {
      const target = input.targets[code]
      const amount = amounts[code]
      const meta = input.names[code]
      if (!target || amount == null || !meta) continue
      push({ amount, code, name: meta.name, scope, target: target.amount, unit: meta.unit }, target.kind)
    }
  }

  return { findings, hasTrend, microCoverage: Math.round(microCoverage * 100), microsUsable }
}

type SuggestionFood = { id: string; name: string; calories: number; nutrients: NutrientAmounts }

/** Up to `perNutrient` library foods richest in each short nutrient, per serving. */
function pickSuggestionFoods(lowCodes: NutrientCode[], foods: SuggestionFood[], perNutrient = 5) {
  const picked = new Map<string, SuggestionFood & { richIn: NutrientCode[] }>()
  for (const code of lowCodes) {
    const ranked = foods
      .filter((food) => (food.nutrients[code] ?? 0) > 0)
      .sort((left, right) => (right.nutrients[code] ?? 0) - (left.nutrients[code] ?? 0))
      .slice(0, perNutrient)
    for (const food of ranked) {
      const existing = picked.get(food.id)
      if (existing) existing.richIn.push(code)
      else picked.set(food.id, { ...food, richIn: [code] })
    }
  }
  return [...picked.values()]
}

/** Changes whenever what the trainee logged changes, so a cached insight knows it is stale. */
function intakeFingerprint(input: Pick<InsightInput, "today" | "week">) {
  const key = JSON.stringify({
    today: input.today ? [input.today.calories, input.today.protein, input.today.items, input.today.nutrients] : null,
    week: input.week.days.map((day) => [day.date, Math.round(day.calories), day.items]),
  })
  return createHash("sha1").update(key).digest("hex").slice(0, 16)
}

const outputSchema = z.object({
  summary: z.string().trim().min(1).max(300),
  points: z
    .array(z.object({ tone: z.enum(["good", "warn", "info"]), text: z.string().trim().min(1).max(300) }))
    .min(1)
    .max(5),
  suggestedFoodIds: z.array(z.string()).max(6).default([]),
})

type InsightOutput = z.infer<typeof outputSchema>

function validateInsight(value: unknown, allowedFoodIds: Set<string>): InsightOutput {
  const result = parseAI(outputSchema, value)
  const unknown = result.suggestedFoodIds.filter((id) => !allowedFoodIds.has(id))
  if (unknown.length > 0) {
    throw new AppError(`Dữ liệu AI không hợp lệ. suggestedFoodIds chỉ được lấy từ danh sách món đã cho; không có: ${unknown.join(", ")}.`, {
      code: "AI_VALIDATION_ERROR",
      status: 422,
    })
  }
  return { ...result, suggestedFoodIds: [...new Set(result.suggestedFoodIds)] }
}

const SYSTEM_PROMPT = `Bạn là chuyên gia dinh dưỡng trong app theo dõi ăn uống. Viết nhận xét ngắn gọn về lượng ăn của trainee DỰA HOÀN TOÀN trên các "phát hiện" backend đã tính sẵn.

## Quy tắc
- Chỉ nói những gì có trong danh sách phát hiện. Không suy đoán thêm chất nào, không tự tính lại, không đổi con số.
- "today" là hôm nay; "week" là trung bình trên các ngày có ghi nhật ký trong 7 ngày gần nhất (nói rõ "trung bình 7 ngày").
- Ưu tiên: vượt ngưỡng cần hạn chế (sodium, chất béo bão hoà) và thiếu kéo dài theo tuần quan trọng hơn thiếu trong một ngày.
- Có điểm tốt thì nêu 1 điểm tốt (tone "good"). Vấn đề dùng tone "warn". Gợi ý/ghi chú dùng tone "info".
- Gợi ý món: chỉ chọn id trong danh sách món được cung cấp, ưu tiên món bổ sung được nhiều chất đang thiếu. Nhắc tên món trong điểm "info" tương ứng.
- Nếu độ phủ dữ liệu vi chất thấp, nói ngắn rằng một số món chưa có dữ liệu vi chất nên chỉ nhận xét macro.
- Không chẩn đoán bệnh, không khuyên dùng thực phẩm chức năng/thuốc. Giọng tích cực, cụ thể, không phán xét.
- summary: 1 câu tổng quan. points: 2–4 điểm, mỗi điểm 1–2 câu.

## Trả về
Chỉ một JSON object, không markdown:
{"summary": string, "points": [{"tone": "good"|"warn"|"info", "text": string}], "suggestedFoodIds": [string]}`

function describeFinding(finding: Finding) {
  const scope = finding.scope === "week" ? "week" : "today"
  const relation = finding.status === "high" ? "vượt ngưỡng tối đa" : finding.status === "low" ? "thiếu" : "đạt"
  return `- [${scope}] ${finding.name}: ${finding.amount} / ${finding.target} ${finding.unit} → ${relation}`
}

async function generateNutritionInsight(
  provider: AIProvider,
  input: {
    findings: ReturnType<typeof buildInsightFindings>
    foods: Array<SuggestionFood & { richIn: NutrientCode[] }>
    names: InsightInput["names"]
    locale: "vi" | "en"
    traineeName?: string
  },
) {
  const { findings, hasTrend, microCoverage, microsUsable } = input.findings
  const foodLines = input.foods.map((food) => {
    const rich = food.richIn.map((code) => input.names[code]?.name ?? code).join(", ")
    return `- ${food.id} | ${sanitizeUserText(food.name)} | ${Math.round(food.calories)} kcal/khẩu phần | giàu: ${rich}`
  })
  const userPrompt = [
    `Ngôn ngữ trả lời: ${input.locale === "en" ? "English" : "tiếng Việt"}.`,
    input.traineeName ? `Trainee: <trainee_input>${sanitizeUserText(input.traineeName)}</trainee_input>` : "",
    `Có dữ liệu xu hướng tuần: ${hasTrend ? "có" : "không (chưa đủ 3 ngày ghi nhật ký)"}.`,
    `Độ phủ dữ liệu vi chất: ${microCoverage}% món đã ghi${microsUsable ? "" : " (thấp — chỉ nhận xét macro)"}.`,
    "",
    "## Phát hiện",
    findings.length > 0 ? findings.map(describeFinding).join("\n") : "- Không có chỉ số nào lệch đáng kể.",
    "",
    "## Món có thể gợi ý (id | tên | năng lượng | giàu chất)",
    foodLines.length > 0 ? foodLines.join("\n") : "- (không có — để suggestedFoodIds rỗng)",
  ]
    .filter(Boolean)
    .join("\n")

  const allowed = new Set(input.foods.map((food) => food.id))
  const { data, tokenUsage } = await generateValidatedJSON(
    provider,
    {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 700,
      repairInstruction: "Trả về JSON đầy đủ đã sửa lỗi này, chỉ dùng id món trong danh sách đã cho.",
    },
    (value) => validateInsight(value, allowed),
  )
  return { ...data, promptVersion: NUTRITION_INSIGHT_PROMPT_VERSION, tokenUsage }
}

export {
  buildInsightFindings,
  generateNutritionInsight,
  intakeFingerprint,
  NUTRITION_INSIGHT_PROMPT_VERSION,
  pickSuggestionFoods,
  validateInsight,
  type Finding,
  type InsightInput,
  type InsightOutput,
  type SuggestionFood,
}
