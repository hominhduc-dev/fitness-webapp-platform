"use client"

import { createAdminExerciseMediaUploadRequest, saveAdminExerciseMediaRequest } from "@/lib/admin/api"
import type { AdminExerciseMediaFiles, AdminExerciseMediaKind, AdminExerciseMediaUploadedAsset } from "@/lib/admin/types"

type CloudinaryUploadResponse = {
  public_id?: string
  resource_type?: string
  secure_url?: string
  version?: number
}

/**
 * Uploads one file straight to Cloudinary with signed params from the API, so large
 * animations never go through the API's JSON body limit or the frontend proxy.
 */
async function uploadExerciseMediaFile(accessToken: string, exerciseId: string, kind: AdminExerciseMediaKind, file: File) {
  const upload = await createAdminExerciseMediaUploadRequest(accessToken, exerciseId, {
    contentType: file.type,
    kind,
    size: file.size,
  })

  const body = new FormData()
  body.set("api_key", upload.apiKey)
  body.set("file", file)
  body.set("public_id", upload.publicId)
  body.set("signature", upload.signature)
  body.set("timestamp", String(upload.timestamp))

  const response = await fetch(upload.uploadUrl, { body, method: "POST" })
  if (!response.ok) {
    const details = await response.text().catch(() => "")
    throw new Error(details || "Cloudinary upload failed.")
  }
  const result = await response.json() as CloudinaryUploadResponse
  if (
    result.public_id !== upload.publicId ||
    result.resource_type !== upload.resourceType ||
    typeof result.secure_url !== "string" ||
    typeof result.version !== "number"
  ) {
    throw new Error("Cloudinary upload response is invalid.")
  }

  return {
    cloudName: upload.cloudName,
    contentType: file.type,
    publicId: result.public_id,
    resourceType: upload.resourceType,
    secureUrl: result.secure_url,
    version: result.version,
  } satisfies AdminExerciseMediaUploadedAsset
}

/** Uploads the picked files, then points the variation at them. */
async function uploadAdminExerciseMedia(accessToken: string, exerciseId: string, files: AdminExerciseMediaFiles) {
  const [thumbnailUpload, animationUpload] = await Promise.all([
    files.thumbnail ? uploadExerciseMediaFile(accessToken, exerciseId, "thumbnail", files.thumbnail) : undefined,
    files.animation ? uploadExerciseMediaFile(accessToken, exerciseId, "animation", files.animation) : undefined,
  ])

  return saveAdminExerciseMediaRequest(accessToken, exerciseId, { animationUpload, thumbnailUpload })
}

export { uploadAdminExerciseMedia }
