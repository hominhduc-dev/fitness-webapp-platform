import { z } from "zod"

import { EXERCISE_MEDIA_FILE_RULES } from "../lib/exercise-media"

/**
 * Request schemas for the admin exercise media endpoints. Content type and size
 * are only shape-checked here; the per-kind rules live in the service, which
 * checks them again against the uploaded object itself.
 */

const largestMediaFileBytes = Math.max(...Object.values(EXERCISE_MEDIA_FILE_RULES).map((rule) => rule.maxBytes))
const objectPath = z.string().trim().min(1).max(300)

const exerciseIdParams = z.object({
  exerciseId: z.uuid("exerciseId không hợp lệ."),
})

const exerciseMediaUploadSchema = z.object({
  contentType: z.string().trim().min(1).max(100),
  kind: z.enum(["thumbnail", "animation"]),
  size: z.number().int().positive().max(largestMediaFileBytes),
})

const saveExerciseMediaSchema = z
  .object({
    animationObjectPath: objectPath.optional(),
    thumbnailObjectPath: objectPath.optional(),
  })
  .refine((value) => Boolean(value.animationObjectPath || value.thumbnailObjectPath), {
    message: "Chọn ít nhất một file media.",
  })

export { exerciseIdParams, exerciseMediaUploadSchema, saveExerciseMediaSchema }
