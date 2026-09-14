import { z } from "zod"

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, "Ngày không hợp lệ.")

const volumeRecoveryQuerySchema = z.object({
  weekStart: dateKey.optional(),
})

const muscleRecoveryRatingSchema = z.object({
  muscleSlug: z.string().trim().min(1).max(80),
  pain: z.number().int().min(0).max(5).optional(),
  soreness: z.number().int().min(0).max(5),
})

const recoveryCheckInSchema = z
  .object({
    checkInDate: dateKey,
    fatigue: z.number().int().min(1).max(5),
    muscles: z.array(muscleRecoveryRatingSchema).max(32).default([]),
    note: z.string().trim().max(1000).optional(),
    sleepMinutes: z.number().int().min(0).max(1440).optional(),
    sleepQuality: z.number().int().min(1).max(5).optional(),
    stress: z.number().int().min(1).max(5).optional(),
  })
  .refine(
    (value) => new Set(value.muscles.map((muscle) => muscle.muscleSlug)).size === value.muscles.length,
    { message: "Mỗi nhóm cơ chỉ được đánh giá một lần.", path: ["muscles"] },
  )

const muscleSlug = z.string().trim().min(1).max(80)

// A month of history is what the 7- and 30-day trends both read from; anything
// longer belongs to the year view rather than a recovery chart.
const recoveryHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
})

const volumeRecommendationStatusSchema = z.object({
  muscleSlug,
  status: z.enum(["accepted", "dismissed"]),
  weekStart: dateKey.optional(),
})

const volumeLandmarksSchema = z
  .object({
    mavMaxSets: z.number().min(0).max(60),
    mavMinSets: z.number().min(0).max(60),
    mevSets: z.number().min(0).max(60),
    mrvSets: z.number().min(0).max(60),
    muscleSlug,
  })
  .refine(
    (value) => value.mevSets <= value.mavMinSets && value.mavMinSets <= value.mavMaxSets && value.mavMaxSets <= value.mrvSets,
    { message: "Ngưỡng phải tăng dần: MEV ≤ MAV tối thiểu ≤ MAV tối đa ≤ MRV.", path: ["mevSets"] },
  )

const volumeLandmarksResetSchema = z.object({ muscleSlug })

export {
  recoveryCheckInSchema,
  recoveryHistoryQuerySchema,
  volumeLandmarksResetSchema,
  volumeLandmarksSchema,
  volumeRecommendationStatusSchema,
  volumeRecoveryQuerySchema,
}
