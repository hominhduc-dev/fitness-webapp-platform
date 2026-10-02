"use client"

import { Bell } from "lucide-react"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/lib/push-notifications"
import { canShowPushPrompt, snoozePushPrompt, stopAskingForPushPrompt } from "@/lib/pwa/push-prompt-state"
import { cn } from "@/lib/utils"
import { scanActiveSessions } from "@/lib/workout/session-storage"

/**
 * Browsers mute — and Safari ignores — a permission dialog fired on page load, so
 * the soft-ask waits until the visit looks intentional.
 */
const ENGAGEMENT_DELAY_MS = 8_000
const WORKOUT_START_PATTERN = /^\/workout\/[^/]+\/start(\/|$)/

/**
 * Soft-ask for Web Push. The native dialog can only open from a user gesture, so
 * this banner supplies the gesture and the reason, which keeps the one-shot native
 * prompt for people who already said yes here.
 *
 * On iOS, Safari exposes Web Push only to Home Screen web apps, so outside one
 * this stays hidden and InstallPrompt asks the user to install first.
 */
export function PushPermissionPrompt() {
  const { messages } = useLocale()
  const copy = messages.pushPrompt
  const { toast } = useToast()
  const pathname = usePathname()
  const { session } = useAuth()
  const { enabled, isBusy, state, subscribe } = usePushNotifications()
  const [armed, setArmed] = useState(false)
  const resubscribed = useRef(false)

  const signedIn = Boolean(session?.access_token)

  // Permission already granted but no endpoint on this device (reinstall, cleared
  // site data, a subscription the browser rotated). Re-subscribing shows no dialog,
  // so there is nothing to ask about — just restore it.
  useEffect(() => {
    if (!signedIn || enabled || state !== "granted" || resubscribed.current) return
    resubscribed.current = true
    void subscribe().catch(() => undefined)
  }, [enabled, signedIn, state, subscribe])

  // On iOS outside the Home Screen there is nothing to ask yet: InstallPrompt
  // walks the user through installing first, then this asks for permission.
  const askable = state === "disabled"
  const onWorkoutStart = pathname ? WORKOUT_START_PATTERN.test(pathname) : false
  const eligible = signedIn && askable && !onWorkoutStart

  useEffect(() => {
    if (!eligible || !canShowPushPrompt()) return

    const timer = setTimeout(() => {
      // The resume-workout chip owns this lane and outranks a soft-ask.
      if (scanActiveSessions().length > 0) return
      setArmed(true)
    }, ENGAGEMENT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [eligible])

  // Derived rather than stored, so anything that settles the question elsewhere
  // (permission granted in another tab, a workout started) retires the banner.
  const open = armed && eligible

  const handleDismiss = useCallback(() => {
    snoozePushPrompt()
    setArmed(false)
  }, [])

  const handleEnable = useCallback(async () => {
    try {
      await subscribe()
      stopAskingForPushPrompt()
      setArmed(false)
      toast({ title: messages.profile.pushNotificationsEnabled, tone: "success" })
    } catch (error) {
      // A block is final for this origin — asking again would be noise.
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        stopAskingForPushPrompt()
      } else {
        snoozePushPrompt()
      }
      setArmed(false)
      toast({
        title: error instanceof Error ? error.message : messages.profile.pushNotificationError,
        tone: "error",
      })
    }
  }, [messages.profile.pushNotificationError, messages.profile.pushNotificationsEnabled, subscribe, toast])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label={copy.title}
      className={cn(
        "fixed z-40 pointer-events-auto",
        "bottom-[calc(var(--mobile-nav-offset)+4.25rem)] left-1/2 w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2",
        "md:left-[280px] md:w-[360px] md:max-w-none md:translate-x-0 md:bottom-6",
      )}
    >
      <div
        className={cn(
          "glass-frost flex flex-col gap-3 rounded-3xl border px-4 py-3.5 md:rounded-xl",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-foreground">
              {copy.title}
            </p>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">
              {copy.body}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={isBusy}>
            {copy.dismiss}
          </Button>
          <Button size="sm" onClick={() => void handleEnable()} disabled={isBusy}>
            {isBusy ? messages.common.loading : copy.enable}
          </Button>
        </div>
      </div>
    </div>
  )
}
