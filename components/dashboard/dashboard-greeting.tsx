"use client"

import Link from "next/link"
import { CircleCheck, User } from "lucide-react"
import { useSyncExternalStore } from "react"

import { NotificationBell } from "@/components/layout/notification-bell"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { fetchDashboard } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"
import { WeekDayCellContent, weekDayCellClass } from "@/components/layout/week-day-cell"
import { WEEK_STRIP_GRID_CLASS } from "@/components/layout/week-strip-layout"
import { inferRoutineTag, TAG_DOT_COLOR } from "@/lib/fitness/routine-tag"
import { shortWeekday } from "@/lib/i18n/weekday"

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

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
}

function useTodayKey() {
  return useSyncExternalStore<string | null>(subscribeNever, todayKey, () => null)
}

function mobileWeek(today: string | null, locale: string) {
  if (!today) return null

  const [year, month, day] = today.split("-").map(Number)
  const current = new Date(year, month - 1, day)
  const monday = new Date(current)
  monday.setDate(current.getDate() - ((current.getDay() + 6) % 7))

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return {
      date,
      isFuture: date.getTime() > current.getTime(),
      isToday: date.getTime() === current.getTime(),
      weekday: shortWeekday(date, locale),
    }
  })
}

type ScheduleEntry = Awaited<ReturnType<typeof fetchDashboard>>["scheduleEntries"][number]
type DayStatus = "done" | "missed" | "planned" | "rest"

/**
 * What a day of the week strip says: trained, planned but missed (a past day
 * whose session never got logged), planned, or rest.
 */
function dayStatus(entry: ScheduleEntry | undefined, day: { isFuture: boolean; isToday: boolean }): DayStatus {
  if (entry?.isCompleted) return "done"
  if (!entry?.workout) return "rest"
  if (entry.isMissed || (!day.isToday && !day.isFuture)) return "missed"
  return "planned"
}

/** ✓ trained, a dash for missed, a dot in the session's split colour for planned. */
function WorkoutDayIndicator({ entry, isToday, status }: { entry: ScheduleEntry | undefined; isToday: boolean; status: DayStatus | null }) {
  if (status === "done") {
    return <CircleCheck className={cn("size-4", isToday ? "text-primary-foreground" : "text-success-text")} strokeWidth={2.25} />
  }
  if (status === "missed") return <span className="h-0.5 w-3 rounded-full bg-muted-foreground/60" />
  if (status === "planned" && entry?.workout) {
    return (
      <span
        className="size-2 rounded-full"
        style={{ background: isToday ? "var(--primary-foreground)" : TAG_DOT_COLOR[inferRoutineTag(entry.workout)] }}
      />
    )
  }
  return null
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function openMobileMoreMenu() {
  window.dispatchEvent(new CustomEvent("yeahbuddy:open-mobile-more"))
}

export function DashboardGreeting({
  avatar,
  firstName,
  fullName,
  scheduleEntries,
  streakWeeks,
}: {
  avatar?: string | null
  firstName: string
  fullName: string
  scheduleEntries: Awaited<ReturnType<typeof fetchDashboard>>["scheduleEntries"]
  streakWeeks: number
}) {
  const { locale, messages } = useLocale()
  const copy = messages.dashboard
  const period = useDayPeriod()
  const currentWeek = mobileWeek(useTodayKey(), locale === "vi" ? "vi-VN" : "en-US")
  const entryFor = (date: Date) =>
    scheduleEntries.find(
      (item) =>
        item.date.getFullYear() === date.getFullYear() && item.date.getMonth() === date.getMonth() && item.date.getDate() === date.getDate(),
    )

  return (
    <section className="min-w-0">
      <div className="min-w-0 md:hidden">
        <div className="fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-2 bg-background px-2 pb-2 pt-[calc(0.45rem+env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex shrink-0 flex-col items-center">
              <button
                type="button"
                aria-label={messages.common.openNavigation}
                onClick={openMobileMoreMenu}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-11 border border-border bg-muted">
                  {avatar ? <AvatarImage src={avatar} alt={fullName} className="object-cover" /> : null}
                  <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                    {initials(fullName) || <User className="size-5" aria-hidden="true" />}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
            <div className="min-w-0 pt-1">
              <h1 className="truncate text-base font-semibold leading-tight text-foreground">
                {period ? copy.greeting[period] : copy.welcomeBack}, {firstName}!
              </h1>
              <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">{copy.motto}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/progress"
              className="inline-flex h-8 items-center rounded-full border border-primary/25 bg-primary-soft px-3 text-xs font-semibold leading-none text-primary"
            >
              {copy.weekStreak(streakWeeks)}
            </Link>
            <NotificationBell
              className="size-10 bg-transparent text-foreground hover:bg-muted/40 [&_svg]:size-6"
              side="bottom"
            />
          </div>
        </div>
        {/* Exactly the fixed bar's height (0.45rem top + 2.75rem avatar + 0.5rem
            bottom), so the strip below sits the same `pt-page` gap under the
            greeting as every other page's content sits under its title. */}
        <div aria-hidden="true" className="h-[calc(3.7rem+env(safe-area-inset-top))]" />

        <nav aria-label={copy.thisWeekDays} className={WEEK_STRIP_GRID_CLASS}>
          {(currentWeek ?? Array.from({ length: 7 }, () => null)).map((day, index) => {
            const entry = day ? entryFor(day.date) : undefined
            const status = day ? dayStatus(entry, day) : null
            const statusLabel =
              status === "done" ? copy.dayDone : status === "missed" ? copy.dayMissed : status === "planned" ? copy.dayPlanned : copy.rest

            return (
              <Link
                key={day ? day.date.toISOString() : index}
                href="/schedule"
                aria-current={day?.isToday ? "date" : undefined}
                aria-label={day ? `${day.weekday} ${day.date.getDate()}, ${statusLabel}${entry?.workout ? `: ${entry.workout.name}` : ""}` : undefined}
                title={entry?.workout?.name ?? copy.rest}
                className={weekDayCellClass({ future: Boolean(day?.isFuture), isToday: Boolean(day?.isToday) })}
              >
                <WeekDayCellContent
                  weekday={day?.weekday ?? null}
                  date={day?.date.getDate() ?? null}
                  isToday={Boolean(day?.isToday)}
                  indicator={<WorkoutDayIndicator entry={entry} isToday={Boolean(day?.isToday)} status={status} />}
                />
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="hidden items-start justify-between gap-4 md:flex">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            {period ? copy.greeting[period] : copy.welcomeBack}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.motto}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <Link
            href="/progress"
            className="inline-flex h-8 items-center rounded-full border border-primary/25 bg-primary-soft px-4 text-sm font-semibold leading-none text-primary transition-colors hover:bg-primary/15"
          >
            {copy.weekStreak(streakWeeks)}
          </Link>
        </div>
      </div>
    </section>
  )
}
