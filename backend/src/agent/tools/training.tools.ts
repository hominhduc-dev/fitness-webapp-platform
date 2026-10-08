import { calculateE1RM } from "../../services/fitness-data/shared/e1rm"
import { z } from "zod"
import type { AIToolCall, AIToolDefinition } from "../../lib/ai/types"
import type { SerializedProfile } from "../../services/auth.service"
import { getTrainingRecommendationForTrainee } from "../../services/training-recommendation.service"
import { getVolumeRecoveryForTrainee } from "../../services/volume-recovery/volume-recovery.service"
import { ensureContextPrisma, parseExerciseSnapshot } from "../../services/ai/context/helpers"
import { buildProgressionContext } from "../../services/ai/context/progression-context"
import { buildNutritionContext } from "../../services/ai/context/nutrition-context"

const empty = z.object({}).strict()
const historySchema = z.object({ days: z.number().int().min(1).max(60).default(28) }).strict()
const descriptions: Record<string, string> = {
  get_training_recommendation: "Đọc recommendation hôm nay từ training engine: tạ/rep/set và hướng dẫn. Không tự tính lại hay sửa program.",
  get_readiness: "Đọc readiness và độ tin cậy tuần hiện tại từ recovery engine. Không suy đoán khi thiếu check-in.",
  get_muscle_volume: "Đọc weekly muscle volume, MEV/MAV/MRV và recommendation từ volume engine (tất cả program).",
  get_workout_history: "Đọc tối đa 30 buổi hoàn thành trong 1–60 ngày (mặc định 28). Có actual reps/weight/RIR theo variation; báo rõ giới hạn mẫu.",
  get_progression_summary: "Đọc tóm tắt progression 60 ngày, tối đa 80 logs và 6 bài. Đây KHÔNG phải kết luận plateau hoặc e1RM; không so sánh các variation khác nhau.",
  get_nutrition_summary: "Đọc tổng hợp dinh dưỡng hôm nay và 14 ngày gần nhất. Không ghi meal logs.",
}
export const trainingReadTools: AIToolDefinition[] = Object.entries(descriptions).map(([name, description]) => ({
  name, description,
  parameters: name === "get_workout_history"
    ? { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 60 } }, required: [], additionalProperties: false }
    : { type: "object", properties: {}, required: [], additionalProperties: false },
}))

/** Identity is captured from the authenticated server profile, never from model arguments. */
export async function executeTrainingReadTool(profile: SerializedProfile, call: AIToolCall): Promise<unknown> {
  if (profile.role !== "trainee") return { ok: false, code: "FORBIDDEN" }
  if (!trainingReadTools.some(tool => tool.name === call.name)) return { ok: false, code: "UNKNOWN_TOOL" }
  const schema = call.name === "get_workout_history" ? historySchema : empty
  const parsed = schema.safeParse(call.arguments)
  if (!parsed.success) return { ok: false, code: "INVALID_ARGUMENTS" }
  const now = new Date()
  let data: unknown
  switch (call.name) {
    case "get_training_recommendation":
      data = await getTrainingRecommendationForTrainee(profile)
      break
    case "get_readiness": {
      const recovery = await getVolumeRecoveryForTrainee(profile)
      data = { readiness: recovery.readiness, confidence: recovery.confidence, guidance: recovery.guidance }
      break
    }
    case "get_muscle_volume": {
      const recovery = await getVolumeRecoveryForTrainee(profile)
      data = { muscles: recovery.muscles, confidence: recovery.confidence, algorithmVersion: recovery.algorithmVersion }
      break
    }
    case "get_workout_history": {
      const { days } = historySchema.parse(call.arguments)
      const since = new Date(now.getTime() - days * 86_400_000)
      const db = ensureContextPrisma()
      const where = { userId: profile.id, completedAt: { not: null, lte: now }, startedAt: { gte: since, lte: now } }
      const [logs, total] = await Promise.all([
        db.workoutLog.findMany({ where, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 30,
          select: { id: true, programId: true, startedAt: true, totalVolume: true, exerciseSnapshot: true } }),
        db.workoutLog.count({ where }),
      ])
      data = { since: since.toISOString(), total, limited: total > logs.length,
        logs: logs.map(log => ({ id: log.id, programId: log.programId, startedAt: log.startedAt, totalVolume: log.totalVolume,
          exercises: parseExerciseSnapshot(log.exerciseSnapshot).map(exercise => ({
            exercise: exercise.exercise, variation: exercise.variation,
            sets: exercise.sets?.map(set => ({ completed: set.completed, reps: set.actualReps, weight: set.weight, rir: set.rir,
              e1rm: set.completed && set.weight != null && set.actualReps != null ? calculateE1RM(set.weight, set.actualReps, set.rir) : null })),
          })),
        })),
      }
      break
    }
    case "get_progression_summary":
      data = { scope: "60 days; up to 80 logs, 6 exercise labels; not plateau diagnosis", summary: (await buildProgressionContext(ensureContextPrisma(), profile, now))?.content ?? null }
      break
    case "get_nutrition_summary":
      data = { summary: (await buildNutritionContext(ensureContextPrisma(), profile, now))?.content ?? null }
      break
  }
  return { ok: true, source: call.name, asOf: now.toISOString(), data }
}
