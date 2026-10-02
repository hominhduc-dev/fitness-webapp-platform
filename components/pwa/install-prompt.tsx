"use client"

import { Copy, Download, EllipsisVertical, Compass, Smartphone } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { installMessages } from "@/lib/i18n/messages/install"
import { canInstallFrom, readInstallPlatform } from "@/lib/pwa/install-platform"
import { canShowInstallPrompt, snoozeInstallPrompt, stopAskingForInstallPrompt } from "@/lib/pwa/install-prompt-state"
import { scanActiveSessions } from "@/lib/workout/session-storage"

import { ANDROID_STEP_ICONS, type BeforeInstallPromptEvent, InstallSteps, IOS_STEP_ICONS } from "./install-guide"

/** Same as the push soft-ask: wait until the visit looks intentional. */
const ENGAGEMENT_DELAY_MS = 8_000
const WORKOUT_START_PATTERN = /^\/workout\/[^/]+\/start(\/|$)/

const subscribeNever = () => () => {}

/**
 * Asks a signed-in phone user who opened YeahBuddy in the browser to add it to
 * their Home Screen, with the steps for their device. Opened from the Home
 * Screen (or on a desktop) it never shows.
 */
export function InstallPrompt() {
  const { locale } = useLocale()
  const copy = installMessages[locale]
  const pathname = usePathname()
  const platform = useSyncExternalStore(subscribeNever, readInstallPlatform, () => null)
  const [armed, setArmed] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [copied, setCopied] = useState(false)

  const onWorkoutStart = pathname ? WORKOUT_START_PATTERN.test(pathname) : false
  const eligible = canInstallFrom(platform) && !onWorkoutStart

  useEffect(() => {
    const capture = (event: Event) => {
      // Keep Chrome's own mini-infobar away; the sheet offers the same prompt.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const installed = () => {
      stopAskingForInstallPrompt()
      setInstallEvent(null)
      setArmed(false)
    }
    window.addEventListener("beforeinstallprompt", capture)
    window.addEventListener("appinstalled", installed)
    return () => {
      window.removeEventListener("beforeinstallprompt", capture)
      window.removeEventListener("appinstalled", installed)
    }
  }, [])

  useEffect(() => {
    if (!eligible || !canShowInstallPrompt()) return

    const timer = setTimeout(() => {
      // An unfinished workout's resume card owns this moment.
      if (scanActiveSessions().length > 0) return
      setArmed(true)
    }, ENGAGEMENT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [eligible])

  const later = useCallback(() => {
    snoozeInstallPrompt()
    setArmed(false)
  }, [])

  const neverAgain = useCallback(() => {
    stopAskingForInstallPrompt()
    setArmed(false)
  }, [])

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice.catch(() => null)
    setInstallEvent(null)
    if (choice?.outcome === "accepted") neverAgain()
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Some in-app browsers block the clipboard; the address bar still works.
    }
  }

  if (!armed || !eligible) return null

  return (
    <BottomSheet ariaLabel={copy.prompt.title} onClose={later}>
      <BottomSheetHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Smartphone aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-6 text-foreground">{copy.prompt.title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{copy.prompt.body}</p>
          </div>
        </div>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-4">
        {platform === "in-app" ? (
          <>
            <p className="text-sm leading-6 text-foreground">{copy.inAppBody}</p>
            <InstallSteps icons={[EllipsisVertical, Compass]} steps={copy.inAppSteps} />
            <Button variant="outline" className="w-full" onClick={() => void copyLink()}>
              <Copy aria-hidden />
              {copied ? copy.copied : copy.copyLink}
            </Button>
          </>
        ) : platform === "android" ? (
          <>
            {installEvent ? (
              <Button size="lg" className="w-full" onClick={() => void install()}>
                <Download aria-hidden />
                {copy.androidButton}
              </Button>
            ) : null}
            <InstallSteps icons={ANDROID_STEP_ICONS} steps={copy.androidSteps} />
          </>
        ) : (
          <>
            {platform === "ios-other" ? (
              <p className="rounded-2xl border border-border bg-muted p-3 text-sm leading-6 text-foreground">{copy.iosOtherNote}</p>
            ) : null}
            {/* Step 1 ("open in Safari") is already true here, so the sheet starts at Share. */}
            <InstallSteps icons={IOS_STEP_ICONS.slice(1)} steps={copy.iosSteps.slice(1)} />
          </>
        )}

        <Link href="/install" onClick={later} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          {copy.prompt.fullGuide}
        </Link>
      </BottomSheetBody>

      <BottomSheetFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={neverAgain}>
          {copy.prompt.neverAgain}
        </Button>
        <Button className="w-full sm:w-auto" onClick={later}>
          {copy.prompt.later}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}
