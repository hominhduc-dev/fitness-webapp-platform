"use client"

import { FolderOpen, Loader2 } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Drop area plus an explicit "choose file" button. The button is the keyboard
 * and touch path; dropping is a convenience on top of it.
 */
export function FileDropzone({
  accept,
  actionLabel,
  busy = false,
  footnote,
  hint,
  icon,
  onFile,
  title,
}: {
  accept: string
  actionLabel: string
  busy?: boolean
  footnote?: ReactNode
  hint?: ReactNode
  icon: ReactNode
  onFile: (file: File | undefined) => void
  title: ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        onFile(event.dataTransfer.files[0])
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors sm:py-10",
        dragging ? "border-primary bg-primary-soft" : "border-input bg-surface-subtle",
      )}
    >
      <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-10">
        {busy ? <Loader2 className="animate-spin" /> : icon}
      </span>
      <p className="mt-3 text-base font-semibold text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <Button type="button" className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
        <FolderOpen />
        {actionLabel}
      </Button>
      {footnote ? <p className="mt-3 text-xs text-muted-foreground">{footnote}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0])
          // Allow picking the same file again after fixing it.
          event.target.value = ""
        }}
      />
    </div>
  )
}
