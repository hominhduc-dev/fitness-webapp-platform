"use client"

import Link from "next/link"
import { CalendarDays, ChevronRight } from "lucide-react"
import { useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const subscribeNever = () => () => {}

function localDateKey() {
  const today = new Date()
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
}

/**
 * Today's local date as a stable string. The server snapshot is null so the
 * markup never bakes in the server's timezone.
 */
function useTodayKey() {
  return useSyncExternalStore<string | null>(subscribeNever, localDateKey, () => null)
}

function mondayWeek(todayKey: string) {
  const [year, month, day] = todayKey.split("-").map(Number)
  const today = new Date(year, month - 1, day)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { date, isToday: date.getTime() === today.getTime() }
  })
}

export function WeekStrip({ hasWorkoutOn }: { hasWorkoutOn: (date: Date) => boolean }) {
  const { locale, messages } = useLocale()
  const todayKey = useTodayKey()

  if (!todayKey) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="hidden items-center justify-between md:flex">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-3">
          {Array.from({ length: 7 }, (_value, index) => (
            <Skeleton key={index} className="h-16 w-full max-w-16 justify-self-center rounded-full md:h-[4.75rem]" />
          ))}
        </div>
      </div>
    )
  }

  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  return (
    <section className="space-y-2">
      <div className="hidden items-center justify-between md:flex">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{messages.dashboard.thisWeek}</h2>
        </div>
        <Link href="/schedule" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {messages.dashboard.schedule}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <nav
        aria-label={messages.dashboard.thisWeekDays}
        className="grid grid-cols-7 gap-1.5 md:gap-3"
      >
        {mondayWeek(todayKey).map(({ date, isToday }) => (
          <Link
            key={date.toISOString()}
            href="/schedule"
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "flex h-16 w-full max-w-16 min-w-0 flex-col items-center justify-center gap-1 justify-self-center rounded-full border px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-[4.75rem] md:px-2 md:py-2",
              isToday
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-surface-hover",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                hasWorkoutOn(date) ? (isToday ? "bg-primary-foreground" : "bg-primary") : "bg-muted-foreground/35",
              )}
            />
            <span className={cn("truncate text-[11px] font-medium leading-none md:text-xs", isToday ? "text-primary-foreground/85" : "text-muted-foreground")}>
              {date.toLocaleDateString(dateLocale, { weekday: "short" })}
            </span>
            <span className="font-mono text-lg font-semibold leading-none tnum md:text-xl">{date.getDate()}</span>
          </Link>
        ))}
      </nav>
    </section>
  )
}
