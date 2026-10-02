"use client"

import Link from "next/link"
import {
  Bell,
  CircleCheck,
  Compass,
  Copy,
  Download,
  EllipsisVertical,
  MonitorSmartphone,
  Share,
  Smartphone,
  SquarePlus,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import type { InstallCopy } from "@/lib/i18n/messages/install"
import { readInstallPlatform, type InstallPlatform } from "@/lib/pwa/install-platform"
import { cn } from "@/lib/utils"

type Tab = "android" | "iphone"

/** Chrome's install prompt event; not in the DOM typings. */
export type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export const IOS_STEP_ICONS: LucideIcon[] = [Compass, Share, SquarePlus, CircleCheck, Smartphone]
export const ANDROID_STEP_ICONS: LucideIcon[] = [Compass, EllipsisVertical, Download, CircleCheck]
const BENEFIT_ICONS: LucideIcon[] = [Zap, MonitorSmartphone, Bell]

/** The device never changes while the page is open, so there is nothing to subscribe to. */
const subscribeNever = () => () => {}

export function InstallSteps({ icons, steps }: { icons: LucideIcon[]; steps: InstallCopy["iosSteps"] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const Icon = icons[index] ?? CircleCheck
        return (
          <li key={step.title} className="flex gap-4 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                {step.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Walks a visitor through adding YeahBuddy to their Home Screen. The server has
 * no device to read, so it renders the iPhone tab; the client then shows what
 * this device needs.
 */
export function InstallGuide({ copy }: { copy: InstallCopy }) {
  const detected = useSyncExternalStore(subscribeNever, readInstallPlatform, () => null)
  const [justInstalled, setJustInstalled] = useState(false)
  const [chosenTab, setChosenTab] = useState<Tab | null>(null)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [copied, setCopied] = useState(false)

  const platform: InstallPlatform | null = justInstalled ? "installed" : detected
  const androidDevice = detected === "android"
    || (detected === "in-app" && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent))
  const tab: Tab = chosenTab ?? (androidDevice ? "android" : "iphone")
  const setTab = setChosenTab

  useEffect(() => {
    const capture = (event: Event) => {
      // Keep Chrome's mini-infobar from showing; the button below offers the same prompt.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const installed = () => {
      setInstallEvent(null)
      setJustInstalled(true)
    }
    window.addEventListener("beforeinstallprompt", capture)
    window.addEventListener("appinstalled", installed)
    return () => {
      window.removeEventListener("beforeinstallprompt", capture)
      window.removeEventListener("appinstalled", installed)
    }
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Some in-app browsers block the clipboard; the URL bar is still there to copy by hand.
    }
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice.catch(() => undefined)
    setInstallEvent(null)
  }

  if (platform === "installed") {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <CircleCheck aria-hidden className="mx-auto size-10 text-primary" />
        <h2 className="mt-3 text-xl font-semibold">{copy.installedTitle}</h2>
        <p className="mt-2 text-muted-foreground">{copy.installedBody}</p>
        <Button asChild className="mt-5">
          <Link href="/">{copy.openApp}</Link>
        </Button>
      </section>
    )
  }

  const tabClass = (active: boolean) =>
    cn(
      "min-h-11 flex-1 rounded-lg px-4 text-sm font-medium transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    )

  return (
    <div className="space-y-8">
      {platform === "in-app" ? (
        <section className="space-y-4 rounded-2xl border border-primary/40 bg-primary/10 p-5" aria-live="polite">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{copy.inAppTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.inAppBody}</p>
          </div>
          <InstallSteps icons={[EllipsisVertical, Compass]} steps={copy.inAppSteps} />
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void copyLink()}>
            <Copy aria-hidden />
            {copied ? copy.copied : copy.copyLink}
          </Button>
        </section>
      ) : null}

      <section>
        <div role="tablist" aria-label={copy.title} className="flex gap-1 rounded-xl bg-muted p-1">
          <button type="button" role="tab" aria-selected={tab === "iphone"} className={tabClass(tab === "iphone")} onClick={() => setTab("iphone")}>
            {copy.tabIphone}
          </button>
          <button type="button" role="tab" aria-selected={tab === "android"} className={tabClass(tab === "android")} onClick={() => setTab("android")}>
            {copy.tabAndroid}
          </button>
        </div>

        <div role="tabpanel" className="mt-5 space-y-4">
          {tab === "iphone" ? (
            <>
              <h2 className="text-xl font-semibold">{copy.iosTitle}</h2>
              {platform === "ios-other" ? (
                <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
                  <p className="text-sm leading-6 text-foreground">{copy.iosOtherNote}</p>
                  <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                    <Copy aria-hidden />
                    {copied ? copy.copied : copy.copyLink}
                  </Button>
                </div>
              ) : null}
              <InstallSteps icons={IOS_STEP_ICONS} steps={copy.iosSteps} />
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">{copy.androidTitle}</h2>
              {installEvent ? (
                <Button size="lg" className="w-full sm:w-auto" onClick={() => void install()}>
                  <Download aria-hidden />
                  {copy.androidButton}
                </Button>
              ) : null}
              <InstallSteps icons={ANDROID_STEP_ICONS} steps={copy.androidSteps} />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{copy.benefitsTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {copy.benefits.map((benefit, index) => {
            const Icon = BENEFIT_ICONS[index] ?? Zap
            return (
              <div key={benefit.title} className="rounded-2xl border border-border bg-card p-4">
                <Icon aria-hidden className="size-5 text-primary" />
                <p className="mt-2 font-semibold">{benefit.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{benefit.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{copy.troubleshootingTitle}</h2>
        <div className="space-y-2">
          {copy.troubleshooting.map((item) => (
            <details key={item.question} className="group rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                {item.question}
              </summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
