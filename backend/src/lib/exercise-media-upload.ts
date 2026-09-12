import type { ExerciseDatasetRecord } from "../domain/exercise-dataset"
import { ExternalServiceError, ValidationError } from "../services/errors"

const EXERCISE_MEDIA_MAX_FILE_SIZE = 1024 * 1024
const EXERCISE_MEDIA_UPLOAD_CONCURRENCY = 8
const EXERCISE_MEDIA_UPLOAD_MAX_ATTEMPTS = 3

type UploadEntry = {
  contentType: "image/gif" | "image/jpeg"
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
  assertMediaUploadFlags,
  buildMediaUploadEntries,
  isAlreadyExistsError,
  uploadWithRetry,
}
export type { UploadEntry }
