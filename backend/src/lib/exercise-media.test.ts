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

  it("builds upload URLs from the stored Cloudinary identity", () => {
    const resolved = resolveExerciseMedia({
      media: {
        animationCloudName: "demo",
        animationPublicId: "exercise-media/admin/variation/animation-id",
        animationResourceType: "image",
        animationType: "gif",
        animationUrl: "https://res.cloudinary.com/demo/image/upload/v123/exercise-media/admin/variation/animation-id.gif",
        animationVersion: "123",
        thumbnailCloudName: "demo",
        thumbnailPublicId: "exercise-media/admin/variation/thumbnail-id",
        thumbnailResourceType: "image",
        thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/v124/exercise-media/admin/variation/thumbnail-id.png",
        thumbnailVersion: "124",
      },
    })

    // An animated image is delivered as MP4, which is far smaller than the GIF it replaces.
    expect(resolved?.media.animationUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_mp4,q_auto/v123/exercise-media/admin/variation/animation-id.mp4",
    )
    expect(resolved?.media.thumbnailUrl).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v124/exercise-media/admin/variation/thumbnail-id.jpg",
    )
    expect(resolved?.media.type).toBe("video")
  })

  it("falls back to the stored URL when the upload has no Cloudinary identity", () => {
    const resolved = resolveExerciseMedia({
      media: {
        animationType: "video",
        animationUrl: "https://res.cloudinary.com/demo/video/upload/v1/legacy.mp4",
        thumbnailUrl: "https://res.cloudinary.com/demo/image/upload/v1/legacy.jpg",
      },
    })

    expect(resolved?.media.animationUrl).toBe("https://res.cloudinary.com/demo/video/upload/v1/legacy.mp4")
    expect(resolved?.media.thumbnailUrl).toBe("https://res.cloudinary.com/demo/image/upload/v1/legacy.jpg")
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

/**
 * Mirrors the generated `Variation.displayMetadata` column (migration
 * 20261001_variation_display_metadata): `media`, `cdn` and the external
 * display name, nulls stripped. Queries read that column instead of the raw
 * `metadata`, so the two must resolve to the same media.
 */
function toDisplayMetadata(metadata: Record<string, unknown>) {
  const externalSource = metadata.externalSource as { displayName?: unknown } | undefined
  const stripped = Object.fromEntries(
    Object.entries({
      cdn: metadata.cdn,
      externalSource: Object.fromEntries(
        Object.entries({ displayName: externalSource?.displayName }).filter(([, value]) => value != null),
      ),
      media: metadata.media,
    }).filter(([, value]) => value != null),
  )
  return JSON.parse(JSON.stringify(stripped)) as Record<string, unknown>
}

describe("displayMetadata", () => {
  const cdn = {
    animationPublicId: "exercise-media/dataset/0001",
    thumbnailPublicId: "exercise-media/dataset/0001-thumb",
    version: 1712345678,
  }
  const full = {
    cdn,
    exerciseDataset: { instructions: "x".repeat(6_000), media: { animationObjectPath: "abc/videos/0001.gif" } },
    externalSource: { displayName: "Barbell Bench Press", rawRow: { a: 1, b: 2 } },
    supabaseCustomMedia: { path: "old.mp4" },
  }

  it("resolves the same CDN media as the full metadata while dropping the import record", () => {
    const lean = toDisplayMetadata(full)
    expect(resolveExerciseMedia(lean, "demo-cloud")).toEqual(resolveExerciseMedia(full, "demo-cloud"))
    expect(resolveExerciseMedia(lean, "demo-cloud")?.source).toBe("cdn")
    expect(lean).not.toHaveProperty("exerciseDataset")
    expect(JSON.stringify(lean).length).toBeLessThan(JSON.stringify(full).length / 20)
  })

  it("keeps an admin's custom media ahead of the CDN media", () => {
    const upload = (kind: "video" | "image", id: string) => ({
      cloudName: "demo-cloud",
      contentType: kind === "video" ? "video/mp4" : "image/jpeg",
      publicId: `exercise-media/admin/variation/${id}`,
      resourceType: kind,
      secureUrl: `https://res.cloudinary.com/demo-cloud/${kind}/upload/v2/exercise-media/admin/variation/${id}.${kind === "video" ? "mp4" : "jpg"}`,
      version: 2,
    })
    const media = buildCustomExerciseMedia({
      animation: upload("video", "animation-id"),
      thumbnail: upload("image", "thumbnail-id"),
      updatedAt: new Date("2026-09-24T00:00:00Z"),
      updatedById: "admin",
    })
    const withCustom = { ...full, media }
    const lean = toDisplayMetadata(withCustom as Record<string, unknown>)
    expect(resolveExerciseMedia(lean, "demo-cloud")).toEqual(resolveExerciseMedia(withCustom, "demo-cloud"))
    expect(resolveExerciseMedia(lean, "demo-cloud")?.source).toBe("custom")
  })
})
