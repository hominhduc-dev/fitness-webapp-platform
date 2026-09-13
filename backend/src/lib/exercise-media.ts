import { env } from "../config/env"

const EXERCISE_MEDIA_BUCKET = "exercise-media"
const EXERCISE_MEDIA_DIMENSION = 180 as const

type JsonRecord = Record<string, unknown>
type ExerciseMediaType = "gif" | "video"

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

/**
 * Variation metadata synced from an external exercise workbook: display name,
 * source exercise id and media. Rows synced before the key was renamed still
 * carry it under the legacy key, which is read as a fallback.
 */
const EXTERNAL_SOURCE_METADATA_KEY = "externalSource"
const LEGACY_EXTERNAL_SOURCE_METADATA_KEY = "hevy"

function readExternalSourceMetadata(metadata: unknown) {
  const root = asRecord(metadata)
  return asRecord(root?.[EXTERNAL_SOURCE_METADATA_KEY]) ?? asRecord(root?.[LEGACY_EXTERNAL_SOURCE_METADATA_KEY])
}

function serializeExerciseMedia(metadata: unknown, supabaseUrl = env.supabaseUrl) {
  const root = asRecord(metadata)
  const externalMedia = asRecord(readExternalSourceMetadata(root)?.media)
  const externalThumbnailUrl = asUrl(externalMedia?.thumbnailUrl)
  const externalAnimationUrl = asUrl(externalMedia?.animationUrl)

  if (externalThumbnailUrl && externalAnimationUrl) {
    const explicitType = externalMedia?.animationType === "video" || externalMedia?.animationType === "gif"
      ? externalMedia.animationType
      : undefined
    const mediaType: ExerciseMediaType = explicitType ?? (externalAnimationUrl.toLowerCase().endsWith(".mp4") ? "video" : "gif")

    return {
      animationUrl: externalAnimationUrl,
      height: EXERCISE_MEDIA_DIMENSION,
      thumbnailUrl: externalThumbnailUrl,
      type: mediaType,
      width: EXERCISE_MEDIA_DIMENSION,
    }
  }

  if (!supabaseUrl) return undefined

  const dataset = asRecord(root?.exerciseDataset)
  const media = asRecord(dataset?.media)
  const thumbnailObjectPath = media?.thumbnailObjectPath
  const animationObjectPath = media?.animationObjectPath

  if (
    !isSafeObjectPath(thumbnailObjectPath, "images") ||
    !isSafeObjectPath(animationObjectPath, "videos")
  ) {
    return undefined
  }

  return {
    animationUrl: publicObjectUrl(supabaseUrl, animationObjectPath),
    height: EXERCISE_MEDIA_DIMENSION,
    thumbnailUrl: publicObjectUrl(supabaseUrl, thumbnailObjectPath),
    type: "gif" as const,
    width: EXERCISE_MEDIA_DIMENSION,
  }
}

export {
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_MEDIA_DIMENSION,
  EXTERNAL_SOURCE_METADATA_KEY,
  LEGACY_EXTERNAL_SOURCE_METADATA_KEY,
  publicObjectUrl,
  readExternalSourceMetadata,
  serializeExerciseMedia,
}
