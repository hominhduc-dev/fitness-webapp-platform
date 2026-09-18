import { describe, expect, it } from "vitest"

import {
  assertMediaUploadFlags,
  cloudinarySignature,
} from "./exercise-media-upload"

describe("exercise media uploads", () => {
  it("requires explicit apply and media-rights confirmation", () => {
    expect(() => assertMediaUploadFlags({ apply: false, confirmMediaRights: true, uploadMedia: true })).toThrow("--apply")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: false, uploadMedia: true })).toThrow("--confirm-media-rights")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: true, uploadMedia: true })).not.toThrow()
  })

  it("signs Cloudinary upload params in sorted order", () => {
    expect(cloudinarySignature({ public_id: "exercise-media/admin/id", timestamp: 1700000000 }, "secret")).toBe(
      "dc3e093c5794c874d3f6036847f10970bc236c42",
    )
  })

})
