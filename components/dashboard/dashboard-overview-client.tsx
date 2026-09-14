"use client"

import { NutritionSummary } from "./nutrition-summary"
import { QuickActions } from "./quick-actions"
import { ReadinessCard } from "./readiness-card"
import { RecentActivity } from "./recent-activity"
import { TodayWorkout } from "./today-workout"
import { WeeklyProgressCard } from "./weekly-progress-card"
import { WeeklyVolumeCard } from "./weekly-volume-card"
import { useLocale } from "@/components/providers/locale-provider"
import { fetchDashboard } from "@/lib/fitness/api"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import type { AppMessages } from "@/lib/i18n/messages"
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
  const { messages } = useLocale()
  const { data: dashboard = initialData } = useUserQuery({
    queryKey: ["workouts", "dashboard"],
    queryFn: async () => fetchDashboard(await requireAccessToken()),
    initialData,
  })

  const { activeDaysThisWeek, workoutsThisWeek } = dashboard.weekStats
  const weekStart = startOfCurrentWeek(new Date())
  const scheduledThisWeek = countScheduledWorkoutsInWeek(dashboard.workouts, dashboard.schedule, weekStart)
  const nextWorkout = resolveNextWorkoutLabel(dashboard.workouts, dashboard.schedule, messages)
  const volumeUnitLabel = preferredWeightUnit === "lbs" ? messages.dashboard.lbs : "kg"
  return (
    <>
      <QuickActions />

      <section className="grid min-w-0 gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <TodayWorkout workout={dashboard.todayWorkout} />
        <ReadinessCard />
      </section>

      <section className="grid min-w-0 gap-4 md:grid-cols-[0.85fr_1.15fr]">
        <NutritionSummary nutrition={dashboard.dailyNutrition} />
        <WeeklyProgressCard
          activeDays={activeDaysThisWeek}
          completedWorkouts={workoutsThisWeek}
          nextWorkout={nextWorkout}
          scheduledWorkouts={scheduledThisWeek}
          volumeUnitLabel={volumeUnitLabel}
        />
      </section>

      <WeeklyVolumeCard />

      <RecentActivity logs={dashboard.recentLogs} />
    </>
  )
}
