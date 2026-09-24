"use client"

import { ChevronsRight, Loader2 } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"

/** How far along the track (0–1) a release counts as confirmed. */
const CONFIRM_AT = 0.85
/** After confirming, the thumb returns home unless the parent is still busy. */
const RESET_AFTER_MS = 600

interface SlideToConfirmProps {
  label: string
  /** Accessible name of the thumb, which also confirms on Enter/Space. */
  actionLabel: string
  onConfirm: () => void
  disabled?: boolean
  /** Shown instead of `label` while disabled, saying what unlocks the slide. */
  disabledLabel?: string
  /** While true the thumb stays at the end and `busyLabel` replaces the label. */
  busy?: boolean
  busyLabel?: string
  className?: string
}

/**
 * A slide-to-confirm control for actions that should not fire on a stray tap.
 * Dragging the thumb past CONFIRM_AT confirms; letting go earlier springs it
 * back. The thumb is a real button, so keyboard and screen-reader users
 * confirm by activating it instead of dragging.
 */
function SlideToConfirm({
  label,
  actionLabel,
  onConfirm,
  disabled,
  disabledLabel,
  busy,
  busyLabel,
  className,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLButtonElement | null>(null)
  const drag = useRef<{ pointerId: number; startX: number; max: number } | null>(null)
  const [offset, setOffset] = useState(0)
  // Measured when a drag starts or on confirm; refs are not read during render.
  const [max, setMax] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const maxOffset = () => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return 0
    // 4px inset on each side of the thumb.
    return Math.max(0, track.clientWidth - thumb.offsetWidth - 8)
  }

  // Back to the start once the parent has finished (or never got busy, e.g.
  // it opened a confirmation dialog the trainee dismissed).
  useEffect(() => {
    if (!confirmed || busy) return
    const timeoutId = window.setTimeout(() => {
      setConfirmed(false)
      setOffset(0)
    }, RESET_AFTER_MS)
    return () => window.clearTimeout(timeoutId)
  }, [confirmed, busy])

  const confirm = () => {
    const end = maxOffset()
    setMax(end)
    setOffset(end)
    setConfirmed(true)
    onConfirm()
  }

  const locked = disabled || busy || confirmed

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (locked || event.button !== 0) return
    const end = maxOffset()
    drag.current = { pointerId: event.pointerId, startX: event.clientX - offset, max: end }
    setMax(end)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const next = Math.min(current.max, Math.max(0, event.clientX - current.startX))
    setOffset(next)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (current.max > 0 && offset >= current.max * CONFIRM_AT) confirm()
    else setOffset(0)
  }

  const progress = max > 0 ? Math.min(1, offset / max) : 0

  return (
    <div
      ref={trackRef}
      className={cn(
        // Always see-through glass (.lg-slide-track in globals.css). Enabled,
        // the thumb and the stretch already slid take the theme's accent;
        // disabled, both go muted and the label says what unlocks it, so the
        // bar never reads as broken.
        "lg-slide-track relative h-11 w-full select-none overflow-hidden rounded-md border",
        disabled ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {!disabled ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-[2] rounded-md bg-primary/20",
            !dragging && "transition-[width] duration-200 ease-out",
          )}
          // Up to the thumb's trailing edge: 4px inset + the thumb itself.
          style={{ width: `calc(${offset}px + 2.75rem)` }}
        />
      ) : null}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-sm font-semibold transition-opacity"
        style={{ opacity: busy ? 1 : 1 - progress }}
      >
        {busy ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {busyLabel ?? label}
          </>
        ) : disabled && disabledLabel ? (
          disabledLabel
        ) : (
          label
        )}
      </span>
      <button
        ref={thumbRef}
        type="button"
        // While locked, say what unlocks it rather than naming an action that will not happen.
        aria-label={disabled && disabledLabel ? disabledLabel : actionLabel}
        disabled={disabled || busy}
        onClick={(event) => {
          // Only keyboard activation (Enter/Space, reported as detail 0)
          // confirms without a slide; a tap or mouse click has to drag.
          if (event.detail === 0 && !locked) confirm()
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={cn(
          "absolute top-1 bottom-1 left-1 z-[2] flex aspect-square touch-none items-center justify-center rounded-[calc(var(--radius-md)-2px)]",
          disabled ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
          !dragging && "transition-transform duration-200 ease-out",
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <ChevronsRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}

export { SlideToConfirm }
