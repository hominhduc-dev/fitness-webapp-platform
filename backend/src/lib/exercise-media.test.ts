import { describe, expect, it } from "vitest"

import { serializeExerciseMedia } from "./exercise-media"

describe("serializeExerciseMedia", () => {
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
