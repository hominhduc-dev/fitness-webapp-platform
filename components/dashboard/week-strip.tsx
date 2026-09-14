"use client"

import Link from "next/link"
import { CalendarDays, Check, ChevronRight } from "lucide-react"
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

export type WeekDayPlan = {
  /** A session was logged on this day. */
  completed: boolean
  /** The logged session if there is one, otherwise the scheduled workout. */
  workoutName: string | null
}

/**
 * Phones get compact date pills. Wider screens have room for the week itself,
 * so each day becomes a card with its workout and whether it was trained.
 * Days that were planned but not trained stay neutral rather than "missed".
 */
export function WeekStrip({
  getDayPlan,
  summary,
}: {
  getDayPlan: (date: Date) => WeekDayPlan
  summary: { completed: number; scheduled: number }
}) {
  const { locale, messages } = useLocale()
  const copy = messages.dashboard
  const todayKey = useTodayKey()

  if (!todayKey) {
    return (
      <div aria-hidden="true">
        <div className="grid grid-cols-7 gap-1.5 md:hidden">
          {Array.from({ length: 7 }, (_value, index) => (
            <Skeleton key={index} className="h-16 w-full max-w-16 justify-self-center rounded-full" />
          ))}
        </div>
        <Skeleton className="hidden h-[9.25rem] rounded-2xl md:block" />
      </div>
    )
  }

  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const days = mondayWeek(todayKey).map((day) => ({ ...day, plan: getDayPlan(day.date) }))

  return (
    <section>
      {/* Phones: compact date pills. */}
      <nav aria-label={copy.thisWeekDays} className="grid grid-cols-7 gap-1.5 md:hidden">
        {days.map(({ date, isToday, plan }) => (
          <Link
            key={date.toISOString()}
            href="/schedule"
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "flex h-16 w-full max-w-16 min-w-0 flex-col items-center justify-center gap-1 justify-self-center rounded-full border px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isToday
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-surface-hover",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                plan.workoutName || plan.completed
                  ? isToday ? "bg-primary-foreground" : "bg-primary"
                  : "bg-muted-foreground/35",
              )}
            />
            <span className={cn("truncate text-[11px] font-medium leading-none", isToday ? "text-primary-foreground/85" : "text-muted-foreground")}>
              {date.toLocaleDateString(dateLocale, { weekday: "short" })}
            </span>
            <span className="font-mono text-lg font-semibold leading-none tnum">{date.getDate()}</span>
          </Link>
        ))}
      </nav>

      {/* Wider screens: one card, a column per day with its workout. */}
      <div className="hidden rounded-2xl border border-border bg-card p-3 md:block lg:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">{copy.thisWeek}</h2>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-xs font-medium tnum text-primary">
              {copy.weekSessions(summary.completed, summary.scheduled)}
            </span>
          </div>
          <Link href="/schedule" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
            {copy.schedule}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <nav aria-label={copy.thisWeekDays} className="grid grid-cols-7 gap-2">
          {days.map(({ date, isToday, plan }) => {
            const isRest = !plan.workoutName

            return (
              <Link
                key={date.toISOString()}
                href="/schedule"
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex min-h-[6.25rem] min-w-0 flex-col rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3",
                  isToday
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-surface-subtle text-foreground hover:border-primary/30 hover:bg-surface-hover",
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className={cn("truncate text-[11px] font-medium uppercase tracking-wide", isToday ? "text-primary-foreground/85" : "text-muted-foreground")}>
                    {date.toLocaleDateString(dateLocale, { weekday: "short" })}
                  </span>
                  <span className="font-mono text-lg font-semibold leading-none tnum">{date.getDate()}</span>
                </div>

                <p
                  title={plan.workoutName ?? copy.rest}
                  className={cn(
                    "mt-1.5 line-clamp-2 text-xs font-medium leading-snug",
                    isToday ? "text-primary-foreground" : isRest ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {plan.workoutName ?? copy.rest}
                </p>

                {plan.completed ? (
                  <span
                    className={cn(
                      "mt-auto inline-flex items-center gap-1 pt-1.5 text-[11px] font-medium",
                      isToday ? "text-primary-foreground" : "text-success-text",
                    )}
                  >
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                    {copy.dayDone}
                  </span>
                ) : isToday ? (
                  <span className="mt-auto pt-1.5 text-[11px] font-medium text-primary-foreground/85">{messages.common.today}</span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
