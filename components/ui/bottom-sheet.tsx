"use client"

import { useEffect, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Bottom sheet on phones, centred dialog from `sm` up.
 *
 * Everything mobile browsers get wrong lives in here so a call site cannot
 * forget it: dynamic viewport sizing, the iOS home-indicator inset, Escape,
 * and the background scroll lock. Reach for this instead of hand-rolling
 * another `fixed inset-0` overlay.
 *
 * Two shapes:
 * - `floating` (default) — gutters on every side, all four corners rounded.
 *   The overlay owns the bottom inset, so the sheet itself needs none.
 * - `flush` — pinned to the bottom edge, only the top corners rounded. The
 *   sheet touches the home indicator, so the inset moves inside it.
 *
 * Which one is in play is published as `--sheet-safe-bottom`, and
 * `BottomSheetBody` / `BottomSheetFooter` pad themselves from it. That is why
 * the inset never has to be repeated — or doubled — per sheet.
 *
 * Not included: a focus trap. Sheets that need one should use `ui/dialog`
 * (Radix) rather than growing this.
 */

const VARIANT_OVERLAY = {
  // The overlay's own padding is what `max-h-full` on the panel measures
  // against, which is how the sheet stays inside the visible viewport without
  // any `calc(100dvh - …)` arithmetic at the call site.
  floating:
    "px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-6",
  flush: "pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-6",
} as const

const VARIANT_PANEL = {
  floating: "rounded-3xl [--sheet-safe-bottom:0px]",
  flush: "rounded-t-2xl [--sheet-safe-bottom:env(safe-area-inset-bottom)] sm:rounded-2xl sm:[--sheet-safe-bottom:0px]",
} as const

// Sheets can stack, so the lock is refcounted — the first one in locks, the
// last one out restores whatever the page had.
let openSheetCount = 0
let restoreBodyOverflow = ""

function useSheetSideEffects(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  useEffect(() => {
    openSheetCount += 1
    if (openSheetCount === 1) {
      restoreBodyOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }

    return () => {
      openSheetCount -= 1
      if (openSheetCount === 0) {
        document.body.style.overflow = restoreBodyOverflow
      }
    }
  }, [])
}

export function BottomSheet({
  ariaLabel,
  children,
  className,
  labelledBy,
  onClose,
  overlayClassName,
  showGrabHandle = true,
  variant = "floating",
}: {
  ariaLabel?: string
  children: ReactNode
  /** Extra classes for the panel — size, palette, radius overrides. */
  className?: string
  labelledBy?: string
  onClose: () => void
  /** Extra classes for the overlay — stacking order and scrim, mainly. */
  overlayClassName?: string
  showGrabHandle?: boolean
  variant?: keyof typeof VARIANT_PANEL
}) {
  useSheetSideEffects(onClose)

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center bg-overlay-soft backdrop-blur-md sm:items-center",
        VARIANT_OVERLAY[variant],
        overlayClassName,
      )}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={cn(
          "flex max-h-full w-full flex-col overflow-hidden border border-border bg-background shadow-2xl sm:max-w-lg",
          VARIANT_PANEL[variant],
          className,
        )}
        role="dialog"
      >
        {showGrabHandle ? (
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/15 sm:hidden" />
        ) : null}
        {children}
      </div>
    </div>
  )
}

export function BottomSheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function BottomSheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // The bottom inset is here as well as on the footer: a sheet without a
        // footer ends on the body, and on `floating` the variable is 0 anyway.
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+var(--sheet-safe-bottom,0px))] pt-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function BottomSheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-t border-border px-4 pb-[calc(1rem+var(--sheet-safe-bottom,0px))] pt-4 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  )
}
