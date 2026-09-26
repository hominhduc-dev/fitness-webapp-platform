"use client"

import { ChevronDown, MoreHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { SyncStatusBadge } from "@/components/offline/sync-status-badge"
import { useLocale } from "@/components/providers/locale-provider"

interface SessionHeaderProps {
  dateLabel: string
  title: string
  onLeave: () => void
  onOpenOptions: () => void
  /** The progress bar and stats line, pinned with the header. */
  children?: ReactNode
}

const ICON_BUTTON_CLASS =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted pointer-coarse:size-11"

/**
 * Pinned, full-bleed frosted header: leave (the session stays saved and the
 * dashboard offers to resume it), date and title, and the options sheet.
 */
export function SessionHeader({ dateLabel, title, onLeave, onOpenOptions, children }: SessionHeaderProps) {
  const { messages } = useLocale()

  return (
    <header className="sticky top-0 z-30 -mx-3 mb-5 glass-veil px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:-mx-4 sm:px-4 md:-mx-10 md:px-10">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onLeave} aria-label={messages.workoutPage.leaveSession} className={ICON_BUTTON_CLASS}>
          <ChevronDown className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex min-h-5 flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{dateLabel}</p>
            <SyncStatusBadge className="h-5" />
          </div>
          <h1 className="m-0 truncate text-lg font-semibold leading-tight tracking-[-0.01em] text-foreground">{title}</h1>
        </div>
        <button
          type="button"
          onClick={onOpenOptions}
          aria-label={messages.workoutPage.sessionOptions}
          aria-haspopup="dialog"
          className={ICON_BUTTON_CLASS}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </header>
  )
}
