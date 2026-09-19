/**
 * Prompt for a single session today.
 *
 * Changes from the previous inline version:
 *  - `name` and `duration` are gone from the output. The backend already
 *    overwrote both (`getEnglishWorkoutName(kind)` and `input.sessionDuration`),
 *    and asking for `name` in English while the schema said Vietnamese was a
 *    direct contradiction inside one request.
 *  - `variationId` (UUID) became `variationRef`.
 *  - Free-text fields wrapped in <trainee_input>; safety red flags explicit.
 */
import {
  ENERGY_LABELS,
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  JSON_ONLY_RULE,
  LEVEL_LABELS,
  label,
  PROMPT_VERSION,
  SAFETY_RULES,
  traineeInput,
  WORKOUT_RULES,
  type ExerciseCatalogIndex,
} from "./shared"

export type DailyWorkoutPromptInput = {
  date: string
  goal: string
  experienceLevel: string
  sessionDuration: number
  availableEquipment: string
  energyLevel: "low" | "normal" | "high"
  focusAreas?: string[]
  injuries?: string
  sessionsLast30Days: number
  recoverySummary?: string | null
  /** Session kinds from the last few days, so today does not repeat them. */
  recentKinds?: string[]
  catalog: ExerciseCatalogIndex
}

const OUTPUT_SHAPE = {
  description: "string — mô tả ngắn buổi tập bằng tiếng Việt, 1-2 câu",
  kind: "push|pull|legs|full_body|cardio|other",
  warmup: "string — hướng dẫn khởi động ngắn bằng tiếng Việt",
  exercises: [
    {
      variationRef: "ref từ catalog, ví dụ v12",
      sets: "number 1-12",
      reps: "number 1-200",
      repsMin: "number (optional)",
      rir: "number (optional, 0-4)",
      restTime: "number giây (optional)",
      weight: "number kg (optional)",
    },
  ],
}

export function buildDailyWorkoutPrompt(input: DailyWorkoutPromptInput) {
  const systemPrompt = `Bạn là personal trainer AI. Hãy thiết kế ĐÚNG MỘT buổi tập cho ngày được yêu cầu.

QUY TẮC BẮT BUỘC
${WORKOUT_RULES}
- Điều chỉnh volume theo trình độ, thời lượng và mức năng lượng hôm nay. Năng lượng thấp: giảm số set và chọn bài ít gây mệt mỏi toàn thân, không đổi sang buổi dài hơn.
- Chọn kind sao cho không lặp lại nhóm cơ đã tập trong 2 ngày gần nhất (nếu có dữ liệu).
- Đặt bài compound trước bài isolation.
${JSON_ONLY_RULE}

AN TOÀN
${SAFETY_RULES}`

  const referenceBlock = [
    "## Exercise Catalog (CHỈ dùng variationRef trong list này)",
    JSON.stringify(input.catalog.prompt),
    "",
    "## Output JSON Shape",
    JSON.stringify(OUTPUT_SHAPE, null, 2),
  ].join("\n")

  const traineeBlock = [
    "## Buổi tập cần tạo",
    `- Ngày: ${input.date}`,
    `- Mục tiêu: ${label(GOAL_LABELS, input.goal)}`,
    `- Trình độ: ${label(LEVEL_LABELS, input.experienceLevel)}`,
    `- Thời lượng: ${input.sessionDuration} phút`,
    `- Thiết bị: ${label(EQUIPMENT_LABELS, input.availableEquipment)}`,
    `- Mức năng lượng hôm nay: ${label(ENERGY_LABELS, input.energyLevel)}`,
    "",
    "## Dữ liệu trainee",
    `- Số buổi đã tập trong 30 ngày qua: ${input.sessionsLast30Days}`,
    `- Các buổi gần nhất: ${input.recentKinds?.length ? input.recentKinds.join(", ") : "Chưa có dữ liệu"}`,
    `- Hồi phục / readiness: ${input.recoverySummary ?? "Chưa có dữ liệu; không tự suy đoán."}`,
    "",
    "## Nhóm cơ trainee muốn tập hôm nay",
    input.focusAreas?.length
      ? traineeInput(input.focusAreas.join(", "), "Không chỉ định — tự cân đối.")
      : "Không chỉ định — tự cân đối.",
    "",
    "## Chấn thương / hạn chế (do trainee nhập)",
    traineeInput(input.injuries, "Không khai báo chấn thương."),
  ].join("\n")

  return {
    systemPrompt,
    userPrompt: `${referenceBlock}\n\n${traineeBlock}`,
    cacheableBlock: referenceBlock,
    promptVersion: PROMPT_VERSION,
  }
}
