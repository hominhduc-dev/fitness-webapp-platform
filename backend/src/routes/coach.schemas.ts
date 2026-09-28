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

/** A coach's own exercise named in the URL. */
export const coachExerciseParamsSchema = z.object({
  exerciseId: z.uuid("exerciseId không hợp lệ."),
})
