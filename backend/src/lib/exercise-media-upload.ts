import type { ExerciseDatasetRecord } from "../domain/exercise-dataset"
import { ExternalServiceError, ValidationError } from "../services/errors"
import { EXERCISE_MEDIA_ALLOWED_MIME_TYPES, EXERCISE_MEDIA_BUCKET } from "./exercise-media"
import { supabaseAdmin } from "./supabase"

const EXERCISE_MEDIA_MAX_FILE_SIZE = 1024 * 1024
const EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024
const EXERCISE_MEDIA_UPLOAD_CONCURRENCY = 8
const EXERCISE_MEDIA_UPLOAD_MAX_ATTEMPTS = 3

type UploadEntry = {
  contentType: "image/gif" | "image/jpeg" | "video/mp4"
  localPath: string
  objectPath: string
}

function assertMediaUploadFlags(options: {
  apply: boolean
  confirmMediaRights: boolean
  uploadMedia: boolean
}) {
  if (options.uploadMedia && !options.apply) {
    throw new ValidationError("--upload-media requires --apply because uploads mutate Storage.")
  }
  if (options.uploadMedia && !options.confirmMediaRights) {
    throw new ValidationError("--upload-media requires --confirm-media-rights.")
  }
}

function buildMediaUploadEntries(
  records: ExerciseDatasetRecord[],
  datasetDirectory: string,
  sourceCommit: string,
) {
  return records.flatMap<UploadEntry>((record) => [
    {
      contentType: "image/jpeg",
      localPath: `${datasetDirectory}/${record.image}`,
      objectPath: `${sourceCommit}/${record.image}`,
    },
    {
      contentType: "image/gif",
      localPath: `${datasetDirectory}/${record.gif_url}`,
      objectPath: `${sourceCommit}/${record.gif_url}`,
    },
  ])
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) return String(error.message)
  return String(error)
}

function isAlreadyExistsError(error: unknown) {
  const message = errorMessage(error).toLowerCase()
  return message.includes("already exists") || message.includes("duplicate") || message.includes("resource already exists")
}

function isRetryableStorageError(error: unknown) {
  const status = error && typeof error === "object" && "statusCode" in error
    ? Number(error.statusCode)
    : undefined
  const message = errorMessage(error).toLowerCase()
  return status === 429 || Boolean(status && status >= 500) || message.includes("timeout") || message.includes("fetch failed")
}

function isNotFoundMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes("not found") || normalized.includes("does not exist")
}

/** Creates the public media bucket, or brings its type and size limits up to date. */
async function ensureExerciseMediaBucket() {
  if (!supabaseAdmin) throw new ExternalServiceError("Supabase service-role client is not configured.")
  const configuration = {
    allowedMimeTypes: EXERCISE_MEDIA_ALLOWED_MIME_TYPES,
    fileSizeLimit: EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE,
    public: true,
  }
  const { error } = await supabaseAdmin.storage.getBucket(EXERCISE_MEDIA_BUCKET)
  if (error && isNotFoundMessage(error.message)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(EXERCISE_MEDIA_BUCKET, configuration)
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new ExternalServiceError(`Storage bucket setup failed: ${createError.message}`, { cause: createError })
    }
    return
  }
  if (error) throw new ExternalServiceError(`Storage bucket lookup failed: ${error.message}`, { cause: error })
  const { error: updateError } = await supabaseAdmin.storage.updateBucket(EXERCISE_MEDIA_BUCKET, configuration)
  if (updateError) throw new ExternalServiceError(`Storage bucket update failed: ${updateError.message}`, { cause: updateError })
}

async function uploadWithRetry(
  upload: () => Promise<{ error: unknown | null }>,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= EXERCISE_MEDIA_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    const { error } = await upload()
    if (!error) return "uploaded" as const
    if (isAlreadyExistsError(error)) return "skipped" as const
    lastError = error
    if (!isRetryableStorageError(error) || attempt === EXERCISE_MEDIA_UPLOAD_MAX_ATTEMPTS) break
    await wait(250 * attempt)
  }
  throw new ExternalServiceError(`Storage upload failed: ${errorMessage(lastError)}`, { cause: lastError })
}

export {
  EXERCISE_MEDIA_MAX_FILE_SIZE,
  EXERCISE_MEDIA_UPLOAD_CONCURRENCY,
  EXERCISE_MEDIA_UPLOAD_MAX_ATTEMPTS,
  EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE,
  assertMediaUploadFlags,
  buildMediaUploadEntries,
  ensureExerciseMediaBucket,
  isAlreadyExistsError,
  uploadWithRetry,
}
export type { UploadEntry }
