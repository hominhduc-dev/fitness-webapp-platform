import { z } from "zod"

/**
 * Request schemas for `/api/workouts/*`.
 *
 * These replace ~60 lines of hand-written `typeof x === "string" ? x : undefined`
 * coercion. The important behavioural change: a malformed field is now a 422 with
 * the offending path, instead of being silently coerced to "" or 0 and written to
 * the database.
 */

const uuid = z.uuid("Định danh không hợp lệ.")

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày không hợp lệ")

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Thời điểm không hợp lệ")

const workoutIdParams = z.object({ workoutId: uuid })

const programIdParams = z.object({ programId: uuid })

const logParams = z.object({ logId: uuid, workoutId: uuid })

const swapParams = z.object({ workoutExerciseId: uuid, workoutId: uuid })

const personalWorkoutExercise = z.object({
  notes: z.string().max(500).optional(),
  reps: z.number().int().min(0).max(1000),
  repsMin: z.number().int().min(0).max(1000).optional(),
  restTime: z.number().int().min(0).max(3600).optional(),
  rir: z.number().min(0).max(10).optional(),
  sets: z.number().int().min(0).max(100),
  variationId: z.string().max(64),
  weight: z.number().min(0).max(2000).optional(),
})

const personalWorkoutSchema = z.object({
  duration: z.number().int().min(0).max(600).optional(),
  exercises: z.array(personalWorkoutExercise).max(100).default([]),
  kind: z.string().max(60).nullish(),
  name: z.string().trim().max(120).default(""),
  notes: z.string().max(2000).nullish(),
  scheduledDate: isoDate.optional(),
  scheduledDay: z.number().int().min(0).max(6).optional(),
})

const logRangeQuery = z.object({
  from: isoDate,
  programId: uuid.optional(),
  to: isoDate,
})

const exportLogsSchema = z.object({
  from: isoDate,
  label: z.string().max(120).optional(),
  to: isoDate,
})

const createWorkoutLogSchema = z.object({
  completedAt: isoDateTime.nullish(),
  /**
   * Mirrors `serializeWorkout()["exercises"]`, a large nested shape owned by the
   * fitness-data service and re-validated there against the stored workout. The
   * boundary check here is structural (array, bounded length) rather than a second
   * copy of that shape, which would drift from the service definition.
   */
  exercises: z.array(z.unknown()).max(100).default([]),
  notes: z.string().max(2000).nullish(),
  plannedDate: isoDate.nullish(),
  startedAt: isoDateTime.nullish(),
})

const swapExerciseSchema = z.object({
  variationId: z.string().min(1, "variationId là bắt buộc.").max(64),
})

export {
  createWorkoutLogSchema,
  exportLogsSchema,
  logParams,
  logRangeQuery,
  personalWorkoutSchema,
  programIdParams,
  swapExerciseSchema,
  swapParams,
  workoutIdParams,
}
