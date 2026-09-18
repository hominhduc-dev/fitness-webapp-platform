import { env } from "../config/env"

const EXERCISE_MEDIA_DIMENSION = 180 as const

type JsonRecord = Record<string, unknown>
type ExerciseMediaType = "gif" | "video"
type ExerciseMediaKind = "thumbnail" | "animation"
type ExerciseMediaSource = "custom" | "cdn"

type SerializedExerciseMedia = {
  animationUrl: string
  height: typeof EXERCISE_MEDIA_DIMENSION
  thumbnailUrl: string
  type: ExerciseMediaType
  width: typeof EXERCISE_MEDIA_DIMENSION
}

type UploadedExerciseMediaFile = {
  cloudName?: string
  contentType: string
  publicId?: string
  resourceType?: string
  secureUrl?: string
  version?: number
}

/**
 * Files an admin may upload for a variation, by kind. The storage bucket is
 * configured with the union of these content types.
 */
const EXERCISE_MEDIA_FILE_RULES = {
  animation: {
    contentTypes: { "image/gif": ".gif", "image/webp": ".webp", "video/mp4": ".mp4" },
    directory: "videos",
    maxBytes: 10 * 1024 * 1024,
  },
  thumbnail: {
    contentTypes: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
    directory: "images",
    maxBytes: 2 * 1024 * 1024,
  },
} as const satisfies Record<ExerciseMediaKind, { contentTypes: Record<string, string>; directory: string; maxBytes: number }>

const EXERCISE_MEDIA_ALLOWED_MIME_TYPES = [
  ...new Set(Object.values(EXERCISE_MEDIA_FILE_RULES).flatMap((rule) => Object.keys(rule.contentTypes))),
]

/** Media an admin uploaded for a variation. It takes precedence over every synced source. */
const CUSTOM_EXERCISE_MEDIA_METADATA_KEY = "media"

/**
 * Variation metadata synced from an external exercise workbook: display name,
 * source exercise id and media.
 */
const EXTERNAL_SOURCE_METADATA_KEY = "externalSource"
const CDN_EXERCISE_MEDIA_METADATA_KEY = "cdn"

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined
}

function encodedPath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/%2C/gi, ","))
    .join("/")
}

function asUrl(value: unknown) {
  if (typeof value !== "string") return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function readExternalSourceMetadata(metadata: unknown) {
  return asRecord(asRecord(metadata)?.[EXTERNAL_SOURCE_METADATA_KEY])
}

function readCustomExerciseMedia(metadata: unknown) {
  return asRecord(asRecord(metadata)?.[CUSTOM_EXERCISE_MEDIA_METADATA_KEY])
}

function readCdnExerciseMedia(metadata: unknown) {
  return asRecord(asRecord(metadata)?.[CDN_EXERCISE_MEDIA_METADATA_KEY])
}

function animationTypeForContentType(contentType: string): ExerciseMediaType {
  return contentType === "video/mp4" ? "video" : "gif"
}

/** Media stored as absolute https URLs, as both custom and external media are. */
function serializeUrlMedia(media: JsonRecord | undefined): SerializedExerciseMedia | undefined {
  const thumbnailUrl = asUrl(media?.thumbnailUrl)
  const animationUrl = asUrl(media?.animationUrl)
  if (!thumbnailUrl || !animationUrl) return undefined

  const explicitType = media?.animationType === "video" || media?.animationType === "gif"
    ? media.animationType
    : undefined

  return {
    animationUrl,
    height: EXERCISE_MEDIA_DIMENSION,
    thumbnailUrl,
    type: explicitType ?? (animationUrl.toLowerCase().endsWith(".mp4") ? "video" : "gif"),
    width: EXERCISE_MEDIA_DIMENSION,
  }
}

function asCloudinaryToken(value: unknown) {
  return typeof value === "string" && /^[a-z0-9_-]+$/i.test(value) ? value : undefined
}

function asCloudinaryPath(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.includes("..")) {
    return undefined
  }
  return value
}

function asCloudinaryVersion(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value)
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value
  return undefined
}

function cloudinaryAssetUrl(input: {
  cloudName: string
  deliveryType: string
  extension: string
  publicId: string
  resourceType: string
  transform?: string
  version?: string
}) {
  const parts = [
    `https://res.cloudinary.com/${encodeURIComponent(input.cloudName)}`,
    input.resourceType,
    input.deliveryType,
  ]
  if (input.transform) parts.push(encodedPath(input.transform))
  if (input.version) parts.push(`v${input.version}`)
  parts.push(`${encodedPath(input.publicId)}.${input.extension}`)
  return parts.join("/")
}

function serializeCdnMedia(media: JsonRecord | undefined, cloudName = env.cloudinaryCloudName): SerializedExerciseMedia | undefined {
  if (!cloudName) return undefined

  const animationPublicId = asCloudinaryPath(media?.animationPublicId)
  const thumbnailPublicId = asCloudinaryPath(media?.thumbnailPublicId)
  if (!animationPublicId || !thumbnailPublicId) return undefined

  const deliveryType = asCloudinaryToken(media?.deliveryType) ?? "upload"
  const version = asCloudinaryVersion(media?.version)
  const animationTransform = asCloudinaryPath(media?.animationTransform)
  const thumbnailTransform = asCloudinaryPath(media?.thumbnailTransform)
  const animationResourceType = asCloudinaryToken(media?.animationResourceType) ?? "video"
  const thumbnailResourceType = asCloudinaryToken(media?.thumbnailResourceType) ?? "image"

  return {
    animationUrl: cloudinaryAssetUrl({
      cloudName,
      deliveryType,
      extension: "mp4",
      publicId: animationPublicId,
      resourceType: animationResourceType,
      transform: animationTransform,
      version,
    }),
    height: EXERCISE_MEDIA_DIMENSION,
    thumbnailUrl: cloudinaryAssetUrl({
      cloudName,
      deliveryType,
      extension: "jpg",
      publicId: thumbnailPublicId,
      resourceType: thumbnailResourceType,
      transform: thumbnailTransform,
      version,
    }),
    type: "video",
    width: EXERCISE_MEDIA_DIMENSION,
  }
}

function resolveExerciseMedia(
  metadata: unknown,
  cloudinaryCloudName = env.cloudinaryCloudName,
): { media: SerializedExerciseMedia; source: ExerciseMediaSource } | undefined {
  const customMedia = serializeUrlMedia(readCustomExerciseMedia(metadata))
  if (customMedia) return { media: customMedia, source: "custom" }

  const cdnMedia = serializeCdnMedia(readCdnExerciseMedia(metadata), cloudinaryCloudName)
  if (cdnMedia) return { media: cdnMedia, source: "cdn" }

  return undefined
}

function serializeExerciseMedia(metadata: unknown) {
  return resolveExerciseMedia(metadata)?.media
}

/** A localized reason the file cannot be used for this kind of media, if any. */
function exerciseMediaFileError(kind: ExerciseMediaKind, contentType: string, size: number) {
  const rule = EXERCISE_MEDIA_FILE_RULES[kind]
  const label = kind === "thumbnail" ? "Thumbnail" : "Animation"

  if (!Object.hasOwn(rule.contentTypes, contentType)) {
    const extensions = Object.values(rule.contentTypes).join(", ")
    return `${label} chỉ nhận file ${extensions}.`
  }
  if (!Number.isFinite(size) || size <= 0) {
    return `${label} là file rỗng.`
  }
  if (size > rule.maxBytes) {
    return `${label} tối đa ${rule.maxBytes / (1024 * 1024)}MB.`
  }
  return undefined
}

function customExerciseMediaCloudinaryPublicIds(customMedia: JsonRecord | undefined) {
  const ids: string[] = []
  if (typeof customMedia?.thumbnailPublicId === "string") ids.push(customMedia.thumbnailPublicId)
  if (typeof customMedia?.animationPublicId === "string") ids.push(customMedia.animationPublicId)
  return ids
}

/**
 * The custom media record after an upload. A side that was not uploaded keeps
 * what the variation shows today, whatever its source, so an admin can replace
 * only the thumbnail of a synced exercise. Returns undefined when the result
 * would still miss a thumbnail or an animation.
 */
function buildCustomExerciseMedia(input: {
  animation?: UploadedExerciseMediaFile
  current?: SerializedExerciseMedia
  previousCustom?: JsonRecord
  thumbnail?: UploadedExerciseMediaFile
  updatedAt: Date
  updatedById: string
}) {
  const thumbnailUrl = input.thumbnail?.secureUrl
    ? input.thumbnail.secureUrl
    : input.current?.thumbnailUrl
  const animationUrl = input.animation?.secureUrl
    ? input.animation.secureUrl
    : input.current?.animationUrl
  const animationType = input.animation
    ? animationTypeForContentType(input.animation.contentType)
    : input.current?.type

  if (!thumbnailUrl || !animationUrl || !animationType) return undefined

  const record: Record<string, string> = {
    animationType,
    animationUrl,
    thumbnailUrl,
    updatedAt: input.updatedAt.toISOString(),
    updatedById: input.updatedById,
  }

  const thumbnailPublicId = input.thumbnail?.publicId ?? input.previousCustom?.thumbnailPublicId
  const animationPublicId = input.animation?.publicId ?? input.previousCustom?.animationPublicId
  if (typeof thumbnailPublicId === "string") record.thumbnailPublicId = thumbnailPublicId
  if (typeof animationPublicId === "string") record.animationPublicId = animationPublicId

  const thumbnailVersion = input.thumbnail?.version ?? input.previousCustom?.thumbnailVersion
  const animationVersion = input.animation?.version ?? input.previousCustom?.animationVersion
  if (typeof thumbnailVersion === "number") record.thumbnailVersion = String(thumbnailVersion)
  else if (typeof thumbnailVersion === "string") record.thumbnailVersion = thumbnailVersion
  if (typeof animationVersion === "number") record.animationVersion = String(animationVersion)
  else if (typeof animationVersion === "string") record.animationVersion = animationVersion

  const thumbnailCloudName = input.thumbnail?.cloudName ?? input.previousCustom?.thumbnailCloudName
  const animationCloudName = input.animation?.cloudName ?? input.previousCustom?.animationCloudName
  if (typeof thumbnailCloudName === "string") record.thumbnailCloudName = thumbnailCloudName
  if (typeof animationCloudName === "string") record.animationCloudName = animationCloudName

  return record
}

export {
  CDN_EXERCISE_MEDIA_METADATA_KEY,
  CUSTOM_EXERCISE_MEDIA_METADATA_KEY,
  EXERCISE_MEDIA_ALLOWED_MIME_TYPES,
  EXERCISE_MEDIA_DIMENSION,
  EXERCISE_MEDIA_FILE_RULES,
  EXTERNAL_SOURCE_METADATA_KEY,
  buildCustomExerciseMedia,
  customExerciseMediaCloudinaryPublicIds,
  exerciseMediaFileError,
  readCustomExerciseMedia,
  readCdnExerciseMedia,
  readExternalSourceMetadata,
  resolveExerciseMedia,
  serializeExerciseMedia,
}
export type { ExerciseMediaKind, ExerciseMediaSource, SerializedExerciseMedia, UploadedExerciseMediaFile }
