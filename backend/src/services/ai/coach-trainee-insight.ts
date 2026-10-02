/**
 * AI analysis of a trainee for their coach.
 *
 * Same split as the nutrition insight: the backend works out every number
 * (sessions done against the program, lift progression, weight, intake,
 * recovery) for the chosen window and the window before it, and flags what is
 * off. The model only writes commentary and text suggestions from those
 * figures. It never edits the program or the meal plan, and it never sees raw
 * logs to reinterpret.
 */
import { createHash } from "node:crypto"
import { z } from "zod"

import { parseAI } from "../../lib/ai/output-schemas"
import type { AIProvider } from "../../lib/ai/types"
import { generateValidatedJSON } from "../../lib/ai/validated-generation"
import { AppError } from "../errors"
import { sanitizeUserText } from "./prompts/shared"

const COACH_TRAINEE_INSIGHT_PROMPT_VERSION = "2026-10-02.1"

const INSIGHT_WINDOWS = [7, 14, 28] as const
type InsightWindow = (typeof INSIGHT_WINDOWS)[number]
type InsightLocale = "vi" | "en"

const LIFTS_SHOWN = 5

// ---------------------------------------------------------------------------
// Inputs: already loaded and trimmed to the two windows by the service.
// ---------------------------------------------------------------------------

type InsightSet = { completed: boolean; reps: number | null; weight: number | null }
type InsightLog = {
  /** `YYYY-MM-DD`, the client day the session was started. */
  date: string
  /** True when the session belongs to a program the coach assigned. */
  fromProgram: boolean
  exercises: Array<{ name: string; sets: InsightSet[] }>
  volumeKg: number | null
}

type CoachInsightInput = {
  days: InsightWindow
  /** `YYYY-MM-DD` of the trainee's today; the current window ends here. */
  today: string
  /** Program sessions due, one `YYYY-MM-DD` per session, both windows. */
  plannedDates: string[]
  logs: InsightLog[]
  weights: Array<{ date: string; weightKg: number }>
  intake: Array<{ date: string; calories: number; protein: number }>
  recovery: Array<{ date: string; readiness: number | null; sleepMinutes: number | null; stress: number | null; fatigue: number | null }>
  wearable: Array<{ date: string; steps: number | null; restingHeartRate: number | null }>
  goals: { calories: number; protein: number; targetWeightKg: number | null }
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

type PeriodStats = {
  start: string
  end: string
  training: {
    planned: number
    completed: number
    /** Program sessions done out of those due, capped at 100. Null with nothing due. */
    adherencePct: number | null
    extraSessions: number
    setsCompleted: number
    setsTotal: number
    volumeKg: number
  }
  nutrition: {
    loggedDays: number
    avgCalories: number | null
    avgProtein: number | null
    caloriePct: number | null
    proteinPct: number | null
  }
  weight: { entries: number; first: number | null; last: number | null; change: number | null }
  recovery: {
    checkIns: number
    avgReadiness: number | null
    avgSleepHours: number | null
    avgStress: number | null
    avgFatigue: number | null
  }
  wearable: { days: number; avgSteps: number | null; avgRestingHeartRate: number | null }
}

type LiftTrend = {
  name: string
  sets: number
  best: { weight: number; reps: number; e1rm: number }
  previousBest: { weight: number; reps: number; e1rm: number } | null
  /** e1RM change against the previous window, in percent. */
  changePct: number | null
}

type SignalArea = "training" | "progression" | "weight" | "nutrition" | "recovery"
type Signal = { area: SignalArea; tone: "good" | "warn" | "info"; code: string }

type CoachInsightFindings = {
  days: InsightWindow
  current: PeriodStats
  previous: PeriodStats
  lifts: LiftTrend[]
  goals: CoachInsightInput["goals"]
  /** Kilograms still to go to the target weight from the latest entry, signed. */
  toTargetKg: number | null
  signals: Signal[]
}

function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function insightWindows(today: string, days: number) {
  const currentStart = shiftDateKey(today, -(days - 1))
  const previousEnd = shiftDateKey(currentStart, -1)
  return {
    current: { end: today, start: currentStart },
    previous: { end: previousEnd, start: shiftDateKey(previousEnd, -(days - 1)) },
  }
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function average(values: Array<number | null | undefined>, digits = 0) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (present.length === 0) return null
  return round(present.reduce((sum, value) => sum + value, 0) / present.length, digits)
}

function percent(amount: number | null, target: number) {
  if (amount == null || target <= 0) return null
  return Math.round((amount / target) * 100)
}

/** Epley estimate; comparable across rep ranges, which raw top weight is not. */
function estimateOneRepMax(weight: number, reps: number) {
  return round(reps <= 1 ? weight : weight * (1 + reps / 30), 1)
}

function buildPeriodStats(input: CoachInsightInput, start: string, end: string): PeriodStats {
  const within = <T extends { date: string }>(rows: T[]) => rows.filter((row) => row.date >= start && row.date <= end)

  const planned = input.plannedDates.filter((date) => date >= start && date <= end && date <= input.today).length
  const logs = within(input.logs)
  const programLogs = logs.filter((log) => log.fromProgram)
  const completed = programLogs.length
  let setsCompleted = 0
  let setsTotal = 0
  for (const log of programLogs) {
    for (const exercise of log.exercises) {
      setsTotal += exercise.sets.length
      setsCompleted += exercise.sets.filter((set) => set.completed).length
    }
  }

  const intake = within(input.intake).filter((day) => day.calories > 0 || day.protein > 0)
  const avgCalories = average(intake.map((day) => day.calories))
  const avgProtein = average(intake.map((day) => day.protein))

  const weights = within(input.weights).sort((left, right) => left.date.localeCompare(right.date))
  const first = weights[0]?.weightKg ?? null
  const last = weights.at(-1)?.weightKg ?? null

  const recovery = within(input.recovery)
  const sleep = average(recovery.map((row) => row.sleepMinutes))
  const wearable = within(input.wearable)

  return {
    end,
    nutrition: {
      avgCalories,
      avgProtein,
      caloriePct: percent(avgCalories, input.goals.calories),
      loggedDays: intake.length,
      proteinPct: percent(avgProtein, input.goals.protein),
    },
    recovery: {
      avgFatigue: average(recovery.map((row) => row.fatigue), 1),
      avgReadiness: average(recovery.map((row) => row.readiness)),
      avgSleepHours: sleep == null ? null : round(sleep / 60, 1),
      avgStress: average(recovery.map((row) => row.stress)),
      checkIns: recovery.length,
    },
    start,
    training: {
      adherencePct: planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : null,
      completed,
      extraSessions: logs.length - programLogs.length,
      planned,
      setsCompleted,
      setsTotal,
      volumeKg: Math.round(logs.reduce((sum, log) => sum + (log.volumeKg ?? 0), 0)),
    },
    wearable: {
      avgRestingHeartRate: average(wearable.map((row) => row.restingHeartRate)),
      avgSteps: average(wearable.map((row) => row.steps)),
      days: wearable.length,
    },
    weight: {
      change: first != null && last != null && weights.length > 1 ? round(last - first, 1) : null,
      entries: weights.length,
      first,
      last,
    },
  }
}

function bestSetsByExercise(logs: InsightLog[]) {
  const byName = new Map<string, { best: LiftTrend["best"]; sets: number }>()
  for (const log of logs) {
    for (const exercise of log.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || !set.weight || set.weight <= 0 || !set.reps || set.reps <= 0) continue
        const e1rm = estimateOneRepMax(set.weight, set.reps)
        const entry = byName.get(exercise.name) ?? { best: { e1rm, reps: set.reps, weight: set.weight }, sets: 0 }
        entry.sets += 1
        if (e1rm > entry.best.e1rm) entry.best = { e1rm, reps: set.reps, weight: set.weight }
        byName.set(exercise.name, entry)
      }
    }
  }
  return byName
}

function buildLiftTrends(input: CoachInsightInput, windows: ReturnType<typeof insightWindows>): LiftTrend[] {
  const inWindow = (window: { start: string; end: string }) => input.logs.filter((log) => log.date >= window.start && log.date <= window.end)
  const current = bestSetsByExercise(inWindow(windows.current))
  const previous = bestSetsByExercise(inWindow(windows.previous))

  return [...current.entries()]
    .sort((left, right) => right[1].sets - left[1].sets)
    .slice(0, LIFTS_SHOWN)
    .map(([name, entry]) => {
      const before = previous.get(name)?.best ?? null
      return {
        best: entry.best,
        changePct: before ? round(((entry.best.e1rm - before.e1rm) / before.e1rm) * 100, 1) : null,
        name,
        previousBest: before,
        sets: entry.sets,
      }
    })
}

/** Deterministic flags the model must stay inside. Codes, not prose, so they are testable. */
function buildSignals(findings: Omit<CoachInsightFindings, "signals">): Signal[] {
  const signals: Signal[] = []
  const { current, days } = findings
  const push = (area: SignalArea, tone: Signal["tone"], code: string) => signals.push({ area, code, tone })

  const adherence = current.training.adherencePct
  if (adherence == null) push("training", "info", "no_program_sessions_due")
  else if (adherence >= 90) push("training", "good", "adherence_high")
  else if (adherence < 70) push("training", "warn", "adherence_low")
  if (current.training.setsTotal > 0 && current.training.setsCompleted / current.training.setsTotal < 0.8) {
    push("training", "warn", "sets_skipped")
  }

  const moving = findings.lifts.filter((lift) => lift.changePct != null)
  if (moving.some((lift) => (lift.changePct ?? 0) >= 2)) push("progression", "good", "lifts_up")
  if (moving.length > 0 && moving.every((lift) => (lift.changePct ?? 0) <= 0)) push("progression", "warn", "lifts_stalled")

  if (current.weight.entries === 0) push("weight", "info", "no_weight_logged")
  else if (findings.toTargetKg != null && current.weight.change != null && current.weight.change !== 0) {
    const towardTarget = Math.sign(current.weight.change) === Math.sign(findings.toTargetKg)
    push("weight", towardTarget ? "good" : "warn", towardTarget ? "weight_toward_target" : "weight_away_from_target")
  }
  const weeklyRate = current.weight.change != null && current.weight.last ? Math.abs(current.weight.change) / (days / 7) / current.weight.last : 0
  if (weeklyRate > 0.01) push("weight", "warn", "weight_changing_fast")

  if (current.nutrition.loggedDays < Math.ceil(days / 2)) push("nutrition", "warn", "intake_logging_sparse")
  const caloriePct = current.nutrition.caloriePct
  if (caloriePct != null && caloriePct < 85) push("nutrition", "warn", "calories_under_goal")
  if (caloriePct != null && caloriePct > 115) push("nutrition", "warn", "calories_over_goal")
  const proteinPct = current.nutrition.proteinPct
  if (proteinPct != null && proteinPct < 80) push("nutrition", "warn", "protein_low")
  if (proteinPct != null && proteinPct >= 90 && caloriePct != null && caloriePct >= 85 && caloriePct <= 115) {
    push("nutrition", "good", "intake_on_target")
  }

  const { avgReadiness, avgSleepHours, avgStress, checkIns } = current.recovery
  if (checkIns === 0) push("recovery", "info", "no_recovery_data")
  if (avgReadiness != null && avgReadiness < 50) push("recovery", "warn", "readiness_low")
  if (avgReadiness != null && avgReadiness >= 70) push("recovery", "good", "readiness_good")
  if (avgSleepHours != null && avgSleepHours < 6.5) push("recovery", "warn", "sleep_short")
  // Huawei's 1–99 stress scale: 60 and up is medium-to-high.
  if (avgStress != null && avgStress >= 60) push("recovery", "warn", "stress_high")

  return signals
}

function buildCoachInsightFindings(input: CoachInsightInput): CoachInsightFindings {
  const windows = insightWindows(input.today, input.days)
  const current = buildPeriodStats(input, windows.current.start, windows.current.end)
  const previous = buildPeriodStats(input, windows.previous.start, windows.previous.end)
  const latestWeight = [...input.weights].sort((left, right) => left.date.localeCompare(right.date)).at(-1)?.weightKg ?? null
  const toTargetKg = input.goals.targetWeightKg != null && latestWeight != null ? round(input.goals.targetWeightKg - latestWeight, 1) : null

  const base = { current, days: input.days, goals: input.goals, lifts: buildLiftTrends(input, windows), previous, toTargetKg }
  return { ...base, signals: buildSignals(base) }
}

function hasAnyData(findings: CoachInsightFindings) {
  const { current } = findings
  return (
    current.training.planned + current.training.completed + current.training.extraSessions > 0 ||
    current.nutrition.loggedDays > 0 ||
    current.weight.entries > 0 ||
    current.recovery.checkIns > 0 ||
    current.wearable.days > 0
  )
}

/** Changes whenever anything the report is built on changes, so a saved report knows it is stale. */
function coachInsightFingerprint(findings: CoachInsightFindings) {
  const key = JSON.stringify([findings.days, findings.current, findings.previous, findings.lifts, findings.goals])
  return createHash("sha1").update(key).digest("hex").slice(0, 16)
}

// ---------------------------------------------------------------------------
// Model output
// ---------------------------------------------------------------------------

const outputSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  sections: z
    .array(
      z.object({
        area: z.enum(["training", "progression", "weight", "nutrition", "recovery"]),
        tone: z.enum(["good", "warn", "info"]),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .min(1)
    .max(6),
  suggestions: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
})

type CoachInsightOutput = z.infer<typeof outputSchema>

/** Letters only Vietnamese uses; tone marks on a bare vowel are left out because French names have them too. */
const VIETNAMESE_LETTERS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
/** Any Vietnamese diacritic, for telling a Vietnamese sentence from an English one. */
const VIETNAMESE_MARKS = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i

/**
 * Exercise names, codes and numbers are often English, so the model drifts
 * into English. Most of the texts, the summary always, must be in the
 * coach's language; a stray Vietnamese exercise name in English text is fine.
 */
function assertInsightLanguage(output: CoachInsightOutput, locale: InsightLocale) {
  const texts = [output.summary, ...output.sections.map((section) => section.text), ...output.suggestions]
  const inVietnamese = texts.filter((text) => (locale === "vi" ? VIETNAMESE_MARKS : VIETNAMESE_LETTERS).test(text))
  const wrong =
    locale === "vi"
      ? !VIETNAMESE_MARKS.test(output.summary) || inVietnamese.length < texts.length / 2
      : VIETNAMESE_LETTERS.test(output.summary) || inVietnamese.length > texts.length / 2
  if (wrong) {
    throw new AppError(
      locale === "vi"
        ? "Dữ liệu AI không hợp lệ: nội dung phải viết bằng tiếng Việt có dấu, không dùng tiếng Anh."
        : "Dữ liệu AI không hợp lệ: nội dung phải viết bằng tiếng Anh (English), không dùng tiếng Việt.",
      { code: "AI_VALIDATION_ERROR", status: 422 },
    )
  }
}

function validateCoachInsight(value: unknown, locale: InsightLocale = "vi"): CoachInsightOutput {
  const output = parseAI(outputSchema, value)
  assertInsightLanguage(output, locale)
  return output
}

const SYSTEM_PROMPT = `Bạn là trợ lý phân tích cho huấn luyện viên (coach) trong một app tập luyện. Coach muốn biết trainee đang đi đúng program hay không. Viết nhận xét DỰA HOÀN TOÀN trên số liệu backend đã tính sẵn.

## Quy tắc
- Người đọc là coach, không phải trainee. Gọi trainee bằng tên hoặc "trainee".
- Chỉ dùng số liệu được cho. Không tự tính lại, không đổi con số, không suy đoán dữ liệu không có. Thiếu dữ liệu thì nói là thiếu.
- So sánh kỳ hiện tại với kỳ trước khi có số của cả hai.
- Các "tín hiệu" là kết luận backend đã chốt: phải phản ánh đúng tone của chúng, không được đảo ngược.
- sections: mỗi mảng có dữ liệu một mục (training = mức bám program, progression = sức mạnh, weight = cân nặng, nutrition = calories/protein, recovery = ngủ/stress/readiness). 1–2 câu mỗi mục, có số cụ thể.
- suggestions: 2–4 gợi ý hành động cụ thể cho coach (ví dụ: nhắc trainee ghi bữa ăn, cân nhắc giảm volume tuần tới, hỏi về giấc ngủ). Chỉ là lời khuyên bằng chữ; coach tự quyết định thay đổi program hay thực đơn.
- Không chẩn đoán bệnh, không khuyên thuốc/thực phẩm chức năng. Giọng chuyên nghiệp, ngắn gọn.

## Trả về
Chỉ một JSON object, không markdown:
{"summary": string, "sections": [{"area": "training"|"progression"|"weight"|"nutrition"|"recovery", "tone": "good"|"warn"|"info", "text": string}], "suggestions": [string]}`

/** The language rule goes last in the system prompt, where it outweighs the English names and codes in the data. */
function systemPromptFor(locale: InsightLocale) {
  return locale === "en"
    ? `${SYSTEM_PROMPT}\n\n## Ngôn ngữ\nWrite summary, every section text and every suggestion in English only.`
    : `${SYSTEM_PROMPT}\n\n## Ngôn ngữ\nViết summary, mọi section text và mọi suggestion hoàn toàn bằng tiếng Việt có dấu. Giữ nguyên tên bài tập và con số, nhưng câu văn không được viết bằng tiếng Anh.`
}

const fmt = (value: number | null | undefined, unit = "") => (value == null ? "không có dữ liệu" : `${value}${unit}`)

function describePeriod(label: string, stats: PeriodStats) {
  const { nutrition, recovery, training, wearable, weight } = stats
  return [
    `### ${label} (${stats.start} → ${stats.end})`,
    `- Buổi tập theo program: ${training.completed}/${training.planned} buổi đến hạn (bám program ${fmt(training.adherencePct, "%")}); buổi ngoài program: ${training.extraSessions}.`,
    `- Set hoàn thành: ${training.setsCompleted}/${training.setsTotal}; tổng volume: ${training.volumeKg} kg.`,
    `- Dinh dưỡng: ${nutrition.loggedDays} ngày có ghi; TB ${fmt(nutrition.avgCalories, " kcal")} (${fmt(nutrition.caloriePct, "% mục tiêu")}), protein TB ${fmt(nutrition.avgProtein, " g")} (${fmt(nutrition.proteinPct, "% mục tiêu")}).`,
    `- Cân nặng: ${weight.entries} lần cân; ${fmt(weight.first, " kg")} → ${fmt(weight.last, " kg")} (thay đổi ${fmt(weight.change, " kg")}).`,
    `- Phục hồi: ${recovery.checkIns} lần check-in; readiness TB ${fmt(recovery.avgReadiness, "/100")}, ngủ TB ${fmt(recovery.avgSleepHours, " giờ")}, stress TB ${fmt(recovery.avgStress, "/99")}, mệt mỏi TB ${fmt(recovery.avgFatigue, "/5")}.`,
    wearable.days > 0 ? `- Đồng hồ: ${wearable.days} ngày; bước chân TB ${fmt(wearable.avgSteps)}, nhịp tim nghỉ TB ${fmt(wearable.avgRestingHeartRate, " bpm")}.` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function describeLift(lift: LiftTrend) {
  const best = `${lift.best.weight}kg×${lift.best.reps} (e1RM ${lift.best.e1rm})`
  const before = lift.previousBest ? `kỳ trước ${lift.previousBest.weight}kg×${lift.previousBest.reps} (e1RM ${lift.previousBest.e1rm})` : "kỳ trước chưa tập"
  const change = lift.changePct == null ? "" : `, thay đổi ${lift.changePct > 0 ? "+" : ""}${lift.changePct}%`
  return `- ${sanitizeUserText(lift.name)}: ${lift.sets} set; tốt nhất ${best}; ${before}${change}.`
}

function buildCoachInsightPrompt(findings: CoachInsightFindings, options: { locale: InsightLocale; traineeName?: string; programNames: string[] }) {
  const { goals } = findings
  return [
    `Ngôn ngữ trả lời: ${options.locale === "en" ? "English" : "tiếng Việt"}.`,
    options.traineeName ? `Trainee: <trainee_input>${sanitizeUserText(options.traineeName)}</trainee_input>` : "",
    options.programNames.length > 0
      ? `Program đang assign: ${options.programNames.map((name) => `<trainee_input>${sanitizeUserText(name)}</trainee_input>`).join(", ")}`
      : "Program đang assign: không có.",
    `Khoảng phân tích: ${findings.days} ngày gần nhất, so với ${findings.days} ngày trước đó.`,
    `Mục tiêu: ${goals.calories} kcal/ngày, protein ${goals.protein} g/ngày, cân nặng mục tiêu ${fmt(goals.targetWeightKg, " kg")}${findings.toTargetKg != null ? ` (còn ${findings.toTargetKg > 0 ? "+" : ""}${findings.toTargetKg} kg)` : ""}.`,
    "",
    describePeriod("Kỳ hiện tại", findings.current),
    "",
    describePeriod("Kỳ trước", findings.previous),
    "",
    "### Bài chính (theo số set kỳ hiện tại)",
    findings.lifts.length > 0 ? findings.lifts.map(describeLift).join("\n") : "- Chưa có set có tạ trong kỳ này.",
    "",
    "### Tín hiệu",
    findings.signals.length > 0 ? findings.signals.map((signal) => `- [${signal.area}] ${signal.tone}: ${signal.code}`).join("\n") : "- Không có.",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .replace(/\n(###)/g, "\n\n$1")
}

async function generateCoachTraineeInsight(
  provider: AIProvider,
  findings: CoachInsightFindings,
  options: { locale: InsightLocale; traineeName?: string; programNames: string[] },
) {
  const { data, tokenUsage } = await generateValidatedJSON(
    provider,
    {
      systemPrompt: systemPromptFor(options.locale),
      userPrompt: buildCoachInsightPrompt(findings, options),
      maxTokens: 1200,
      repairInstruction:
        options.locale === "en"
          ? "Return the full corrected JSON with summary, sections and suggestions, all written in English."
          : "Trả về JSON đầy đủ đã sửa lỗi này, đúng các trường summary, sections, suggestions, viết hoàn toàn bằng tiếng Việt.",
    },
    (value) => validateCoachInsight(value, options.locale),
  )
  return { ...data, promptVersion: COACH_TRAINEE_INSIGHT_PROMPT_VERSION, tokenUsage }
}

export {
  buildCoachInsightFindings,
  buildCoachInsightPrompt,
  COACH_TRAINEE_INSIGHT_PROMPT_VERSION,
  coachInsightFingerprint,
  generateCoachTraineeInsight,
  hasAnyData,
  INSIGHT_WINDOWS,
  insightWindows,
  shiftDateKey,
  validateCoachInsight,
  type CoachInsightFindings,
  type CoachInsightInput,
  type CoachInsightOutput,
  type InsightLog,
  type InsightWindow,
  type LiftTrend,
  type PeriodStats,
  type Signal,
}
