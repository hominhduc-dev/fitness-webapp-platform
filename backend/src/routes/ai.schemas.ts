import { z } from "zod"

/**
 * Request schemas for `/api/ai/*`.
 *
 * These endpoints forward user text into a metered LLM, so the boundary is where
 * the sizes get capped: an unbounded `focusAreas` array or a 1 MB `injuries` string
 * is a cost and prompt-injection surface, not just a validation nicety.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày không hợp lệ")

const shortText = z.string().trim().min(1).max(200)
const freeText = z.string().trim().max(500)
const focusAreas = z.array(z.string().trim().min(1).max(60)).max(10).optional()

const generationIdSchema = z.object({
  generationId: z.uuid("generationId không hợp lệ."),
})

const generateProgramSchema = z.object({
  availableEquipment: shortText,
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  durationWeeks: z.coerce.number().int().min(1).max(52),
  experienceLevel: shortText,
  focusAreas,
  goal: shortText,
  injuries: freeText.optional(),
  sessionDuration: z.coerce.number().int().min(10).max(240),
})

const generateDailyWorkoutSchema = z.object({
  availableEquipment: shortText,
  date: isoDate,
  energyLevel: z.enum(["low", "normal", "high"]),
  experienceLevel: shortText,
  focusAreas,
  goal: shortText,
  injuries: freeText.optional(),
  sessionDuration: z.coerce.number().int().min(10).max(240),
})

const generateMealPlanSchema = z.object({
  budget: freeText.optional(),
  cookingTime: freeText.optional(),
  date: isoDate,
  preferences: freeText.optional(),
})

const acceptMealPlanSchema = generationIdSchema.extend({
  date: isoDate,
})

const chatSchema = z.object({
  // Mirrors the service-side guard so oversized input is rejected before any
  // context building or token spend happens.
  history: z
    .array(
      z.object({
        content: z.string().max(4000),
        role: z.enum(["user", "assistant"]),
      }),
    )
    .max(40)
    .default([]),
  message: z.string().trim().min(1, "Tin nhắn không được để trống.").max(2000, "Tin nhắn quá dài (tối đa 2000 ký tự)."),
})

export {
  acceptMealPlanSchema,
  chatSchema,
  generateDailyWorkoutSchema,
  generateMealPlanSchema,
  generateProgramSchema,
  generationIdSchema,
}
