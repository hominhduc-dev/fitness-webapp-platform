import { env } from "../config/env"

const EXERCISE_MEDIA_BUCKET = "exercise-media"
const EXERCISE_MEDIA_DIMENSION = 180 as const

type JsonRecord = Record<string, unknown>

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

function serializeExerciseMedia(metadata: unknown, supabaseUrl = env.supabaseUrl) {
  if (!supabaseUrl) return undefined

  const root = asRecord(metadata)
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
    width: EXERCISE_MEDIA_DIMENSION,
  }
}

export {
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_MEDIA_DIMENSION,
  publicObjectUrl,
  serializeExerciseMedia,
}
