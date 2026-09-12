"use client"

import { Activity, CalendarDays, Flame, TrendingUp } from "lucide-react"
import { NutritionSummary } from "./nutrition-summary"
import { QuickActions } from "./quick-actions"
import { RecentActivity } from "./recent-activity"
import { TodayWorkout } from "./today-workout"
import { useLocale } from "@/components/providers/locale-provider"
import { fetchDashboard } from "@/lib/fitness/api"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
type DashboardMessages = AppMessages
type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>

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

export function DashboardOverviewClient({ initialData, preferredWeightUnit }: { initialData: DashboardData; preferredWeightUnit?: "kg" | "lbs" }) {
  const { locale, messages } = useLocale()
  const { data: dashboard = initialData } = useUserQuery({
    queryKey: ["workouts", "dashboard"],
    queryFn: async () => fetchDashboard(await requireAccessToken()),
    initialData,
  })

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
      <QuickActions />

      <section className="grid min-w-0 gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <TodayWorkout workout={dashboard.todayWorkout} />
        <NutritionSummary nutrition={dashboard.dailyNutrition} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((card) => {
          const isHelperAccent = "helperTone" in card && card.helperTone === "accent"

          return (
            <div
              key={card.label}
              className={cn(
                "glass-card min-w-0 rounded-3xl border p-4 transition-all md:p-5",
                card.tone === "primary" && "border-primary/20 bg-primary-soft",
                card.tone === "blue" && "border-primary/20 bg-primary-soft",
                card.tone === "neutral" && "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="label-micro mb-2">{card.label}</p>
                  <p className="font-mono text-2xl font-semibold leading-none tracking-tight tnum text-foreground md:text-3xl">
                    {card.value}
                  </p>
                  <p className={cn("mt-2 text-sm leading-snug", isHelperAccent ? "font-medium text-success-text" : "text-muted-foreground")}>
                    {card.helper}
                  </p>
                </div>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", card.tone === "neutral" ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary")}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <RecentActivity logs={dashboard.recentLogs} />
    </>
  )
}


