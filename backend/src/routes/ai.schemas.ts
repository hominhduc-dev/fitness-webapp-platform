import { z } from "zod"
import { dateSchema } from "../lib/ai/output-schemas"

/**
 * Request schemas for `/api/ai/*`.
 *
 * These endpoints forward user text into a metered LLM, so the boundary is where
 * the sizes get capped: an unbounded `focusAreas` array or a 1 MB `injuries` string
 * is a cost and prompt-injection surface, not just a validation nicety.
 */

const isoDate = dateSchema
const equipment = z.enum(["full_gym", "home_dumbbells", "bodyweight"])
const experience = z.enum(["beginner", "intermediate", "advanced"])
const goal = z.enum(["build_muscle", "lose_weight", "strength", "endurance", "general_fitness"])
const inputInt = (min: number, max: number) => z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).pipe(z.number().int().min(min).max(max))
const freeText = z.string().trim().max(500)
const focusAreas = z.array(z.string().trim().min(1).max(60)).max(10).optional()

const generationIdSchema = z.object({
  generationId: z.uuid("generationId không hợp lệ."),
})

const generateProgramSchema = z.object({
  availableEquipment: equipment,
  daysPerWeek: inputInt(2, 7),
  durationWeeks: inputInt(1, 16),
  experienceLevel: experience,
  focusAreas,
  goal,
  injuries: freeText.optional(),
  sessionDuration: inputInt(20, 180),
})

const generateDailyWorkoutSchema = z.object({
  availableEquipment: equipment,
  date: isoDate,
  energyLevel: z.enum(["low", "normal", "high"]),
  experienceLevel: experience,
  focusAreas,
  goal,
  injuries: freeText.optional(),
  sessionDuration: inputInt(20, 120),
})

const generateMealPlanSchema = z.object({
  budget: z.enum(["low", "medium", "high"]).optional(),
  cookingTime: z.enum(["quick", "normal"]).optional(),
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
