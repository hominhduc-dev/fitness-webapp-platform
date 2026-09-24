"use client"

import { Plus, SkipForward } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

export type RestEvent = {
  duration?: number
  exercise: string
  set: { id: string; kg: number | null; reps: number | null }
} | null

interface RestTimerProps {
  event: RestEvent
  onDismiss: () => void
  defaultDuration?: number
}

export function RestTimer({ event, onDismiss, defaultDuration = 90 }: RestTimerProps) {
  const { messages } = useLocale()
  const [remaining, setRemaining] = useState(defaultDuration)
  const [visible, setVisible] = useState(true)
  const startedRef = useRef(Date.now())
  const totalRef = useRef(defaultDuration)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset and start whenever a new event fires
  useEffect(() => {
    if (!event) return

    const duration = event.duration ?? defaultDuration
    totalRef.current = duration
    startedRef.current = Date.now()
    setRemaining(duration)
    setVisible(true)

    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedRef.current) / 1000
      const r = Math.max(0, totalRef.current - elapsed)
      setRemaining(r)

      if (r <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setTimeout(() => {
          setVisible(false)
          setTimeout(onDismiss, 400)
        }, 0)
      }
    }, 100)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.exercise, event?.set?.id])

  const handleAddTime = () => {
    totalRef.current = remaining + 30
    startedRef.current = Date.now()
    setRemaining((r) => r + 30)
  }

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setVisible(false)
    setTimeout(onDismiss, 400)
  }

  const mins = Math.floor(remaining / 60)
  const secs = Math.floor(remaining % 60)
  const pct = totalRef.current > 0 ? (remaining / totalRef.current) * 100 : 0

  if (!event) return null

  return (
    <div
      className={cn(
        "workout-floating-chip fixed z-50 pointer-events-auto",
        // Sits just above the session's pinned Finish button and matches its
        // width. Desktop: offset left by sidebar width (280px).
        "bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-1.5rem)] max-w-[420px] -translate-x-1/2",
        "md:left-[280px] md:right-10 md:w-auto md:max-w-none md:translate-x-0 md:bottom-[4rem]",
        "transition-opacity duration-[400ms]",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 md:gap-4",
          "rounded-xl border border-border",
          "bg-background/90 backdrop-blur-xl",
          "px-3 py-2 md:px-4 md:py-2.5",
          "shadow-[var(--glass-shadow)]",
        )}
      >
        {/* Countdown */}
        <div className="shrink-0">
          <div className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
            {messages.workoutPage.rest}
          </div>
          <div className="font-mono text-2xl font-semibold leading-none text-primary tnum md:text-3xl">
            {String(mins)}:{String(secs).padStart(2, "0")}
          </div>
        </div>

        {/* Progress bar + what was just logged */}
        <div className="min-w-0 flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {messages.workoutPage.after}{" "}
            <span className="text-foreground">{event.exercise}</span>
            {event.set && (
              <>
                {" · "}
                <span className="font-mono">
                  {event.set.kg ?? "—"} kg × {event.set.reps ?? "—"}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={handleAddTime}
            aria-label={messages.workoutPage.add30Seconds}
            className={cn(
              "flex h-9 items-center gap-0.5 rounded-md border border-border px-2 text-xs font-medium text-foreground",
              "bg-transparent transition-colors duration-150 hover:bg-muted",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            30s
          </button>
          {/* Icon-only on phones; the label comes back where there is room. */}
          <button
            onClick={handleSkip}
            aria-label={messages.workoutPage.skipRest}
            title={messages.workoutPage.skipRest}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium",
              "bg-transparent text-destructive-text transition-colors duration-150 hover:bg-destructive-soft",
            )}
          >
            <SkipForward className="h-4 w-4" />
            <span className="hidden md:inline">{messages.workoutPage.skip}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
