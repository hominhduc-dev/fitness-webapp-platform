import { z } from "zod"

import { EXERCISE_MEDIA_FILE_RULES } from "../lib/exercise-media"

/**
 * Request schemas for the admin exercise media endpoints. Content type and size
 * are only shape-checked here; the per-kind rules live in the service, which
 * checks them again against the uploaded object itself.
 */

const largestMediaFileBytes = Math.max(...Object.values(EXERCISE_MEDIA_FILE_RULES).map((rule) => rule.maxBytes))
const uploadedCloudinaryMedia = z.object({
  cloudName: z.string().trim().min(1).max(120),
  contentType: z.string().trim().min(1).max(100),
  publicId: z.string().trim().min(1).max(300),
  resourceType: z.enum(["image", "video"]),
  secureUrl: z.url(),
  version: z.number().int().positive(),
})

const exerciseIdParams = z.object({
  exerciseId: z.uuid("exerciseId không hợp lệ."),
})

const metadataTransferParams = z.object({
  transferId: z.uuid("transferId không hợp lệ."),
})

const exerciseMediaUploadSchema = z.object({
  contentType: z.string().trim().min(1).max(100),
  kind: z.enum(["thumbnail", "animation"]),
  size: z.number().int().positive().max(largestMediaFileBytes),
})

const saveExerciseMediaSchema = z
  .object({
    animationUpload: uploadedCloudinaryMedia.optional(),
    thumbnailUpload: uploadedCloudinaryMedia.optional(),
  })
  .refine((value) => Boolean(value.animationUpload || value.thumbnailUpload), {
    message: "Chọn ít nhất một file media.",
  })

const transferExerciseMetadataSchema = z
  .object({
    sourceVariationId: z.uuid("sourceVariationId không hợp lệ."),
    targetVariationId: z.uuid("targetVariationId không hợp lệ."),
  })
  .refine((value) => value.sourceVariationId !== value.targetVariationId, {
    message: "Bài nguồn và bài đích phải khác nhau.",
  })

/** The admin queue behind /coach-signup: listing it, and deciding one signup. */
const coachSignupQuery = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
})

const coachSignupParams = z.object({
  userId: z.uuid("userId không hợp lệ."),
})

const reviewCoachSignupSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
})

const customFoodQuery = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["pending", "approved", "rejected", "all"]).optional(),
})

const customFoodParams = z.object({
  foodId: z.uuid("foodId không hợp lệ."),
})

const reviewCustomFoodSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(500).optional(),
})

export {
  coachSignupParams,
  coachSignupQuery,
  customFoodParams,
  customFoodQuery,
  exerciseIdParams,
  exerciseMediaUploadSchema,
  metadataTransferParams,
  reviewCoachSignupSchema,
  reviewCustomFoodSchema,
  saveExerciseMediaSchema,
  transferExerciseMetadataSchema,
}
