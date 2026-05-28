import { Activity, CalendarDays, Flame, TrendingUp } from "lucide-react"
import { Suspense } from "react"

import { DashboardRefreshOnStale } from "@/components/dashboard/dashboard-refresh-on-stale"
import { NutritionSummary } from "@/components/dashboard/nutrition-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TodayWorkout } from "@/components/dashboard/today-workout"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchDashboard } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

type DashboardLocale = Awaited<ReturnType<typeof getServerLocale>>
type DashboardMessages = Awaited<ReturnType<typeof getServerMessages>>

type DashboardOverviewProps = {
  accessToken: string
  locale: DashboardLocale
  messages: DashboardMessages
  preferredWeightUnit?: "kg" | "lbs"
}

type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>

export const revalidate = 30

function startOfCurrentWeek(date: Date) {
  const value = new Date(date)
  const offset = (value.getDay() + 6) % 7

  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - offset)

  return value
}

function addLocalDays(date: Date, days: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function getWorkoutForDate(
  workouts: DashboardData["workouts"],
  schedule: DashboardData["schedule"],
  date: Date,
) {
  const oneOffWorkout = workouts.find((workout) => workout.scheduledDate && isSameCalendarDate(workout.scheduledDate, date))

  if (oneOffWorkout) {
    return oneOffWorkout
  }

  return schedule[date.getDay()] ?? null
}

function resolveNextWorkoutLabel(
  workouts: DashboardData["workouts"],
  schedule: DashboardData["schedule"],
  messages: DashboardMessages,
) {
  const today = new Date()

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addLocalDays(today, offset)
    const workout = getWorkoutForDate(workouts, schedule, date)

    if (!workout) {
      continue
    }

    if (offset === 0) {
      return {
        subtitle: workout.name,
        value: messages.common.today,
      }
    }

    if (offset === 1) {
      return {
        subtitle: workout.name,
        value: messages.dashboard.tomorrow,
      }
    }

    return {
      subtitle: workout.name,
      value: messages.dashboard.inDays(offset),
    }
  }

  return {
    subtitle: messages.dashboard.noWorkoutScheduled,
    value: messages.dashboard.rest,
  }
}

function countScheduledWorkoutsInWeek(
  workouts: DashboardData["workouts"],
  schedule: DashboardData["schedule"],
  weekStart: Date,
) {
  return Array.from({ length: 7 }, (_value, index) => getWorkoutForDate(workouts, schedule, addLocalDays(weekStart, index))).filter(Boolean)
    .length
}

async function DashboardOverview({ accessToken, locale, messages, preferredWeightUnit }: DashboardOverviewProps) {
  const dashboard = await fetchDashboard(accessToken)

  const isVietnamese = locale === "vi"
  const { activeDaysThisWeek, workoutsThisWeek, todayVolume } = dashboard.weekStats
  const weekStart = startOfCurrentWeek(new Date())
  const scheduledThisWeek = countScheduledWorkoutsInWeek(dashboard.workouts, dashboard.schedule, weekStart)
  const nextWorkout = resolveNextWorkoutLabel(dashboard.workouts, dashboard.schedule, messages)
  const volumeUnitLabel = preferredWeightUnit === "lbs" ? messages.dashboard.lbs : "kg"
  const statCards = [
    {
      helper: isVietnamese ? "active trong tuần này" : "active this week",
      helperTone: "accent",
      icon: Flame,
      label: messages.dashboard.weeklyStreak,
      tone: "primary",
      value: `${activeDaysThisWeek} ${isVietnamese ? "ngày" : "days"}`,
    },
    {
      helper: messages.dashboard.workoutsCompleted,
      icon: Activity,
      label: messages.dashboard.thisWeek,
      tone: "blue",
      value: `${workoutsThisWeek}/${scheduledThisWeek || 0}`,
    },
    {
      helper: `${volumeUnitLabel} ${messages.dashboard.loggedThisWeek}`,
      helperTone: "accent",
      icon: TrendingUp,
      label: messages.dashboard.totalVolume,
      tone: "neutral",
      value: todayVolume.toLocaleString(),
    },
    {
      helper: nextWorkout.subtitle,
      icon: CalendarDays,
      label: messages.dashboard.nextWorkout,
      tone: "neutral",
      value: nextWorkout.value,
    },
  ] as const

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const isHelperAccent = "helperTone" in card && card.helperTone === "accent"

          return (
            <div
              key={card.label}
              className={cn(
                "rounded-[10px] border p-4 transition-colors md:p-5",
                card.tone === "primary" && "border-primary/20 bg-primary/5",
                card.tone === "blue"    && "border-primary/20 bg-primary/5",
                card.tone === "neutral" && "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-micro mb-2">{card.label}</p>
                  <p className="font-mono text-2xl font-semibold leading-none tracking-tight tnum text-foreground md:text-[1.75rem]">
                    {card.value}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-[13px] leading-snug",
                      isHelperAccent
                        ? "font-medium text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {card.helper}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]",
                    card.tone === "primary" && "bg-primary/10 text-primary",
                    card.tone === "blue"    && "bg-primary/10 text-primary",
                    card.tone === "neutral" && "bg-muted text-muted-foreground",
                  )}
                >
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <TodayWorkout workout={dashboard.todayWorkout} />
        <NutritionSummary nutrition={dashboard.dailyNutrition} />
      </section>

      <RecentActivity logs={dashboard.recentLogs} />
    </>
  )
}

function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[10px] border border-border bg-card p-4 md:p-5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border border-border bg-card p-5">
          <Skeleton className="h-2.5 w-28 rounded" />
          <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center gap-4">
            <Skeleton className="h-14 w-14 rounded-[10px]" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-9 w-full rounded-[8px]" />
          </div>
        </div>

        <div className="rounded-[10px] border border-border bg-card p-5">
          <Skeleton className="h-2.5 w-32 rounded" />
          <div className="mt-6 flex items-center gap-6">
            <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
            <div className="space-y-3">
              <div><Skeleton className="h-2.5 w-16 rounded" /><Skeleton className="mt-1.5 h-7 w-24" /></div>
              <div><Skeleton className="h-2.5 w-16 rounded" /><Skeleton className="mt-1.5 h-6 w-20" /></div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 rounded-[8px]" />
            ))}
          </div>
        </div>
      </section>

      <section>
        <Skeleton className="mb-4 h-2.5 w-28 rounded" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[60px] rounded-[10px]" />
          ))}
        </div>
      </section>
    </div>
  )
}

export default async function DashboardPage() {
  const sessionPromise = requireAppSession({ role: "trainee" })
  const localePromise = getServerLocale()
  const messagesPromise = getServerMessages()

  const [{ accessToken, profile }, locale, messages] = await Promise.all([sessionPromise, localePromise, messagesPromise])

  const firstName = profile.name.split(" ")[0]
  const dashboardSubtitle =
    locale === "vi"
      ? "Theo dõi workout, dinh dưỡng và tiến độ ngay hôm nay trong một màn hình."
      : "Track today's training, nutrition, and progress from one dashboard."

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-10">
      <div className="space-y-6">
        <DashboardRefreshOnStale />

        <section>
          <span className="label-micro mb-2 block">Dashboard</span>
          <h1 className="text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {messages.dashboard.welcomeBack},{" "}
            <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{dashboardSubtitle}</p>
        </section>

        <QuickActions />

        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardOverview
            accessToken={accessToken}
            locale={locale}
            messages={messages}
            preferredWeightUnit={profile.preferredWeightUnit}
          />
        </Suspense>
      </div>
    </div>
  )
}
