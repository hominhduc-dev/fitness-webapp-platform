import { randomUUID } from "node:crypto"

import { env } from "../config/env"

const EXERCISE_MEDIA_BUCKET = "exercise-media"
const EXERCISE_MEDIA_DIMENSION = 180 as const
const EXERCISE_MEDIA_LIBRARY_ROOT = "library"

type JsonRecord = Record<string, unknown>
type ExerciseMediaType = "gif" | "video"
type ExerciseMediaKind = "thumbnail" | "animation"
type ExerciseMediaSource = "custom" | "external" | "dataset"

type SerializedExerciseMedia = {
  animationUrl: string
  height: typeof EXERCISE_MEDIA_DIMENSION
  thumbnailUrl: string
  type: ExerciseMediaType
  width: typeof EXERCISE_MEDIA_DIMENSION
}

type UploadedExerciseMediaFile = {
  contentType: string
  objectPath: string
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

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined
}

function isSafeObjectPath(value: unknown, directory: "images" | "videos"):
  value is string {
  if (typeof value !== "string" || value.includes("..") || value.startsWith("/")) {
    return false
  }

  const segments = value.split("/")
  return segments.length === 3 && segments[0].length > 0 && segments[1] === directory && segments[2].length > 0
}

function publicObjectUrl(baseUrl: string, objectPath: string) {
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${encodedPath}`
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

function resolveExerciseMedia(
  metadata: unknown,
  supabaseUrl = env.supabaseUrl,
): { media: SerializedExerciseMedia; source: ExerciseMediaSource } | undefined {
  const customMedia = serializeUrlMedia(readCustomExerciseMedia(metadata))
  if (customMedia) return { media: customMedia, source: "custom" }

  const externalMedia = serializeUrlMedia(asRecord(readExternalSourceMetadata(metadata)?.media))
  if (externalMedia) return { media: externalMedia, source: "external" }

  if (!supabaseUrl) return undefined

  const datasetMedia = asRecord(asRecord(asRecord(metadata)?.exerciseDataset)?.media)
  const thumbnailObjectPath = datasetMedia?.thumbnailObjectPath
  const animationObjectPath = datasetMedia?.animationObjectPath

  if (
    !isSafeObjectPath(thumbnailObjectPath, "images") ||
    !isSafeObjectPath(animationObjectPath, "videos")
  ) {
    return undefined
  }

  return {
    media: {
      animationUrl: publicObjectUrl(supabaseUrl, animationObjectPath),
      height: EXERCISE_MEDIA_DIMENSION,
      thumbnailUrl: publicObjectUrl(supabaseUrl, thumbnailObjectPath),
      type: "gif",
      width: EXERCISE_MEDIA_DIMENSION,
    },
    source: "dataset",
  }
}

function serializeExerciseMedia(metadata: unknown, supabaseUrl = env.supabaseUrl) {
  return resolveExerciseMedia(metadata, supabaseUrl)?.media
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

/**
 * A fresh object path per upload: public media is cached for a year, so a
 * replaced file must never reuse the URL of the one it replaces.
 */
function createCustomExerciseMediaObjectPath(variationId: string, kind: ExerciseMediaKind, contentType: string) {
  const rule = EXERCISE_MEDIA_FILE_RULES[kind]
  const extension = (rule.contentTypes as Record<string, string>)[contentType]
  if (!extension) throw new TypeError(`Unsupported ${kind} content type: ${contentType}`)
  return `${EXERCISE_MEDIA_LIBRARY_ROOT}/${rule.directory}/${variationId}-${randomUUID()}${extension}`
}

/** Whether the path is one this variation's upload flow could have produced for this kind. */
function isCustomExerciseMediaObjectPathFor(variationId: string, kind: ExerciseMediaKind, objectPath: unknown): objectPath is string {
  if (typeof objectPath !== "string") return false
  const rule = EXERCISE_MEDIA_FILE_RULES[kind]
  const prefix = `${EXERCISE_MEDIA_LIBRARY_ROOT}/${rule.directory}/${variationId}-`
  if (!objectPath.startsWith(prefix)) return false

  const rest = objectPath.slice(prefix.length)
  const match = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)$/.exec(rest)
  return Boolean(match && Object.values(rule.contentTypes).includes(match[1] as never))
}

/** Object paths of a custom media record that belong to this variation's uploads. */
function customExerciseMediaObjectPaths(customMedia: JsonRecord | undefined, variationId: string) {
  const paths: string[] = []
  if (isCustomExerciseMediaObjectPathFor(variationId, "thumbnail", customMedia?.thumbnailObjectPath)) {
    paths.push(customMedia.thumbnailObjectPath)
  }
  if (isCustomExerciseMediaObjectPathFor(variationId, "animation", customMedia?.animationObjectPath)) {
    paths.push(customMedia.animationObjectPath)
  }
  return paths
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
  supabaseUrl: string
  thumbnail?: UploadedExerciseMediaFile
  updatedAt: Date
  updatedById: string
}) {
  const thumbnailUrl = input.thumbnail
    ? publicObjectUrl(input.supabaseUrl, input.thumbnail.objectPath)
    : input.current?.thumbnailUrl
  const animationUrl = input.animation
    ? publicObjectUrl(input.supabaseUrl, input.animation.objectPath)
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

  const thumbnailObjectPath = input.thumbnail?.objectPath ?? input.previousCustom?.thumbnailObjectPath
  const animationObjectPath = input.animation?.objectPath ?? input.previousCustom?.animationObjectPath
  if (typeof thumbnailObjectPath === "string") record.thumbnailObjectPath = thumbnailObjectPath
  if (typeof animationObjectPath === "string") record.animationObjectPath = animationObjectPath

  return record
}

export {
  CUSTOM_EXERCISE_MEDIA_METADATA_KEY,
  EXERCISE_MEDIA_ALLOWED_MIME_TYPES,
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_MEDIA_DIMENSION,
  EXERCISE_MEDIA_FILE_RULES,
  EXTERNAL_SOURCE_METADATA_KEY,
  buildCustomExerciseMedia,
  createCustomExerciseMediaObjectPath,
  customExerciseMediaObjectPaths,
  exerciseMediaFileError,
  isCustomExerciseMediaObjectPathFor,
  publicObjectUrl,
  readCustomExerciseMedia,
  readExternalSourceMetadata,
  resolveExerciseMedia,
  serializeExerciseMedia,
}
export type { ExerciseMediaKind, ExerciseMediaSource, SerializedExerciseMedia, UploadedExerciseMediaFile }
