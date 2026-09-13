"use client"

import Image from "next/image"
import { ImageUp, Loader2, Trash2, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EXERCISE_MEDIA_FILE_RULES, exerciseMediaFileProblem, exerciseMediaMaxMegabytes } from "@/lib/admin/exercise-media-files"
import type { AdminExerciseItem, AdminExerciseMediaFiles, AdminExerciseMediaKind } from "@/lib/admin/types"
import { cn } from "@/lib/utils"

const MEDIA_KINDS: AdminExerciseMediaKind[] = ["thumbnail", "animation"]

function getMediaEditorCopy(locale: "en" | "vi") {
  const en = locale === "en"
  const kindLabel = (kind: AdminExerciseMediaKind) => (kind === "thumbnail" ? "Thumbnail" : "Animation")

  return {
    chooseFile: en ? "Choose file" : "Chọn file",
    clearFile: (kind: AdminExerciseMediaKind) => (en ? `Remove ${kindLabel(kind).toLowerCase()} file` : `Bỏ file ${kindLabel(kind).toLowerCase()}`),
    fileHint: (kind: AdminExerciseMediaKind) =>
      `${EXERCISE_MEDIA_FILE_RULES[kind].extensions} · ${en ? "max" : "tối đa"} ${exerciseMediaMaxMegabytes(kind)}MB`,
    kindLabel,
    missingHint: en
      ? "No media yet. Choose both a thumbnail and an animation."
      : "Chưa có media. Chọn cả thumbnail và animation.",
    remove: en ? "Remove uploaded media" : "Xoá media đã tải lên",
    removeConfirm: en
      ? "Remove the uploaded media? The exercise goes back to its synced media, if it has any."
      : "Xoá media đã tải lên? Bài tập sẽ quay về media đồng bộ (nếu có).",
    removed: en ? "Uploaded media removed." : "Đã xoá media đã tải lên.",
    replaceHint: en
      ? "Choose a file to replace the thumbnail, the animation or both."
      : "Chọn file để thay thumbnail, animation hoặc cả hai.",
    requestFailed: en ? "Could not update the media." : "Không thể cập nhật media.",
    saved: en ? "Media updated." : "Đã cập nhật media.",
    source: (source: AdminExerciseItem["mediaSource"]) => {
      if (source === "custom") return en ? "Uploaded" : "Admin tải lên"
      if (source === "external") return en ? "Synced" : "Đồng bộ"
      if (source === "dataset") return "Dataset"
      return en ? "Missing" : "Chưa có"
    },
    title: "Media",
    tooLarge: (kind: AdminExerciseMediaKind) =>
      en
        ? `${kindLabel(kind)} must be ${exerciseMediaMaxMegabytes(kind)}MB or smaller.`
        : `${kindLabel(kind)} tối đa ${exerciseMediaMaxMegabytes(kind)}MB.`,
    upload: en ? "Upload media" : "Tải lên media",
    wrongType: (kind: AdminExerciseMediaKind) =>
      en
        ? `${kindLabel(kind)} must be ${EXERCISE_MEDIA_FILE_RULES[kind].extensions}.`
        : `${kindLabel(kind)} chỉ nhận ${EXERCISE_MEDIA_FILE_RULES[kind].extensions}.`,
  }
}

type MediaEditorCopy = ReturnType<typeof getMediaEditorCopy>

/**
 * Thumbnail and animation upload for one variation, inside the admin edit
 * dialog. It saves on its own, independently of the exercise form.
 */
export function ExerciseMediaEditor({
  exercise,
  locale,
  onRemove,
  onSave,
}: {
  exercise: AdminExerciseItem
  locale: "en" | "vi"
  onRemove: () => Promise<void>
  onSave: (files: AdminExerciseMediaFiles) => Promise<void>
}) {
  const copy = getMediaEditorCopy(locale)
  const titleId = useId()
  const [files, setFiles] = useState<AdminExerciseMediaFiles>({})
  const [status, setStatus] = useState<"idle" | "saving" | "removing">("idle")
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null)

  const hasMedia = Boolean(exercise.media)
  const hasFiles = Boolean(files.thumbnail || files.animation)
  const missingSide = !hasMedia && !(files.thumbnail && files.animation)
  const busy = status !== "idle"

  function pickFile(kind: AdminExerciseMediaKind, file: File | undefined) {
    if (!file) return
    const problem = exerciseMediaFileProblem(kind, file)
    if (problem) {
      setMessage({ text: problem === "type" ? copy.wrongType(kind) : copy.tooLarge(kind), tone: "error" })
      return
    }
    setMessage(null)
    setFiles((current) => ({ ...current, [kind]: file }))
  }

  function clearFile(kind: AdminExerciseMediaKind) {
    setFiles((current) => {
      const next = { ...current }
      delete next[kind]
      return next
    })
  }

  async function run(action: "saving" | "removing", task: () => Promise<void>, successText: string) {
    setStatus(action)
    setMessage(null)
    try {
      await task()
      setMessage({ text: successText, tone: "success" })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : copy.requestFailed, tone: "error" })
    } finally {
      setStatus("idle")
    }
  }

  function save() {
    if (!hasFiles || missingSide) return
    void run("saving", async () => {
      await onSave(files)
      setFiles({})
    }, copy.saved)
  }

  function remove() {
    if (!window.confirm(copy.removeConfirm)) return
    void run("removing", onRemove, copy.removed)
  }

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="label-micro text-muted-foreground">{copy.title}</h3>
        <Badge variant="outline" className="font-mono text-micro">{copy.source(exercise.mediaSource)}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ExerciseThumbnail media={exercise.media} name={exercise.name} previewable size="md" />
        <p className="text-xs text-muted-foreground">{hasMedia ? copy.replaceHint : copy.missingHint}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {MEDIA_KINDS.map((kind) => (
          <MediaFilePicker
            key={kind}
            copy={copy}
            disabled={busy}
            file={files[kind]}
            kind={kind}
            onClear={() => clearFile(kind)}
            onFile={(file) => pickFile(kind, file)}
          />
        ))}
      </div>

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn("mt-2 text-xs", message.tone === "error" ? "text-destructive-text" : "text-foreground")}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {exercise.mediaSource === "custom" ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
            {status === "removing" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {copy.remove}
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!hasFiles || missingSide || busy} onClick={save}>
          {status === "saving" ? <Loader2 className="animate-spin" /> : <ImageUp />}
          {copy.upload}
        </Button>
      </div>
    </section>
  )
}

function MediaFilePicker({
  copy,
  disabled,
  file,
  kind,
  onClear,
  onFile,
}: {
  copy: MediaEditorCopy
  disabled: boolean
  file?: File
  kind: AdminExerciseMediaKind
  onClear: () => void
  onFile: (file: File | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = useObjectUrl(kind === "thumbnail" ? file : undefined)
  const label = copy.kindLabel(kind)

  return (
    <div className="rounded-md border border-dashed border-input bg-surface-subtle p-2.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-micro text-muted-foreground">{copy.fileHint(kind)}</p>

      {file ? (
        <div className="mt-2 flex items-center gap-2">
          {previewUrl ? (
            <Image alt="" className="size-8 rounded object-cover" height={32} src={previewUrl} unoptimized width={32} />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{file.name}</span>
          <button
            type="button"
            aria-label={copy.clearFile(kind)}
            disabled={disabled}
            onClick={onClear}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-2" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {copy.chooseFile}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        aria-label={label}
        accept={EXERCISE_MEDIA_FILE_RULES[kind].contentTypes.join(",")}
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0])
          // Allow picking the same file again after clearing it.
          event.target.value = ""
        }}
      />
    </div>
  )
}

/** A blob URL to preview a picked image, revoked when the file changes. */
function useObjectUrl(file: File | undefined) {
  const url = useMemo(
    () => (file && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : undefined),
    [file],
  )
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}
