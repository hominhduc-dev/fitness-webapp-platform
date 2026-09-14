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

export type WeekDayPlan = {
  /** A session was logged on this day. */
  completed: boolean
  /** The logged session if there is one, otherwise the scheduled workout. */
  workoutName: string | null
}

// Phones: a tall pill, since seven columns leave ~44px, too tight for three
// lines in a circle. From md up there is room for true circles.
const CIRCLE_CLASS_NAME =
  "flex h-16 w-full max-w-16 min-w-0 flex-col items-center justify-center gap-0.5 justify-self-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:aspect-square md:h-auto md:max-w-[4.5rem]"

/**
 * One row of day circles. The dot carries the day's status: trained (success),
 * planned (primary) or rest (muted). Planned days without a session stay
 * neutral rather than "missed". From md up a "This week" button leads the row.
 */
export function WeekStrip({ getDayPlan }: { getDayPlan: (date: Date) => WeekDayPlan }) {
  const { locale, messages } = useLocale()
  const copy = messages.dashboard
  const todayKey = useTodayKey()

  const thisWeekButton = (
    <Link
      href="/schedule"
      className="hidden h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
    >
      <CalendarDays className="size-4 text-primary" aria-hidden="true" />
      {copy.thisWeek}
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  )

  if (!todayKey) {
    return (
      <div className="flex items-center gap-4 lg:gap-6" aria-hidden="true">
        <Skeleton className="hidden h-11 w-32 shrink-0 rounded-xl md:block" />
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-1.5 md:gap-3">
          {Array.from({ length: 7 }, (_value, index) => (
            <Skeleton key={index} className="h-16 w-full max-w-16 justify-self-center rounded-full md:aspect-square md:h-auto md:max-w-[4.5rem]" />
          ))}
        </div>
      </div>
    )
  }

  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"

  return (
    <section className="flex items-center gap-4 lg:gap-6">
      {thisWeekButton}

      <nav aria-label={copy.thisWeekDays} className="grid min-w-0 flex-1 grid-cols-7 gap-1.5 md:gap-3">
        {mondayWeek(todayKey).map(({ date, isToday }) => {
          const plan = getDayPlan(date)

          return (
            <Link
              key={date.toISOString()}
              href="/schedule"
              aria-current={isToday ? "date" : undefined}
              title={plan.workoutName ?? copy.rest}
              className={cn(
                CIRCLE_CLASS_NAME,
                isToday
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_-12px_var(--primary)]"
                  : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-surface-hover",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  isToday
                    ? "bg-primary-foreground"
                    : plan.completed
                      ? "bg-success"
                      : plan.workoutName
                        ? "bg-primary"
                        : "bg-muted-foreground/35",
                )}
              />
              <span
                className={cn(
                  "truncate text-[11px] font-medium leading-none md:text-xs",
                  isToday ? "text-primary-foreground/85" : "text-muted-foreground",
                )}
              >
                {date.toLocaleDateString(dateLocale, { weekday: "short" })}
              </span>
              <span className="font-mono text-lg font-semibold leading-none tnum md:text-xl">{date.getDate()}</span>
            </Link>
          )
        })}
      </nav>
    </section>
  )
}
