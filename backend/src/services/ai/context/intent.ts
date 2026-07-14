import { normalizeText } from "./helpers"
import type { AIChatIntent, ChatMessage, IntentResult } from "./types"

const INTENT_KEYWORDS: Array<{
  intent: AIChatIntent
  keywords: string[]
  reason: string
}> = [
  {
    intent: "coach_feedback",
    keywords: ["coach", "feedback", "check in", "checkin", "nhan xet", "gop y", "huan luyen vien", "hlv"],
    reason: "Câu hỏi nhắc đến coach, feedback hoặc check-in.",
  },
  {
    intent: "exercise_progression",
    keywords: [
      "tien bo",
      "tang ta",
      "giam ta",
      "progress",
      "progression",
      "pr",
      "bench",
      "squat",
      "deadlift",
      "press",
      "row",
      "set",
      "reps",
      "rir",
      "volume",
      "khong len",
      "plateau",
    ],
    reason: "Câu hỏi tập trung vào tiến độ bài tập, tạ, reps hoặc volume.",
  },
  {
    intent: "workout_today",
    keywords: [
      "hom nay tap gi",
      "tap gi hom nay",
      "workout hom nay",
      "today workout",
      "buoi tap hom nay",
      "lich hom nay",
      "next workout",
      "tap tiep",
    ],
    reason: "Câu hỏi hỏi buổi tập hôm nay hoặc buổi tiếp theo.",
  },
  {
    intent: "program_review",
    keywords: ["chuong trinh", "program", "routine", "split", "lich tap", "plan", "ke hoach tap", "phan bo buoi"],
    reason: "Câu hỏi hỏi về chương trình hoặc lịch tập tổng thể.",
  },
  {
    intent: "nutrition_trend",
    keywords: ["an uong gan day", "dinh duong gan day", "trung binh", "7 ngay", "14 ngay", "tuan nay an", "macro trend"],
    reason: "Câu hỏi hỏi xu hướng dinh dưỡng nhiều ngày.",
  },
  {
    intent: "nutrition_today",
    keywords: [
      "hom nay an",
      "an gi",
      "protein",
      "calo",
      "calorie",
      "kcal",
      "macro",
      "carb",
      "fat",
      "bua an",
      "con bao nhieu",
      "du protein",
    ],
    reason: "Câu hỏi hỏi bữa ăn, calories hoặc macro.",
  },
  {
    intent: "weight_progress",
    keywords: ["can nang", "giam can", "tang can", "body fat", "mo", "vong eo", "target weight", "muc tieu can"],
    reason: "Câu hỏi hỏi cân nặng, body metrics hoặc mục tiêu cân nặng.",
  },
]

export function detectAIChatIntent(message: string, history: ChatMessage[] = []): IntentResult {
  const latestHistory = history
    .slice(-2)
    .map((entry) => entry.content)
    .join(" ")
  const normalized = normalizeText(`${latestHistory} ${message}`)
  let best: IntentResult = {
    intent: "general_fitness",
    reason: "Không có keyword đủ rõ, dùng context fitness tổng quát.",
    score: 0,
  }

  for (const candidate of INTENT_KEYWORDS) {
    const score = candidate.keywords.reduce((total, keyword) => {
      return total + (normalized.includes(normalizeText(keyword)) ? 1 : 0)
    }, 0)

    if (score > best.score) {
      best = {
        intent: candidate.intent,
        reason: candidate.reason,
        score,
      }
    }
  }

  return best
}
