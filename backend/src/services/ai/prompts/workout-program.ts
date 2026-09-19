/**
 * Prompt for the multi-week workout program.
 *
 * Changes from the previous inline version:
 *  - `name` is no longer requested (the backend derives it from `kind`), which
 *    also removes the contradiction between rule 7 and the output schema.
 *  - `variationId` (UUID) became `variationRef` (v1, v2, ...).
 *  - Free-text fields are wrapped in <trainee_input> and declared as data.
 *  - Safety red flags are explicit.
 *  - The catalog and rules sit in their own block so the caller can attach
 *    `cache_control: { type: "ephemeral" }` to it.
 */
import {
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

export type ProgramPromptInput = {
  goal: string
  experienceLevel: string
  daysPerWeek: number
  sessionDuration: number
  availableEquipment: string
  focusAreas?: string[]
  injuries?: string
  durationWeeks: number
  /** Present only when a coach generates for a trainee. */
  coachName?: string
  heightCm?: number | null
  targetWeightKg?: number | null
  /** Aggregated, not raw logs — see notes. */
  sessionsLast30Days: number
  recoverySummary?: string | null
  catalog: ExerciseCatalogIndex
}

const OUTPUT_SHAPE = {
  name: "string — tên chương trình bằng tiếng Việt",
  description: "string — mô tả ngắn bằng tiếng Việt, 1-2 câu",
  workouts: [
    {
      kind: "push|pull|legs|full_body|cardio|other",
      weekIndex: 0,
      scheduledDay: "number 0-6 (0=CN, 1=T2, ... 6=T7)",
      duration: "number — phút, không vượt thời lượng yêu cầu",
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
    },
  ],
}

export function buildProgramPrompt(input: ProgramPromptInput) {
  const systemPrompt = `Bạn là personal trainer AI chuyên nghiệp. Thiết kế chương trình tập luyện cá nhân hoá dựa trên dữ liệu được cung cấp.

QUY TẮC BẮT BUỘC
${WORKOUT_RULES}
- Chỉ tạo lịch cho tuần đầu tiên: mọi workout phải có weekIndex = 0. Backend sẽ sinh các tuần sau.
- Số buổi phải đúng bằng số buổi/tuần được yêu cầu, và mỗi buổi một scheduledDay KHÁC nhau. Không hai buổi cùng ngày.
- Xếp các ngày tập cách nhau hợp lý; không dồn hai buổi cùng nhóm cơ vào hai ngày liền kề.
- Ở buổi tập sức mạnh, đặt bài compound (nhiều nhóm cơ) lên trước bài isolation.
${JSON_ONLY_RULE}

AN TOÀN
${SAFETY_RULES}`

  const goal = label(GOAL_LABELS, input.goal)
  const level = label(LEVEL_LABELS, input.experienceLevel)
  const equipment = label(EQUIPMENT_LABELS, input.availableEquipment)

  // Catalog + schema first: this block is identical across users with the same
  // equipment filter, so it is the part worth caching.
  const referenceBlock = [
    "## Exercise Catalog (CHỈ dùng variationRef trong list này)",
    JSON.stringify(input.catalog.prompt),
    "",
    "## Output JSON Shape",
    JSON.stringify(OUTPUT_SHAPE, null, 2),
  ].join("\n")

  const traineeBlock = [
    "## Yêu cầu chương trình",
    `- Mục tiêu: ${goal}`,
    `- Trình độ: ${level}`,
    `- Số buổi/tuần: ${input.daysPerWeek}`,
    `- Thời lượng mỗi buổi: tối đa ${input.sessionDuration} phút`,
    `- Thiết bị: ${equipment}`,
    `- Thời gian chương trình: ${input.durationWeeks} tuần`,
    "",
    "## Dữ liệu trainee",
    `- Chiều cao: ${input.heightCm ?? "chưa cập nhật"}${input.heightCm ? "cm" : ""}`,
    `- Cân nặng mục tiêu: ${input.targetWeightKg ? `${input.targetWeightKg}kg` : "chưa cập nhật"}`,
    `- Số buổi đã tập trong 30 ngày qua: ${input.sessionsLast30Days}`,
    `- Hồi phục / readiness: ${input.recoverySummary ?? "Chưa có dữ liệu; không tự suy đoán."}`,
    input.coachName ? "- Chương trình này do coach tạo cho trainee." : "",
    "",
    "## Vùng tập trung (do trainee chọn)",
    input.focusAreas?.length
      ? traineeInput(input.focusAreas.join(", "), "Không chỉ định — tự cân đối toàn thân.")
      : "Không chỉ định — tự cân đối toàn thân.",
    "",
    "## Chấn thương / hạn chế (do trainee nhập)",
    traineeInput(input.injuries, "Không khai báo chấn thương."),
  ]
    .filter(Boolean)
    .join("\n")

  return {
    systemPrompt,
    userPrompt: `${referenceBlock}\n\n${traineeBlock}`,
    /** Attach cache_control to this when the provider layer supports it. */
    cacheableBlock: referenceBlock,
    promptVersion: PROMPT_VERSION,
  }
}
