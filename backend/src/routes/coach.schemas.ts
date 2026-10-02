import { CoachRequestStatus } from "@prisma/client"
import { z } from "zod"

/** A coach request or invitation named in the URL. */
export const coachRequestParamsSchema = z.object({
  requestId: z.uuid("requestId không hợp lệ."),
})

/** Accepting or declining: a pending request cannot be answered with "pending". */
export const coachRequestAnswerSchema = z.object({
  status: z.enum([CoachRequestStatus.approved, CoachRequestStatus.rejected], "Trạng thái trả lời không hợp lệ."),
})

/** A trainee's notes, and one note among them, named in the URL. */
export const coachNoteTraineeParamsSchema = z.object({
  traineeId: z.uuid("traineeId không hợp lệ."),
})
export const coachNoteParamsSchema = coachNoteTraineeParamsSchema.extend({
  noteId: z.uuid("noteId không hợp lệ."),
})

export const coachNoteBodySchema = z.object({
  body: z.string().trim().min(1, "Ghi chú không được để trống.").max(2000, "Ghi chú tối đa 2000 ký tự."),
})

/** A coach's own exercise named in the URL. */
export const coachExerciseParamsSchema = z.object({
  exerciseId: z.uuid("exerciseId không hợp lệ."),
})

/** The AI trainee report covers the last 7, 14 or 28 days. */
const insightDays = z.coerce
  .number()
  .refine((value) => value === 7 || value === 14 || value === 28, "Khoảng phân tích chỉ có thể là 7, 14 hoặc 28 ngày.")
  .transform((value) => value as 7 | 14 | 28)

export const coachTraineeInsightQuerySchema = z.object({
  days: insightDays.default(14),
})

export const coachTraineeInsightBodySchema = z.object({
  days: insightDays.default(14),
  locale: z.enum(["vi", "en"]).optional(),
})
