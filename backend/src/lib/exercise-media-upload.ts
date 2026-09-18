import { createHash, randomUUID } from "node:crypto"

import { env } from "../config/env"
import { ExternalServiceError, ValidationError } from "../services/errors"

const EXERCISE_MEDIA_MAX_FILE_SIZE = 1024 * 1024
const EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024
const CLOUDINARY_ADMIN_MEDIA_ROOT = "exercise-media/admin"

type CloudinaryUploadGrant = {
  apiKey: string
  cloudName: string
  contentType: string
  kind: "thumbnail" | "animation"
  publicId: string
  resourceType: "image" | "video"
  signature: string
  timestamp: number
  uploadUrl: string
}

function assertMediaUploadFlags(options: {
  apply: boolean
  confirmMediaRights: boolean
  uploadMedia: boolean
}) {
  if (options.uploadMedia && !options.apply) {
    throw new ValidationError("--upload-media requires --apply because uploads mutate media storage.")
  }
  if (options.uploadMedia && !options.confirmMediaRights) {
    throw new ValidationError("--upload-media requires --confirm-media-rights.")
  }
}

function cloudinarySignature(params: Record<string, string | number>, apiSecret = env.cloudinaryApiSecret) {
  if (!apiSecret) throw new ExternalServiceError("Cloudinary API secret is not configured.")
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex")
}

function createCloudinaryExerciseMediaPublicId(variationId: string, kind: "thumbnail" | "animation") {
  return `${CLOUDINARY_ADMIN_MEDIA_ROOT}/${variationId}/${kind}-${randomUUID()}`
}

function requireCloudinaryMediaConfig() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new ExternalServiceError("Cloudinary is not configured for exercise media uploads.")
  }
  return {
    apiKey: env.cloudinaryApiKey,
    cloudName: env.cloudinaryCloudName,
  }
}

/**
 * Cloudinary keeps images and videos in separate resource types, and an account can
 * refuse a GIF sent to the video endpoint ("Unsupported file type gif"). The animation
 * slot accepts GIF and WebP as well as MP4, so the resource type follows the file, not
 * the slot. A GIF stored as an image is still delivered as MP4 through `f_mp4`.
 */
function cloudinaryResourceTypeFor(contentType: string): "image" | "video" {
  return contentType === "video/mp4" ? "video" : "image"
}

function createCloudinaryUploadGrant(input: {
  contentType: string
  kind: "thumbnail" | "animation"
  publicId: string
  timestamp?: number
}): CloudinaryUploadGrant {
  const { apiKey, cloudName } = requireCloudinaryMediaConfig()
  const resourceType = cloudinaryResourceTypeFor(input.contentType)
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000)
  return {
    apiKey,
    cloudName,
    contentType: input.contentType,
    kind: input.kind,
    publicId: input.publicId,
    resourceType,
    signature: cloudinarySignature({ public_id: input.publicId, timestamp }),
    timestamp,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`,
  }
}

export {
  EXERCISE_MEDIA_MAX_FILE_SIZE,
  EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE,
  assertMediaUploadFlags,
  cloudinaryResourceTypeFor,
  cloudinarySignature,
  createCloudinaryExerciseMediaPublicId,
  createCloudinaryUploadGrant,
}
export type { CloudinaryUploadGrant }
