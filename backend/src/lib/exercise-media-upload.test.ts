import { describe, expect, it, vi } from "vitest"

import { exerciseDatasetRecordSchema } from "../domain/exercise-dataset"
import {
  assertMediaUploadFlags,
  buildMediaUploadEntries,
  uploadWithRetry,
} from "./exercise-media-upload"

const languageText = { en: "x", es: "x", it: "x", tr: "x", ru: "x", zh: "x", hi: "x", pl: "x", ko: "x", fr: "x" }
const languageSteps = { en: ["x"], es: ["x"], it: ["x"], tr: ["x"], ru: ["x"], zh: ["x"], hi: ["x"], pl: ["x"], ko: ["x"], fr: ["x"] }
const record = exerciseDatasetRecordSchema.parse({
  attribution: "© Gym visual", body_part: "back", category: "back", created_at: "2026-01-01T00:00:00Z",
  equipment: "barbell", gif_url: "videos/0001-media.gif", id: "0001", image: "images/0001-media.jpg",
  instruction_steps: languageSteps, instructions: languageText, media_id: "media", muscle_group: "back",
  name: "Row", secondary_muscles: [], target: "lats",
})

describe("exercise media uploads", () => {
  it("requires explicit apply and media-rights confirmation", () => {
    expect(() => assertMediaUploadFlags({ apply: false, confirmMediaRights: true, uploadMedia: true })).toThrow("--apply")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: false, uploadMedia: true })).toThrow("--confirm-media-rights")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: true, uploadMedia: true })).not.toThrow()
  })

  it("builds immutable versioned paths and correct MIME types", () => {
    expect(buildMediaUploadEntries([record], "dataset", "commit")).toEqual([
      { contentType: "image/jpeg", localPath: "dataset/images/0001-media.jpg", objectPath: "commit/images/0001-media.jpg" },
      { contentType: "image/gif", localPath: "dataset/videos/0001-media.gif", objectPath: "commit/videos/0001-media.gif" },
    ])
  })

  it("retries transient failures and skips existing objects", async () => {
    const wait = vi.fn(async () => undefined)
    const transient = vi.fn()
      .mockResolvedValueOnce({ error: { message: "timeout", statusCode: 503 } })
      .mockResolvedValueOnce({ error: null })
    await expect(uploadWithRetry(transient, wait)).resolves.toBe("uploaded")
    expect(transient).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledTimes(1)

    await expect(uploadWithRetry(async () => ({ error: { message: "The resource already exists" } }), wait)).resolves.toBe("skipped")
  })
})
