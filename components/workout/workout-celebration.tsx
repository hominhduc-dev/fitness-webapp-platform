"use client"

import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { ShareStatsDialog } from "@/components/share/share-stats-dialog"
import { buildWorkoutShareCard, type WorkoutShareSummary } from "@/lib/share/stats-card"
import { consumeWorkoutCelebration, prefersReducedMotion } from "@/lib/workout/celebration"

/**
 * Spends the flag the workout session left behind and celebrates the finish.
 *
 * The confetti paints to its own canvas and the wording goes through the toast
 * the rest of the app already uses; what it renders is the share card for the
 * session, offered while the finish is still fresh.
 */

/** Brand first, then the two chart hues, so the burst reads as ours in any palette. */
const CONFETTI_COLORS = ["--primary", "--chart-2", "--chart-4", "--success"]

function resolveColors() {
  const styles = getComputedStyle(document.documentElement)

  return CONFETTI_COLORS.map((token) => styles.getPropertyValue(token).trim()).filter(
    // A token that resolves to a colour space canvas-confetti cannot parse
    // would throw mid-burst, so only plain hex survives the filter.
    (value) => /^#[0-9a-f]{3,8}$/i.test(value),
  )
}

export function WorkoutCelebration() {
  const { locale, messages } = useLocale()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [share, setShare] = useState<{ savedOnline: boolean; summary: WorkoutShareSummary } | null>(null)
  // Strict Mode mounts effects twice in development; without this the flag is
  // already spent by the second pass, but the guard keeps the intent explicit.
  const spent = useRef(false)

  useEffect(() => {
    if (spent.current) return
    spent.current = true

    const celebration = consumeWorkoutCelebration()
    if (!celebration) return
    // A session with nothing logged makes a card of zeros, not worth offering.
    // The sheet then carries the news itself: a toast would sit on its buttons.
    if (celebration.share && celebration.share.completedSets > 0) {
      setShare({ savedOnline: celebration.savedOnline, summary: celebration.share })
    } else {
      toast({
        description: celebration.savedOnline
          ? celebration.workoutName
          : messages.workoutPage.celebrationQueued,
        title: messages.workoutPage.celebrationTitle,
        // Wears the palette, like the confetti beside it and the done blocks the
        // trainee just filled in.
        tone: "celebration",
      })
    }

    if (prefersReducedMotion()) return

    // No cancellation guard, deliberately. An earlier version aborted the
    // import when the effect was cleaned up, which meant Strict Mode's
    // mount/unmount/mount in development cancelled the only run that the
    // `spent` ref would ever allow — the confetti worked in production and was
    // silently dead in dev. Nothing here writes component state after the
    // await; confetti paints to its own global canvas, so a late burst is
    // harmless and the ref above is what keeps it to one.
    void (async () => {
      try {
        // Kept out of the dashboard's bundle: a trainee who does not finish a
        // session today never downloads it.
        const { default: confetti } = await import("canvas-confetti")

        const colors = resolveColors()
        const burst = (particleCount: number, originX: number) =>
          confetti({
            angle: originX < 0.5 ? 60 : 120,
            colors: colors.length > 0 ? colors : undefined,
            disableForReducedMotion: true,
            origin: { x: originX, y: 0.7 },
            particleCount,
            spread: 65,
            startVelocity: 42,
            // Above the mobile nav (z-50) and the toast layer.
            zIndex: 60,
          })

        // Two corners rather than one middle burst: it reads as a celebration
        // instead of an error spray, and leaves the centre of the screen clear
        // so the toast underneath stays readable.
        burst(70, 0.15)
        burst(70, 0.85)
      } catch {
        // The toast already carried the news; a missing chunk is not worth an error.
      }
    })()
  }, [messages, toast])

  if (!share) return null

  const copy = messages.workoutPage.shareWorkout
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  return (
    <ShareStatsDialog
      data={buildWorkoutShareCard({
        athleteName: profile?.name,
        copy: { ...copy, anonymousAthlete: messages.progressPage.share.anonymousAthlete },
        localeCode,
        stamp: new Date().toLocaleDateString(localeCode, { day: "numeric", month: "short", year: "numeric" }),
        summary: share.summary,
        weightUnit: profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg",
      })}
      fileNamePrefix="yeahbuddy-workout"
      onClose={() => setShare(null)}
      shareText={copy.shareText(share.summary.workoutName)}
      shareTitle={copy.title}
      subtitle={share.savedOnline ? copy.subtitle : messages.workoutPage.celebrationQueued}
      title={messages.workoutPage.celebrationTitle}
    />
  )
}
