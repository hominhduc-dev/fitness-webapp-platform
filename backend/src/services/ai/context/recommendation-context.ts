import type { SerializedProfile } from "../../auth.service"
import type { TrainingRecommendation } from "../../../domain/training-recommendation"
import { logger } from "../../../lib/logger"
import { getTrainingRecommendationForTrainee } from "../../training-recommendation.service"
import { createSection, formatNumber } from "./helpers"
import type { ContextSection } from "./types"

const DAY_ACTION_TEXT: Record<TrainingRecommendation["day"]["action"], string> = {
  light_session: "buổi nhẹ",
  proceed: "tập theo kế hoạch",
  reduce_volume: "giảm volume",
  rest: "nghỉ",
}

const EXERCISE_ACTION_TEXT: Record<string, string> = {
  add_load: "tăng tạ",
  add_reps: "giữ tạ, thêm rep",
  establish_baseline: "chưa có lịch sử, tập để lấy mốc",
  maintain: "giữ như buổi trước",
  reduce_load: "giảm tạ",
}

const MUSCLE_ACTION_TEXT: Record<TrainingRecommendation["muscles"][number]["action"], string> = {
  decrease: "giảm",
  deload: "deload",
  increase: "tăng",
  maintain: "giữ",
}

/**
 * The server's own recommendation, so the AI explains what the engines decided
 * instead of re-deriving load and volume from raw history and contradicting
 * the numbers the trainee sees in the app.
 */
function formatRecommendationLines(recommendation: TrainingRecommendation) {
  const { day, intensity, muscles, workout } = recommendation
  const lines = [
    "- Đây là kết quả của engine trong app. Giải thích và áp dụng nó; KHÔNG tự đề xuất số tạ/rep/set khác với các con số dưới đây.",
    `- Hôm nay: ${DAY_ACTION_TEXT[day.action]}${day.setAdjustmentPct !== 0 ? ` (${day.setAdjustmentPct > 0 ? "+" : ""}${day.setAdjustmentPct}% số set)` : ""}${day.focusMuscles.length ? `, cẩn thận nhóm cơ: ${day.focusMuscles.join(", ")}` : ""}.`,
  ]

  if (intensity.phase || intensity.targetRir != null) {
    lines.push(`- Giai đoạn program: ${intensity.phase ?? "không rõ"}${intensity.targetRir != null ? `, RIR mục tiêu ${intensity.targetRir}` : ""}.`)
  }

  if (workout) {
    lines.push(`- Buổi tập hôm nay: ${workout.name}${workout.isCompleted ? " (đã hoàn thành)" : ""}.`)
    for (const exercise of workout.exercises) {
      const targets = exercise.sets
        .map((set) => (set.weight != null ? `${formatNumber(set.weight, 1)}kg×${set.reps}` : `${set.reps} rep`))
        .join(", ")
      lines.push(
        `  • ${exercise.name}: ${EXERCISE_ACTION_TEXT[exercise.action] ?? exercise.action}${targets ? ` → ${targets}` : ""}${exercise.heldByDay ? " (giữ lại vì readiness hôm nay)" : ""}.`,
      )
    }
  } else {
    lines.push("- Hôm nay không có buổi tập theo lịch.")
  }

  for (const muscle of muscles) {
    lines.push(`- Volume tuần ${muscle.muscleSlug}: ${MUSCLE_ACTION_TEXT[muscle.action]} ${formatNumber(muscle.currentSets, 1)} → ${formatNumber(muscle.recommendedSets, 1)} set hiệu quả.`)
  }

  return lines
}

async function buildRecommendationContext(profile: SerializedProfile): Promise<ContextSection | null> {
  if (profile.role !== "trainee") return null

  try {
    const recommendation = await getTrainingRecommendationForTrainee(profile)
    return createSection("recommendation", "ENGINE RECOMMENDATION (TODAY)", 95, formatRecommendationLines(recommendation))
  } catch (error) {
    // The chat still answers from the other sections if the engines cannot run.
    logger.warn("ai recommendation context failed", { error, userId: profile.id })
    return null
  }
}

export { buildRecommendationContext, formatRecommendationLines }
