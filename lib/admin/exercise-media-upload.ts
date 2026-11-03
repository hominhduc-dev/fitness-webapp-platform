"use client"

import { createAdminExerciseMediaUploadRequest, saveAdminExerciseMediaRequest } from "@/lib/admin/api"
import type { AdminExerciseMediaFiles, AdminExerciseMediaKind, AdminExerciseMediaUploadedAsset } from "@/lib/admin/types"

/**
 * Uploads one file straight to Supabase Storage with a signed upload URL from the
 * API, so large animations never go through the API's JSON body limit or the
 * frontend proxy. The URL carries its own single-use token, so no key is exposed
 * here, and the API reads the stored file back before trusting it.
 */
async function uploadExerciseMediaFile(accessToken: string, exerciseId: string, kind: AdminExerciseMediaKind, file: File) {
  const upload = await createAdminExerciseMediaUploadRequest(accessToken, exerciseId, {
    contentType: file.type,
    kind,
    size: file.size,
  })

  const response = await fetch(upload.uploadUrl, {
    body: file,
    headers: { "content-type": file.type, "x-upsert": "true" },
    method: "PUT",
  })
  if (!response.ok) {
    const details = await response.text().catch(() => "")
    throw new Error(details || "Tải media lên thất bại.")
  }

  return { contentType: file.type, path: upload.path } satisfies AdminExerciseMediaUploadedAsset
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
