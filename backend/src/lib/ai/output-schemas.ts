import { z } from "zod"
import { AppError } from "../../services/errors"
import { validDateKey } from "./calendar"

const text = z.string().trim().min(1).max(200)
const description = z.string().trim().max(2000)
const integer = (min: number, max: number) => z.number().int().min(min).max(max)
export const dateSchema = z.string().refine(validDateKey, "Ngày không hợp lệ (YYYY-MM-DD)")
const kind = z.enum(["push", "pull", "legs", "full_body", "cardio", "other"])
const difficulty = z.enum(["beginner", "intermediate", "advanced"])
const prescription = z.object({
  sets: integer(1, 50), reps: integer(1, 1000), repsMin: integer(1, 1000).optional(),
  rir: integer(0, 4).optional(), restTime: integer(0, 900).optional(), weight: z.number().min(0).max(1000).optional(),
}).refine(v => v.repsMin == null || v.repsMin <= v.reps, "repsMin không được lớn hơn reps")
const exercise = prescription.safeExtend({ variationId: z.uuid(), exerciseName: text.optional(), variationName: text.optional() })
const mappedExercise = prescription.safeExtend({ variationId: z.uuid() })
const workout = z.object({ name: text, kind, weekIndex: z.literal(0), scheduledDay: integer(0, 6), duration: integer(10, 240), exercises: z.array(exercise).min(1).max(20) })
const uniqueDays = (v: { workouts: { scheduledDay: number }[] }) => new Set(v.workouts.map(w => w.scheduledDay)).size === v.workouts.length
export const programOutputSchema = z.object({ name: text, description, workouts: z.array(workout).min(1).max(7) }).refine(uniqueDays, "Các buổi tập không được trùng ngày")
export const mappedProgramSchema = z.object({
  name: text, description, difficulty, duration: integer(1, 16), workoutsPerWeek: integer(2, 7),
  workouts: z.array(workout.extend({ exercises: z.array(mappedExercise).min(1).max(20) })).min(2).max(7),
}).refine(uniqueDays, "Các buổi tập không được trùng ngày").refine(v => v.workoutsPerWeek === v.workouts.length, "Số buổi tập không khớp workoutsPerWeek")
export const dailyOutputSchema = z.object({ name: text, description, kind, duration: integer(20, 120), warmup: description, exercises: z.array(exercise).min(1).max(20) })
export const mappedDailySchema = dailyOutputSchema.extend({ date: dateSchema, difficulty, exercises: z.array(mappedExercise).min(1).max(20) })
export const mealItemSchema = z.object({ foodId: z.uuid(), foodName: text.optional(), amountValue: z.number().positive().max(5000), amountUnit: z.enum(["serving", "g", "ml"]) })
const meal = z.object({ type: z.enum(["breakfast", "lunch", "dinner", "snack"]), suggestion: description, items: z.array(mealItemSchema).min(1).max(3) })
  .refine(v => v.type === "snack" || v.items.length >= 2, "Bữa chính cần 2–3 món; bữa phụ cần 1–3 món")
export const mappedMealsSchema = z.array(meal).length(4).refine(v => new Set(v.map(m => m.type)).size === 4, "Thực đơn phải đủ 4 loại bữa khác nhau")
export const mealOutputSchema = z.object({ meals: mappedMealsSchema, notes: description })

export function parseAI<T>(schema: z.ZodType<T>, value: unknown, status = 422): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5).map(issue => `${issue.path.join(".")}: ${issue.message}`)
    throw new AppError(`Dữ liệu AI không hợp lệ. ${issues.join("; ")}`, { status, code: "AI_VALIDATION_ERROR", details: issues })
  }
  return result.data
}
