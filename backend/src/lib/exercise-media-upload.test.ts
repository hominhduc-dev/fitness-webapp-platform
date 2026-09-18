import { describe, expect, it } from "vitest"

import {
  assertMediaUploadFlags,
  cloudinaryResourceTypeFor,
  cloudinarySignature,
} from "./exercise-media-upload"

describe("exercise media uploads", () => {
  it("requires explicit apply and media-rights confirmation", () => {
    expect(() => assertMediaUploadFlags({ apply: false, confirmMediaRights: true, uploadMedia: true })).toThrow("--apply")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: false, uploadMedia: true })).toThrow("--confirm-media-rights")
    expect(() => assertMediaUploadFlags({ apply: true, confirmMediaRights: true, uploadMedia: true })).not.toThrow()
  })

  it("picks the resource type from the file, not from the media slot", () => {
    // An account can refuse a GIF sent to the video endpoint, so animations that are
    // images (GIF, WebP) upload as images and are delivered as MP4 later.
    expect(cloudinaryResourceTypeFor("video/mp4")).toBe("video")
    expect(cloudinaryResourceTypeFor("image/gif")).toBe("image")
    expect(cloudinaryResourceTypeFor("image/webp")).toBe("image")
    expect(cloudinaryResourceTypeFor("image/png")).toBe("image")
  })

  it("signs Cloudinary upload params in sorted order", () => {
    expect(cloudinarySignature({ public_id: "exercise-media/admin/id", timestamp: 1700000000 }, "secret")).toBe(
      "dc3e093c5794c874d3f6036847f10970bc236c42",
    )
  })

})
