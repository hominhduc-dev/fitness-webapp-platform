"use client"

import { Check, Plus, SkipForward } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export type RestEvent = {
  exercise: string
  set: { id: string; kg: number; reps: number | null }
} | null

interface RestTimerProps {
  event: RestEvent
  onDismiss: () => void
  defaultDuration?: number
}

export function RestTimer({ event, onDismiss, defaultDuration = 90 }: RestTimerProps) {
  const [remaining, setRemaining] = useState(defaultDuration)
  const [visible, setVisible] = useState(true)
  const startedRef = useRef(Date.now())
  const totalRef = useRef(defaultDuration)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset and start whenever a new event fires
  useEffect(() => {
    if (!event) return

    const duration = defaultDuration
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
        "fixed z-50 pointer-events-auto",
        // Desktop: offset left by sidebar width (280px)
        "left-3 right-3 bottom-20",
        "md:left-[280px] md:right-10 md:bottom-6",
        "transition-opacity duration-[400ms]",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 md:gap-5",
          "rounded-xl border border-border",
          "bg-background/90 backdrop-blur-xl",
          "px-3 py-3 md:px-5 md:py-[14px]",
          "shadow-[0_16px_48px_-12px_rgba(13,13,11,0.18),0_2px_6px_rgba(13,13,11,0.06)]",
          "flex-wrap md:flex-nowrap",
        )}
      >
        {/* Left: label + countdown */}
        <div className="min-w-[90px] md:min-w-[110px] shrink-0">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-[2px]">
            Rest
          </div>
          <div
            className="font-mono text-[26px] md:text-[30px] font-semibold text-primary leading-none"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {String(mins)}:{String(secs).padStart(2, "0")}
          </div>
        </div>

        {/* Middle: progress bar + caption */}
        <div
          className={cn(
            "flex-1 min-w-0",
            // On mobile, force to its own row after left+right sections
            "order-3 md:order-none w-full md:w-auto",
          )}
        >
          {/* Progress track */}
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Caption */}
          <p className="mt-2 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            After:{" "}
            <span className="text-foreground">
              {event.exercise}
            </span>
            {event.set && (
              <>
                {" · "}
                <span style={{ fontFeatureSettings: '"tnum" 1' }} className="font-mono">
                  {event.set.kg} kg × {event.set.reps ?? "—"}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={handleAddTime}
            aria-label="Add 30 seconds"
            className={cn(
              "flex items-center gap-1 rounded-md border border-border",
              "px-3 py-1.5 text-[13px] font-medium text-foreground",
              "bg-transparent hover:bg-muted transition-colors duration-150",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            30 s
          </button>
          <button
            onClick={handleSkip}
            aria-label="Skip rest"
            className={cn(
              "flex items-center gap-1 rounded-md",
              "px-3 py-1.5 text-[13px] font-medium",
              "bg-transparent text-destructive hover:bg-destructive/10 transition-colors duration-150",
            )}
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
