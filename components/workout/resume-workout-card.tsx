"use client"

import { Play, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"
import {
  type ActiveWorkoutSession,
  WORKOUT_SESSION_STORAGE_PREFIX,
  clearStoredWorkoutSession,
  scanActiveSessions,
} from "@/lib/workout/session-storage"

const START_PATH_PATTERN = /^\/workout\/[^/]+\/start(\/|$)/

function formatElapsed(startedAt: string, now: number): string {
  const startMs = Date.parse(startedAt)
  if (!Number.isFinite(startMs)) return "0:00"
  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000))
  const hours = Math.floor(elapsed / 3600)
  const mins = Math.floor((elapsed % 3600) / 60)
  const secs = elapsed % 60
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function formatStartedAgo(startedAt: string, now: number): string {
  const startMs = Date.parse(startedAt)
  if (!Number.isFinite(startMs)) return ""
  const seconds = Math.max(0, Math.floor((now - startMs) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remMins = minutes % 60
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
}

export function ResumeWorkoutCard() {
  const { messages } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [visible, setVisible] = useState(false)

  const refresh = useCallback(() => {
    const sessions = scanActiveSessions()
    setSession(sessions[0] ?? null)
  }, [])

  // Rescan on mount and whenever the route changes (e.g. after leaving /start)
  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  // Cross-tab sync: rescan when any workout-session key changes
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(`${WORKOUT_SESSION_STORAGE_PREFIX}:`)) {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const onStartPage = pathname ? START_PATH_PATTERN.test(pathname) : false
  const shouldShow = !!session && !onStartPage

  // Drive the fade transition
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      return
    }
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shouldShow])

  // Tick the elapsed timer every second while visible
  useEffect(() => {
    if (!shouldShow) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [shouldShow])

  if (!session || onStartPage) return null

  const handleResume = () => {
    router.push(`/workout/${session.workoutId}/start`)
  }

  const handleDiscard = () => {
    clearStoredWorkoutSession(session.workoutId)
    setVisible(false)
    setSession(null)
  }

  const name = session.workoutName?.trim() || messages.workoutPage.workoutInProgress
  const elapsed = formatElapsed(session.startedAt, now)
  const startedAgo = formatStartedAgo(session.startedAt, now)

  return (
    <div
      className={cn(
        "workout-floating-chip fixed z-40 pointer-events-auto",
        "left-3 right-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))]",
        "md:left-[280px] md:right-24 md:bottom-6",
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
        {/* Left: label + workout name */}
        <div className="min-w-0 flex-1 md:flex-none md:min-w-[160px] md:max-w-[240px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-[2px]">
            {messages.workoutPage.inProgress}
          </div>
          <div className="text-[15px] md:text-[16px] font-semibold text-foreground leading-tight truncate">
            {name}
          </div>
        </div>

        {/* Middle: elapsed + caption */}
        <div
          className={cn(
            "min-w-0",
            "order-3 md:order-none w-full md:w-auto md:flex-1",
          )}
        >
          <div
            className="font-mono text-[22px] md:text-[24px] font-semibold text-primary leading-none"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {elapsed}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            <span style={{ fontFeatureSettings: '"tnum" 1' }} className="font-mono">
              {messages.workoutPage.setsProgress(session.completedSets, session.totalSets)}
            </span>
            {startedAgo && (
              <>
                {" · "}
                {messages.workoutPage.startedAgo(startedAgo)}
              </>
            )}
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={handleResume}
            aria-label={messages.workoutPage.resume}
            className={cn(
              "flex items-center gap-1 rounded-md",
              "px-3 py-1.5 text-[13px] font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            {messages.workoutPage.resume}
          </button>
          <button
            onClick={handleDiscard}
            aria-label={messages.workoutPage.discard}
            className={cn(
              "flex items-center gap-1 rounded-md",
              "px-3 py-1.5 text-[13px] font-medium",
              "bg-transparent text-destructive hover:bg-destructive-soft transition-colors duration-150",
            )}
          >
            <X className="h-3.5 w-3.5" />
            {messages.workoutPage.discard}
          </button>
        </div>
      </div>
    </div>
  )
}
