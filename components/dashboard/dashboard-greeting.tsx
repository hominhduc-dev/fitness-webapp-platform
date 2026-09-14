"use client"

import Link from "next/link"
import { ChevronRight, Flame } from "lucide-react"
import { useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useVolumeRecovery } from "@/lib/queries/progress"

type DayPeriod = "morning" | "afternoon" | "evening"

const subscribeNever = () => () => {}

function currentDayPeriod(): DayPeriod {
  const hour = new Date().getHours()
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
}

/** The greeting follows the viewer's clock, so the server renders a neutral one. */
function useDayPeriod() {
  return useSyncExternalStore<DayPeriod | null>(subscribeNever, currentDayPeriod, () => null)
}

export function DashboardGreeting({ firstName }: { firstName: string }) {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const period = useDayPeriod()
  const recoveryQuery = useVolumeRecovery()
  const streakDays = recoveryQuery.data?.confidence.recoveryCheckIns ?? 0

  return (
    <section className="min-w-0">
      <div className="min-w-0 md:hidden">
        <p className="text-base leading-none text-muted-foreground">
          {period ? copy.greeting[period] : copy.welcomeBack},
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-4xl font-semibold leading-none tracking-tight text-foreground">
            {firstName}
          </h1>
          <Link
            href="/progress"
            className="inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full bg-primary-soft px-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Flame className="size-4 fill-primary/15" aria-hidden="true" />
            <span>{copy.dayStreak(streakDays)}</span>
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-2 text-base text-muted-foreground">{copy.motto}</p>
      </div>

      <div className="hidden items-start justify-between gap-4 md:flex">
        <div className="min-w-0 flex-1">
        <div className="hidden min-w-0 md:block">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            {period ? copy.greeting[period] : copy.welcomeBack}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.motto}</p>
        </div>

        </div>
      </div>
    </section>
  )
}
