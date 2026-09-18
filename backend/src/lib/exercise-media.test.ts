import { describe, expect, it } from "vitest"

import {
  buildCustomExerciseMedia,
  customExerciseMediaCloudinaryPublicIds,
  exerciseMediaFileError,
  resolveExerciseMedia,
  serializeExerciseMedia,
} from "./exercise-media"

describe("serializeExerciseMedia", () => {
  it("does not serialize external remote media URLs", () => {
    expect(serializeExerciseMedia({
      externalSource: {
        media: {
          animationType: "video",
          animationUrl: "https://cdn.example.com/exercise.mp4",
          thumbnailUrl: "https://cdn.example.com/exercise.jpg",
        },
      },
    })).toBeUndefined()
  })

  it("does not derive Supabase dataset media URLs", () => {
    expect(serializeExerciseMedia({
      exerciseDataset: {
        media: {
          animationObjectPath: "abc/videos/0001.gif",
          thumbnailObjectPath: "abc/images/0001.jpg",
        },
      },
    })).toBeUndefined()
  })

  it("serializes Cloudinary CDN media", () => {
    const resolved = resolveExerciseMedia({
      cdn: {
        animationPublicId: "exercise-media/yeahbuddy/hevy-123/animation",
        animationTransform: "q_auto/f_mp4",
        thumbnailPublicId: "exercise-media/yeahbuddy/hevy-123/thumbnail",
        thumbnailTransform: "c_fill,w_180,h_180/so_0",
        version: 1234567890,
      },
      externalSource: {
        media: {
          animationUrl: "https://cdn.example.com/exercise.gif",
          thumbnailUrl: "https://cdn.example.com/exercise.jpg",
        },
      },
    }, "demo")

    expect(resolved).toEqual({
      media: {
        animationUrl: "https://res.cloudinary.com/demo/video/upload/q_auto/f_mp4/v1234567890/exercise-media/yeahbuddy/hevy-123/animation.mp4",
        height: 180,
        thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/c_fill,w_180,h_180/so_0/v1234567890/exercise-media/yeahbuddy/hevy-123/thumbnail.jpg",
        type: "video",
        width: 180,
      },
      source: "cdn",
    })
  })

  it("rejects incomplete or unsafe metadata paths", () => {
    expect(serializeExerciseMedia({})).toBeUndefined()
    expect(serializeExerciseMedia({
      exerciseDataset: {
        media: {
          animationObjectPath: "../secret.gif",
          thumbnailObjectPath: "abc/images/0001.jpg",
        },
      },
    })).toBeUndefined()
  })
})

describe("custom exercise media", () => {
  const updatedAt = new Date("2026-09-13T00:00:00Z")

  it("prefers uploaded media over synced and dataset media", () => {
    const resolved = resolveExerciseMedia({
      exerciseDataset: { media: { animationObjectPath: "abc/videos/1.gif", thumbnailObjectPath: "abc/images/1.jpg" } },
      externalSource: { media: { animationUrl: "https://cdn.example.com/x.gif", thumbnailUrl: "https://cdn.example.com/x.jpg" } },
      media: {
        animationType: "video",
        animationUrl: "https://res.cloudinary.com/demo/video/upload/v123/exercise-media/admin/variation/animation-id.mp4",
        thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
      },
    })

    expect(resolved?.source).toBe("custom")
    expect(resolved?.media.type).toBe("video")
  })

  it("ignores synced external media", () => {
    expect(resolveExerciseMedia({
      externalSource: { media: { animationUrl: "https://cdn.example.com/x.gif", thumbnailUrl: "https://cdn.example.com/x.jpg" } },
    })).toBeUndefined()
  })

  it("does not fall back to synced media when CDN metadata is incomplete", () => {
    expect(resolveExerciseMedia({
      cdn: { animationPublicId: "exercise-media/missing-thumbnail" },
      externalSource: { media: { animationUrl: "https://cdn.example.com/x.gif", thumbnailUrl: "https://cdn.example.com/x.jpg" } },
    })).toBeUndefined()
  })

  it("validates file type and size per kind", () => {
    expect(exerciseMediaFileError("thumbnail", "image/png", 1024)).toBeUndefined()
    expect(exerciseMediaFileError("thumbnail", "video/mp4", 1024)).toMatch(/Thumbnail/)
    expect(exerciseMediaFileError("thumbnail", "image/png", 3 * 1024 * 1024)).toMatch(/2MB/)
    expect(exerciseMediaFileError("animation", "video/mp4", 10 * 1024 * 1024)).toBeUndefined()
    expect(exerciseMediaFileError("animation", "image/gif", 0)).toMatch(/rỗng/)
  })

  it("keeps the current media for the side that was not uploaded", () => {
    const record = buildCustomExerciseMedia({
      current: { animationUrl: "https://cdn.example.com/x.gif", height: 180, thumbnailUrl: "https://cdn.example.com/x.jpg", type: "gif", width: 180 },
      thumbnail: {
        cloudName: "demo",
        contentType: "image/png",
        publicId: "exercise-media/admin/variation/thumbnail-id",
        resourceType: "image",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
        version: 124,
      },
      updatedAt,
      updatedById: "admin",
    })

    expect(record).toMatchObject({
      animationType: "gif",
      animationUrl: "https://cdn.example.com/x.gif",
      thumbnailPublicId: "exercise-media/admin/variation/thumbnail-id",
      thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
      updatedById: "admin",
    })
    expect(record).not.toHaveProperty("animationPublicId")
  })

  it("stores Cloudinary uploaded media as custom media", () => {
    const record = buildCustomExerciseMedia({
      animation: {
        cloudName: "demo",
        contentType: "video/mp4",
        publicId: "exercise-media/admin/variation/animation-id",
        resourceType: "video",
        secureUrl: "https://res.cloudinary.com/demo/video/upload/v123/exercise-media/admin/variation/animation-id.mp4",
        version: 123,
      },
      thumbnail: {
        cloudName: "demo",
        contentType: "image/png",
        publicId: "exercise-media/admin/variation/thumbnail-id",
        resourceType: "image",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
        version: 124,
      },
      updatedAt,
      updatedById: "admin",
    })

    expect(record).toMatchObject({
      animationPublicId: "exercise-media/admin/variation/animation-id",
      animationType: "video",
      animationUrl: "https://res.cloudinary.com/demo/video/upload/v123/exercise-media/admin/variation/animation-id.mp4",
      animationVersion: "123",
      thumbnailPublicId: "exercise-media/admin/variation/thumbnail-id",
      thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
      thumbnailVersion: "124",
    })
    expect(customExerciseMediaCloudinaryPublicIds(record)).toEqual([
      "exercise-media/admin/variation/thumbnail-id",
      "exercise-media/admin/variation/animation-id",
    ])
  })

  it("needs both files when the variation has no media yet", () => {
    expect(buildCustomExerciseMedia({
      thumbnail: {
        cloudName: "demo",
        contentType: "image/png",
        publicId: "exercise-media/admin/variation/thumbnail-id",
        resourceType: "image",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.jpg",
        version: 124,
      },
      updatedAt,
      updatedById: "admin",
    })).toBeUndefined()
  })
})
