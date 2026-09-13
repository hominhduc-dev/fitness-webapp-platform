import type { AdminExerciseMediaKind } from "./types"

const MB = 1024 * 1024

/**
 * Client-side mirror of the backend's EXERCISE_MEDIA_FILE_RULES
 * (backend/src/lib/exercise-media.ts), so a wrong file is caught before any
 * upload starts. The backend checks the uploaded object again either way.
 */
const EXERCISE_MEDIA_FILE_RULES: Record<AdminExerciseMediaKind, { contentTypes: readonly string[]; extensions: string; maxBytes: number }> = {
  animation: { contentTypes: ["image/gif", "image/webp", "video/mp4"], extensions: "GIF, MP4, WebP", maxBytes: 10 * MB },
  thumbnail: { contentTypes: ["image/jpeg", "image/png", "image/webp"], extensions: "JPG, PNG, WebP", maxBytes: 2 * MB },
}

function exerciseMediaFileProblem(kind: AdminExerciseMediaKind, file: Pick<File, "size" | "type">) {
  const rule = EXERCISE_MEDIA_FILE_RULES[kind]
  if (!rule.contentTypes.includes(file.type)) return "type" as const
  if (file.size <= 0 || file.size > rule.maxBytes) return "size" as const
  return undefined
}

function exerciseMediaMaxMegabytes(kind: AdminExerciseMediaKind) {
  return EXERCISE_MEDIA_FILE_RULES[kind].maxBytes / MB
}

export { EXERCISE_MEDIA_FILE_RULES, exerciseMediaFileProblem, exerciseMediaMaxMegabytes }
