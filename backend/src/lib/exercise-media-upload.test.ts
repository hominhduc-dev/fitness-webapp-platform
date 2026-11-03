import { describe, expect, it } from "vitest"

import {
  assertMediaUploadFlags,
  cloudinarySignature,
  createExerciseMediaObjectPath,
  isAdminExerciseMediaObjectPath,
} from "./exercise-media-upload"

describe("exercise media uploads", () => {
  it("requires explicit apply and media-rights confirmation", () => {
    expect(() => assertMediaUploadFlags({ apply: false, confirmMediaRights: true, uploadMedia: true })).toThrow("--apply")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: false, uploadMedia: true })).toThrow("--confirm-media-rights")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: true, uploadMedia: true })).not.toThrow()
  })

  it("names the object after the variation, the slot and the file type", () => {
    const variationId = "4c321b33-092a-4f49-9814-596676047ec4"
    const path = createExerciseMediaObjectPath(variationId, "animation", "video/mp4")

    expect(path).toMatch(new RegExp(`^admin/${variationId}/animation-[0-9a-f-]{36}\\.mp4$`))
    expect(isAdminExerciseMediaObjectPath(variationId, "animation", path)).toBe(true)
    expect(() => createExerciseMediaObjectPath(variationId, "thumbnail", "video/mp4")).toThrow()
  })

  it("rejects an uploaded path that belongs to another variation, slot or type", () => {
    const variationId = "4c321b33-092a-4f49-9814-596676047ec4"
    const other = "11111111-2222-3333-4444-555555555555"
    const path = createExerciseMediaObjectPath(variationId, "thumbnail", "image/png")

    expect(isAdminExerciseMediaObjectPath(other, "thumbnail", path)).toBe(false)
    expect(isAdminExerciseMediaObjectPath(variationId, "animation", path)).toBe(false)
    expect(isAdminExerciseMediaObjectPath(variationId, "thumbnail", path.replace(".png", ".mp4"))).toBe(false)
    expect(isAdminExerciseMediaObjectPath(variationId, "thumbnail", `../${path}`)).toBe(false)
  })

  it("signs Cloudinary upload params in sorted order", () => {
    expect(cloudinarySignature({ public_id: "exercise-media/admin/id", timestamp: 1700000000 }, "secret")).toBe(
      "dc3e093c5794c874d3f6036847f10970bc236c42",
    )
  })

})
