import { createHash, randomUUID } from "node:crypto"

import { env } from "../config/env"
import { ExternalServiceError, ValidationError } from "../services/errors"
import { EXERCISE_MEDIA_BUCKET, EXERCISE_MEDIA_FILE_RULES, type ExerciseMediaKind } from "./exercise-media"

const EXERCISE_MEDIA_MAX_FILE_SIZE = 1024 * 1024
const EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024
const STORAGE_ADMIN_MEDIA_ROOT = "admin"

type StorageUploadGrant = {
  bucket: string
  contentType: string
  kind: ExerciseMediaKind
  path: string
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

/**
 * Where an admin upload lands in the bucket. The random name keeps a replacement
 * from being served from a cache under its predecessor's URL, and the extension
 * follows the content type so the object is served with the right one.
 */
function createExerciseMediaObjectPath(variationId: string, kind: ExerciseMediaKind, contentType: string) {
  const extension = (EXERCISE_MEDIA_FILE_RULES[kind].contentTypes as Record<string, string>)[contentType]
  if (!extension) throw new ValidationError("Loại file không được hỗ trợ.")
  return `${STORAGE_ADMIN_MEDIA_ROOT}/${variationId}/${kind}-${randomUUID()}${extension}`
}

function isAdminExerciseMediaObjectPath(variationId: string, kind: ExerciseMediaKind, path: string) {
  const extensions = Object.values(EXERCISE_MEDIA_FILE_RULES[kind].contentTypes)
    .map((extension) => extension.replace(".", "\\."))
    .join("|")
  const pattern = new RegExp(
    `^${STORAGE_ADMIN_MEDIA_ROOT}/${variationId}/${kind}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(${extensions})$`,
  )
  return pattern.test(path)
}

function requireStorageMediaConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new ExternalServiceError("Supabase Storage is not configured for exercise media uploads.")
  }
  return { serviceRoleKey: env.supabaseServiceRoleKey, supabaseUrl: env.supabaseUrl.replace(/\/+$/, "") }
}

/**
 * A one-shot upload URL the browser can PUT the file to directly, so a large
 * animation never passes through the API body limit or the frontend proxy. The
 * token in the URL is bound to this single object path and carries its own auth,
 * so the browser needs no key of ours.
 */
async function createStorageUploadGrant(input: {
  contentType: string
  kind: ExerciseMediaKind
  path: string
}): Promise<StorageUploadGrant> {
  const { serviceRoleKey, supabaseUrl } = requireStorageMediaConfig()
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/${EXERCISE_MEDIA_BUCKET}/${input.path}`,
    {
      body: "{}",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  )
  if (!response.ok) {
    throw new ExternalServiceError("Không tạo được đường dẫn tải media lên.")
  }
  const signed = await response.json() as { url?: string }
  if (typeof signed.url !== "string") {
    throw new ExternalServiceError("Phản hồi tạo đường dẫn tải lên không hợp lệ.")
  }

  return {
    bucket: EXERCISE_MEDIA_BUCKET,
    contentType: input.contentType,
    kind: input.kind,
    path: input.path,
    uploadUrl: `${supabaseUrl}/storage/v1${signed.url}`,
  }
}

/** The stored object, as the storage API reports it once the upload has landed. */
async function readStorageObjectInfo(bucket: string, path: string) {
  const { supabaseUrl } = requireStorageMediaConfig()
  const response = await fetch(`${supabaseUrl}/storage/v1/object/info/public/${bucket}/${path}`)
  if (!response.ok) return undefined
  const info = await response.json() as { content_type?: string; size?: number }
  return typeof info.content_type === "string" && typeof info.size === "number"
    ? { contentType: info.content_type, size: info.size }
    : undefined
}

async function removeStorageObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) return
  const { serviceRoleKey, supabaseUrl } = requireStorageMediaConfig()
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({ prefixes: paths }),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    method: "DELETE",
  })
  if (!response.ok) throw new ExternalServiceError("Không xoá được media cũ.")
}

export {
  EXERCISE_MEDIA_MAX_FILE_SIZE,
  EXTERNAL_EXERCISE_MEDIA_MAX_FILE_SIZE,
  assertMediaUploadFlags,
  cloudinarySignature,
  createExerciseMediaObjectPath,
  createStorageUploadGrant,
  isAdminExerciseMediaObjectPath,
  readStorageObjectInfo,
  removeStorageObjects,
}
export type { StorageUploadGrant }
