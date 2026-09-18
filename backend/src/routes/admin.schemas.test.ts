import { describe, expect, it } from "vitest"

import { exerciseIdParams, exerciseMediaUploadSchema, saveExerciseMediaSchema } from "./admin.schemas"

describe("exerciseMediaUploadSchema", () => {
  it("accepts a thumbnail or animation upload request", () => {
    expect(exerciseMediaUploadSchema.safeParse({ contentType: "image/png", kind: "thumbnail", size: 1024 }).success).toBe(true)
    expect(exerciseMediaUploadSchema.safeParse({ contentType: "video/mp4", kind: "animation", size: 5_000_000 }).success).toBe(true)
  })

  it("rejects unknown kinds, empty files and files over the largest limit", () => {
    expect(exerciseMediaUploadSchema.safeParse({ contentType: "image/png", kind: "poster", size: 1024 }).success).toBe(false)
    expect(exerciseMediaUploadSchema.safeParse({ contentType: "image/png", kind: "thumbnail", size: 0 }).success).toBe(false)
    expect(exerciseMediaUploadSchema.safeParse({ contentType: "video/mp4", kind: "animation", size: 11 * 1024 * 1024 }).success).toBe(false)
  })
})

describe("saveExerciseMediaSchema", () => {
  it("requires at least one uploaded object", () => {
    expect(saveExerciseMediaSchema.safeParse({}).success).toBe(false)
    expect(saveExerciseMediaSchema.safeParse({ thumbnailObjectPath: "library/images/a.png" }).success).toBe(false)
    expect(saveExerciseMediaSchema.safeParse({
      thumbnailUpload: {
        cloudName: "demo",
        contentType: "image/png",
        publicId: "exercise-media/admin/variation/thumbnail-id",
        resourceType: "image",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v123/exercise-media/admin/variation/thumbnail-id.jpg",
        version: 123,
      },
    }).success).toBe(true)
  })
})

describe("exerciseIdParams", () => {
  it("only accepts variation uuids", () => {
    expect(exerciseIdParams.safeParse({ exerciseId: "not-a-uuid" }).success).toBe(false)
    expect(exerciseIdParams.safeParse({ exerciseId: "3f1c9a4e-2b7d-4c8e-9f10-1a2b3c4d5e6f" }).success).toBe(true)
  })
})
