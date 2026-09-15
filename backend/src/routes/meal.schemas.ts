import { z } from "zod"

import { dateSchema } from "../lib/ai/output-schemas"

/** Request schemas for editing meal items and for coach review of planned meals. */

const mealItemParamsSchema = z.object({
  itemId: z.uuid("itemId không hợp lệ."),
})

const mealItemAmountSchema = z.object({
  amountValue: z.coerce.number().positive("Khẩu phần phải lớn hơn 0.").max(5000),
})

const traineeMealPlanParamsSchema = z.object({
  traineeId: z.uuid("traineeId không hợp lệ."),
})

const traineeMealItemParamsSchema = traineeMealPlanParamsSchema.extend({
  itemId: z.uuid("itemId không hợp lệ."),
})

const mealPlanDateQuerySchema = z.object({
  date: dateSchema,
})

const mealPlanReviewSchema = z.object({
  date: dateSchema,
  note: z.string().trim().max(500).optional(),
})

export {
  mealItemAmountSchema,
  mealItemParamsSchema,
  mealPlanDateQuerySchema,
  mealPlanReviewSchema,
  traineeMealItemParamsSchema,
  traineeMealPlanParamsSchema,
}
