import { generateMealPlanSchema, generateProgramSchema } from "../../routes/ai.schemas"
import { parseAI } from "../../lib/ai/output-schemas"
import { localDateKey } from "../../lib/ai/calendar"
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

function normalizeCreateProgramArgs(raw: Record<string, unknown>): CreateProgramArgs {
  return parseAI(generateProgramSchema, raw)
}

type CreateMealPlanArgs = { date: string; preferences?: string; budget?: string; cookingTime?: string }

function normalizeCreateMealPlanArgs(raw: Record<string, unknown>): CreateMealPlanArgs {
  return parseAI(generateMealPlanSchema, { ...raw, date: raw.date ?? localDateKey() })
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
