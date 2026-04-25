import { Activity, CalendarDays, Flame, TrendingUp } from "lucide-react"
import { Suspense } from "react"

import { DashboardRefreshOnStale } from "@/components/dashboard/dashboard-refresh-on-stale"
import { NutritionSummary } from "@/components/dashboard/nutrition-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TodayWorkout } from "@/components/dashboard/today-workout"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchMeals, fetchWorkouts } from "@/lib/fitness/api"
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
  workouts: Awaited<ReturnType<typeof fetchWorkouts>>["workouts"],
  schedule: Awaited<ReturnType<typeof fetchWorkouts>>["schedule"],
  date: Date,
) {
  const oneOffWorkout = workouts.find((workout) => workout.scheduledDate && isSameCalendarDate(workout.scheduledDate, date))

  if (oneOffWorkout) {
    return oneOffWorkout
  }

  return schedule[date.getDay()] ?? null
}

function resolveNextWorkoutLabel(
  workouts: Awaited<ReturnType<typeof fetchWorkouts>>["workouts"],
  schedule: Awaited<ReturnType<typeof fetchWorkouts>>["schedule"],
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
  workouts: Awaited<ReturnType<typeof fetchWorkouts>>["workouts"],
  schedule: Awaited<ReturnType<typeof fetchWorkouts>>["schedule"],
  weekStart: Date,
) {
  return Array.from({ length: 7 }, (_value, index) => getWorkoutForDate(workouts, schedule, addLocalDays(weekStart, index))).filter(Boolean)
    .length
}

async function DashboardOverview({ accessToken, locale, messages, preferredWeightUnit }: DashboardOverviewProps) {
  const [workoutData, mealData] = await Promise.all([fetchWorkouts(accessToken), fetchMeals(accessToken)])

  const isVietnamese = locale === "vi"
  const { activeDaysThisWeek, workoutsThisWeek, todayVolume } = workoutData.weekStats
  const weekStart = startOfCurrentWeek(new Date())
  const scheduledThisWeek = countScheduledWorkoutsInWeek(workoutData.workouts, workoutData.schedule, weekStart)
  const nextWorkout = resolveNextWorkoutLabel(workoutData.workouts, workoutData.schedule, messages)
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
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const isHelperAccent = "helperTone" in card && card.helperTone === "accent"

          return (
            <div
              key={card.label}
              className={cn(
                "rounded-[24px] border p-4 shadow-sm md:rounded-[28px] md:p-5",
                card.tone === "primary" && "border-primary/18 bg-primary/5",
                card.tone === "blue" && "border-primary/18 bg-primary/6",
                card.tone === "neutral" && "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-black leading-none tracking-tight text-foreground md:mt-3 md:text-3xl">
                    {card.value}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-sm leading-snug md:leading-7",
                      isHelperAccent
                        ? "font-semibold text-emerald-600"
                        : card.tone === "primary"
                          ? "text-accent"
                          : "text-muted-foreground",
                    )}
                  >
                    {card.helper}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl md:h-10 md:w-10",
                    card.tone === "primary" && "bg-primary/10 text-primary",
                    card.tone === "blue" && "bg-primary/10 text-primary",
                    card.tone === "neutral" && "bg-muted text-muted-foreground",
                  )}
                >
                  <card.icon className="h-5 w-5 md:h-5 md:w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <TodayWorkout workout={workoutData.todayWorkout} />
        <NutritionSummary nutrition={mealData.dailyNutrition} />
      </section>

      <RecentActivity logs={workoutData.recentLogs} />
    </>
  )
}

function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[24px] border border-border bg-card p-4 shadow-sm md:rounded-[28px] md:p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-24 md:mt-3 md:h-9 md:w-28" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-8 w-40" />
          <div className="mt-8 flex min-h-[290px] flex-col items-center justify-center">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="mt-6 h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-48" />
            <Skeleton className="mt-6 h-12 w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-8 w-48" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-28 w-28 rounded-full" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
        <Skeleton className="h-8 w-44" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-[24px]" />
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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-6 md:space-y-7">
        <DashboardRefreshOnStale />

        <section className="space-y-2.5">
          <h1 className="text-2xl font-black leading-tight tracking-tight text-foreground md:text-3xl">
            {messages.dashboard.welcomeBack},{" "}
            <span className="text-primary">{firstName}</span>
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">{dashboardSubtitle}</p>
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
