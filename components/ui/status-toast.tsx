"use client"

import { CheckCircle2, TriangleAlert, X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export type StatusToastTone = "error" | "success"

export type StatusToastProps = {
  action?: React.ReactNode
  description?: React.ReactNode
  dismissLabel: string
  onDismiss: () => void
  title: string
  tone: StatusToastTone
}

/**
 * One toast, with no opinion about where it sits or how long it lasts.
 *
 * Placement, stacking and timing belong to `ToastProvider`. Keeping this purely
 * presentational is what lets a preview page or a test render one directly.
 */
export function StatusToast({ action, description, dismissLabel, onDismiss, title, tone }: StatusToastProps) {
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert

  return (
    // The tint an Alert variant carries is nearly transparent, which reads fine
    // on a page but lets whatever is behind a floating toast show through. This
    // opaque layer is what the tint composites onto.
    <div
      className={cn(
        "pointer-events-auto w-full rounded-xl bg-background shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
      )}
    >
      <Alert role={tone === "success" ? "status" : "alert"} variant={tone === "success" ? "success" : "destructive"}>
        <Icon />
        <AlertTitle className="pr-6">{title}</AlertTitle>
        {description ? <AlertDescription className="pr-6">{description}</AlertDescription> : null}
        {action ? <div className="mt-2 pl-7">{action}</div> : null}
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </Alert>
    </div>
  )
}
