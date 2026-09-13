import { describe, expect, it } from "vitest"

import {
  buildCustomExerciseMedia,
  createCustomExerciseMediaObjectPath,
  customExerciseMediaObjectPaths,
  exerciseMediaFileError,
  isCustomExerciseMediaObjectPathFor,
  resolveExerciseMedia,
  serializeExerciseMedia,
} from "./exercise-media"

describe("serializeExerciseMedia", () => {
  it("serializes external remote media URLs", () => {
    expect(serializeExerciseMedia({
      externalSource: {
        media: {
          animationType: "video",
          animationUrl: "https://cdn.example.com/exercise.mp4",
          thumbnailUrl: "https://cdn.example.com/exercise.jpg",
        },
      },
    }, "https://project.supabase.co")).toEqual({
      animationUrl: "https://cdn.example.com/exercise.mp4",
      height: 180,
      thumbnailUrl: "https://cdn.example.com/exercise.jpg",
      type: "video",
      width: 180,
    })
  })

  it("derives public immutable media URLs", () => {
    expect(serializeExerciseMedia({
      exerciseDataset: {
        media: {
          animationObjectPath: "abc/videos/0001.gif",
          thumbnailObjectPath: "abc/images/0001.jpg",
        },
      },
    }, "https://project.supabase.co")).toEqual({
      animationUrl: "https://project.supabase.co/storage/v1/object/public/exercise-media/abc/videos/0001.gif",
      height: 180,
      thumbnailUrl: "https://project.supabase.co/storage/v1/object/public/exercise-media/abc/images/0001.jpg",
      type: "gif",
      width: 180,
    })
  })

  it("rejects incomplete or unsafe metadata paths", () => {
    expect(serializeExerciseMedia({}, "https://project.supabase.co")).toBeUndefined()
    expect(serializeExerciseMedia({
      exerciseDataset: {
        media: {
          animationObjectPath: "../secret.gif",
          thumbnailObjectPath: "abc/images/0001.jpg",
        },
      },
    }, "https://project.supabase.co")).toBeUndefined()
  })
})

describe("custom exercise media", () => {
  const supabaseUrl = "https://project.supabase.co"
  const variationId = "3f1c9a4e-2b7d-4c8e-9f10-1a2b3c4d5e6f"
  const updatedAt = new Date("2026-09-13T00:00:00Z")

  it("prefers uploaded media over synced and dataset media", () => {
    const resolved = resolveExerciseMedia({
      exerciseDataset: { media: { animationObjectPath: "abc/videos/1.gif", thumbnailObjectPath: "abc/images/1.jpg" } },
      externalSource: { media: { animationUrl: "https://cdn.example.com/x.gif", thumbnailUrl: "https://cdn.example.com/x.jpg" } },
      media: {
        animationType: "video",
        animationUrl: `${supabaseUrl}/storage/v1/object/public/exercise-media/library/videos/a.mp4`,
        thumbnailUrl: `${supabaseUrl}/storage/v1/object/public/exercise-media/library/images/t.png`,
      },
    }, supabaseUrl)

    expect(resolved?.source).toBe("custom")
    expect(resolved?.media.type).toBe("video")
  })

  it("reports the source of synced media", () => {
    expect(resolveExerciseMedia({
      externalSource: { media: { animationUrl: "https://cdn.example.com/x.gif", thumbnailUrl: "https://cdn.example.com/x.jpg" } },
    }, supabaseUrl)?.source).toBe("external")
  })

  it("validates file type and size per kind", () => {
    expect(exerciseMediaFileError("thumbnail", "image/png", 1024)).toBeUndefined()
    expect(exerciseMediaFileError("thumbnail", "video/mp4", 1024)).toMatch(/Thumbnail/)
    expect(exerciseMediaFileError("thumbnail", "image/png", 3 * 1024 * 1024)).toMatch(/2MB/)
    expect(exerciseMediaFileError("animation", "video/mp4", 10 * 1024 * 1024)).toBeUndefined()
    expect(exerciseMediaFileError("animation", "image/gif", 0)).toMatch(/rỗng/)
  })

  it("creates unique object paths that only match their own variation and kind", () => {
    const path = createCustomExerciseMediaObjectPath(variationId, "animation", "video/mp4")

    expect(path).toMatch(new RegExp(`^library/videos/${variationId}-[0-9a-f-]{36}\\.mp4$`))
    expect(createCustomExerciseMediaObjectPath(variationId, "animation", "video/mp4")).not.toBe(path)
    expect(isCustomExerciseMediaObjectPathFor(variationId, "animation", path)).toBe(true)
    expect(isCustomExerciseMediaObjectPathFor(variationId, "thumbnail", path)).toBe(false)
    expect(isCustomExerciseMediaObjectPathFor("another-variation", "animation", path)).toBe(false)
    expect(isCustomExerciseMediaObjectPathFor(variationId, "animation", `library/videos/${variationId}-../secret.mp4`)).toBe(false)
  })

  it("keeps the current media for the side that was not uploaded", () => {
    const thumbnailObjectPath = createCustomExerciseMediaObjectPath(variationId, "thumbnail", "image/png")
    const record = buildCustomExerciseMedia({
      current: { animationUrl: "https://cdn.example.com/x.gif", height: 180, thumbnailUrl: "https://cdn.example.com/x.jpg", type: "gif", width: 180 },
      supabaseUrl,
      thumbnail: { contentType: "image/png", objectPath: thumbnailObjectPath },
      updatedAt,
      updatedById: "admin",
    })

    expect(record).toMatchObject({
      animationType: "gif",
      animationUrl: "https://cdn.example.com/x.gif",
      thumbnailObjectPath,
      thumbnailUrl: `${supabaseUrl}/storage/v1/object/public/exercise-media/${thumbnailObjectPath}`,
      updatedById: "admin",
    })
    expect(record).not.toHaveProperty("animationObjectPath")
  })

  it("needs both files when the variation has no media yet", () => {
    expect(buildCustomExerciseMedia({
      supabaseUrl,
      thumbnail: { contentType: "image/png", objectPath: createCustomExerciseMediaObjectPath(variationId, "thumbnail", "image/png") },
      updatedAt,
      updatedById: "admin",
    })).toBeUndefined()
  })

  it("lists only this variation's uploaded objects for cleanup", () => {
    const animationObjectPath = createCustomExerciseMediaObjectPath(variationId, "animation", "image/gif")

    expect(customExerciseMediaObjectPaths({
      animationObjectPath,
      thumbnailObjectPath: "library/images/someone-else.jpg",
    }, variationId)).toEqual([animationObjectPath])
  })
})
