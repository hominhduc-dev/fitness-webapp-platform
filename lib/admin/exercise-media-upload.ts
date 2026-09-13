"use client"

import { createAdminExerciseMediaUploadRequest, saveAdminExerciseMediaRequest } from "@/lib/admin/api"
import type { AdminExerciseMediaFiles, AdminExerciseMediaKind } from "@/lib/admin/types"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

/**
 * Uploads one file straight to Storage with a signed URL from the API, so large
 * animations never go through the API's JSON body limit or the frontend proxy.
 */
async function uploadExerciseMediaFile(accessToken: string, exerciseId: string, kind: AdminExerciseMediaKind, file: File) {
  const upload = await createAdminExerciseMediaUploadRequest(accessToken, exerciseId, {
    contentType: file.type,
    kind,
    size: file.size,
  })
  const { error } = await createBrowserSupabaseClient()
    .storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.objectPath, upload.token, file, { cacheControl: "31536000", contentType: file.type })

  if (error) throw new Error(error.message)
  return upload.objectPath
}

/** Uploads the picked files, then points the variation at them. */
async function uploadAdminExerciseMedia(accessToken: string, exerciseId: string, files: AdminExerciseMediaFiles) {
  const [thumbnailObjectPath, animationObjectPath] = await Promise.all([
    files.thumbnail ? uploadExerciseMediaFile(accessToken, exerciseId, "thumbnail", files.thumbnail) : undefined,
    files.animation ? uploadExerciseMediaFile(accessToken, exerciseId, "animation", files.animation) : undefined,
  ])

  return saveAdminExerciseMediaRequest(accessToken, exerciseId, { animationObjectPath, thumbnailObjectPath })
}

export { uploadAdminExerciseMedia }
