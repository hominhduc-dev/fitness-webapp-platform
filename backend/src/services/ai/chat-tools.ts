import type { AIToolDefinition } from "../../lib/ai/types"

/**
 * Tools the chat assistant may call mid-conversation.
 *
 * Keep the schemas aligned with the validation inside the matching service
 * function — the model fills these in from the conversation, so anything it can
 * express here must be something the service will actually accept.
 */

const CREATE_WORKOUT_PROGRAM = "create_workout_program" as const
const CREATE_MEAL_PLAN = "create_meal_plan" as const

const chatTools: AIToolDefinition[] = [
  {
    name: CREATE_WORKOUT_PROGRAM,
    description:
      "Tạo bản nháp chương trình tập luyện cá nhân hoá cho trainee. Chỉ gọi khi trainee thực sự muốn TẠO MỚI một chương trình và bạn đã biết đủ: mục tiêu, trình độ, số buổi/tuần, thời lượng mỗi buổi, thiết bị sẵn có, số tuần. Nếu còn thiếu thông tin quan trọng thì HỎI LẠI trainee thay vì gọi tool. Không gọi tool khi trainee chỉ hỏi ý kiến, hỏi nên tập gì hôm nay, hoặc hỏi về chương trình đang có. Kết quả là bản nháp — trainee vẫn phải bấm xác nhận thì mới được lưu.",
    parameters: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          enum: ["build_muscle", "lose_weight", "strength", "endurance", "general_fitness"],
          description: "Mục tiêu tập luyện chính.",
        },
        experienceLevel: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"],
          description: "Trình độ hiện tại của trainee.",
        },
        daysPerWeek: {
          type: "integer",
          minimum: 2,
          maximum: 7,
          description: "Số buổi tập mỗi tuần, từ 2 đến 7.",
        },
        sessionDuration: {
          type: "integer",
          minimum: 20,
          maximum: 180,
          description: "Thời lượng mỗi buổi tính bằng phút.",
        },
        availableEquipment: {
          type: "string",
          enum: ["full_gym", "home_dumbbells", "bodyweight"],
          description: "Thiết bị trainee có thể dùng.",
        },
        durationWeeks: {
          type: "integer",
          minimum: 1,
          maximum: 16,
          description: "Độ dài chương trình tính bằng tuần, từ 1 đến 16.",
        },
        focusAreas: {
          type: "array",
          items: { type: "string" },
          description: "Nhóm cơ muốn tập trung, ví dụ ['chest','back']. Bỏ trống nếu không có.",
        },
        injuries: {
          type: "string",
          description: "Chấn thương hoặc hạn chế cần tránh. Bỏ trống nếu không có.",
        },
      },
      required: [
        "goal",
        "experienceLevel",
        "daysPerWeek",
        "sessionDuration",
        "availableEquipment",
        "durationWeeks",
      ],
    },
  },
  {
    name: CREATE_MEAL_PLAN,
    description:
      "Tạo bản nháp thực đơn cho MỘT ngày dựa trên mục tiêu dinh dưỡng của trainee. Chỉ gọi khi trainee muốn một thực đơn cụ thể để ăn theo. KHÔNG gọi khi trainee chỉ hỏi nên ăn gì trước khi tập, hỏi một món bao nhiêu calo, hay hỏi hôm nay đã đủ protein chưa — những câu đó trả lời trực tiếp. Kết quả là bản nháp; trainee phải bấm xác nhận thì mới được ghi vào nhật ký.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Ngày áp dụng, định dạng YYYY-MM-DD. Bỏ trống nếu là hôm nay.",
        },
        preferences: {
          type: "string",
          description: "Sở thích hoặc kiêng khem, ví dụ 'không ăn hải sản', 'ăn chay'. Bỏ trống nếu không có.",
        },
        budget: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Ngân sách cho bữa ăn.",
        },
        cookingTime: {
          type: "string",
          enum: ["quick", "normal"],
          description: "Thời gian nấu trainee sẵn sàng bỏ ra.",
        },
      },
      required: [],
    },
  },
]

type CreateProgramArgs = {
  goal: string
  experienceLevel: string
  daysPerWeek: number
  sessionDuration: number
  availableEquipment: string
  durationWeeks: number
  focusAreas?: string[]
  injuries?: string
}

const GOALS = ["build_muscle", "lose_weight", "strength", "endurance", "general_fitness"]
const LEVELS = ["beginner", "intermediate", "advanced"]
const EQUIPMENT = ["full_gym", "home_dumbbells", "bodyweight"]

function asInt(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pickEnum(value: unknown, allowed: string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback
}

/**
 * Models can emit out-of-range or misspelled arguments. Coerce into something
 * the service will accept rather than letting a stray value turn into a 400 the
 * user sees as "AI hỏng".
 */
function normalizeCreateProgramArgs(raw: Record<string, unknown>): CreateProgramArgs {
  return {
    goal: pickEnum(raw.goal, GOALS, "general_fitness"),
    experienceLevel: pickEnum(raw.experienceLevel, LEVELS, "intermediate"),
    daysPerWeek: clamp(asInt(raw.daysPerWeek, 3), 2, 7),
    sessionDuration: clamp(asInt(raw.sessionDuration, 60), 20, 180),
    availableEquipment: pickEnum(raw.availableEquipment, EQUIPMENT, "full_gym"),
    durationWeeks: clamp(asInt(raw.durationWeeks, 8), 1, 16),
    focusAreas: Array.isArray(raw.focusAreas)
      ? raw.focusAreas.filter((area): area is string => typeof area === "string").slice(0, 6)
      : undefined,
    injuries: typeof raw.injuries === "string" && raw.injuries.trim() ? raw.injuries.trim() : undefined,
  }
}

type CreateMealPlanArgs = {
  date: string
  preferences?: string
  budget?: string
  cookingTime?: string
}

const BUDGETS = ["low", "medium", "high"]
const COOKING_TIMES = ["quick", "normal"]

function optionalText(value: unknown, maxLength = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined
}

/**
 * generateMealPlan rejects a malformed date with a 400 the trainee reads as
 * "AI hỏng", and the model has no reliable sense of today's date — so fall back
 * to today rather than passing whatever it invented straight through.
 */
function normalizeCreateMealPlanArgs(raw: Record<string, unknown>): CreateMealPlanArgs {
  const today = new Date().toISOString().slice(0, 10)
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim())
    ? raw.date.trim()
    : today

  return {
    date,
    preferences: optionalText(raw.preferences),
    budget: pickEnum(raw.budget, BUDGETS, "medium"),
    cookingTime: pickEnum(raw.cookingTime, COOKING_TIMES, "normal"),
  }
}

export {
  chatTools,
  CREATE_MEAL_PLAN,
  CREATE_WORKOUT_PROGRAM,
  normalizeCreateMealPlanArgs,
  normalizeCreateProgramArgs,
  type CreateMealPlanArgs,
  type CreateProgramArgs,
}
