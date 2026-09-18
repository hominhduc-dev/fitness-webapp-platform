"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { useSyncExternalStore } from "react"

import { NotificationBell } from "@/components/layout/notification-bell"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { fetchDashboard } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

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
      isToday: date.getTime() === current.getTime(),
      weekday: date.toLocaleDateString(locale, { weekday: "short" }),
    }
  })
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

  return (
    <section className="min-w-0">
      <div className="min-w-0 rounded-[1.75rem] bg-background px-3 pb-3 pt-[calc(0.35rem+env(safe-area-inset-top))] md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={messages.common.openNavigation}
              onClick={openMobileMoreMenu}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="size-14 border border-border bg-muted">
                {avatar ? <AvatarImage src={avatar} alt={fullName} className="object-cover" /> : null}
                <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                  {initials(fullName) || <User className="size-5" aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-tight text-foreground">
                {period ? copy.greeting[period] : copy.welcomeBack}, {firstName}
              </h1>
              <p className="mt-0.5 truncate text-sm leading-tight text-muted-foreground">{copy.motto}</p>
              <Link
                href="/progress"
                className="mt-2 inline-flex h-6 items-center rounded-full border border-primary/25 bg-primary-soft px-2.5 text-xs font-semibold text-primary"
              >
                {copy.weekStreak(streakWeeks)}
              </Link>
            </div>
          </div>
          <NotificationBell
            className="size-10 bg-transparent text-foreground hover:bg-muted/40 [&_svg]:size-6"
            side="bottom"
          />
        </div>

        <nav aria-label={copy.thisWeekDays} className="mt-7 grid grid-cols-7 gap-1.5">
          {(currentWeek ?? Array.from({ length: 7 }, () => null)).map((day, index) => (
            (() => {
              const entry = day
                ? scheduleEntries.find((item) =>
                    item.date.getFullYear() === day.date.getFullYear() &&
                    item.date.getMonth() === day.date.getMonth() &&
                    item.date.getDate() === day.date.getDate(),
                  )
                : undefined
              const hasPlan = Boolean(entry?.workout)
              const completed = Boolean(entry?.isCompleted)

              return (
                <Link
                  key={day ? day.date.toISOString() : index}
                  href="/schedule"
                  aria-current={day?.isToday ? "date" : undefined}
                  className={cn(
                    "relative flex min-h-[4.8rem] flex-col items-center justify-center gap-1.5 rounded-[1.15rem] border px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    day?.isToday
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_var(--primary)]"
                      : "border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground",
                  )}
                  title={entry?.workout?.name ?? copy.rest}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-1/2 top-2 size-1.5 -translate-x-1/2 rounded-full",
                      day?.isToday
                        ? "bg-primary-foreground"
                        : completed
                          ? "bg-success"
                          : hasPlan
                            ? "bg-primary"
                            : "bg-muted-foreground/35",
                    )}
                  />
                  <span className="text-sm font-medium leading-none">{day?.weekday ?? "\u00a0"}</span>
                  <span className="font-mono text-lg leading-none tnum">{day?.date.getDate() ?? "\u00a0"}</span>
                </Link>
              )
            })()
          ))}
        </nav>
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
