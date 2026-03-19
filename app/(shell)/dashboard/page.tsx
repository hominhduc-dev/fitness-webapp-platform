import { Activity, CalendarDays, Flame, TrendingUp } from "lucide-react"
import { Suspense, cache } from "react"

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

const getDashboardData = cache(async (accessToken: string) => {
  const [workoutData, mealData] = await Promise.all([fetchWorkouts(accessToken), fetchMeals(accessToken)])

  return {
    mealData,
    workoutData,
  }
})

function startOfCurrentWeek(date: Date) {
  const value = new Date(date)
  const offset = (value.getDay() + 6) % 7

  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - offset)

  return value
}

function resolveNextWorkoutLabel(
  schedule: Awaited<ReturnType<typeof fetchWorkouts>>["schedule"],
  messages: DashboardMessages,
) {
  const today = new Date().getDay()

  for (let offset = 0; offset < 7; offset += 1) {
    const day = (today + offset) % 7
    const workout = schedule[day]

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

async function DashboardOverview({ accessToken, locale, messages, preferredWeightUnit }: DashboardOverviewProps) {
  const { workoutData, mealData } = await getDashboardData(accessToken)

  const isVietnamese = locale === "vi"
  const weekStart = startOfCurrentWeek(new Date())
  const workoutsThisWeek = workoutData.recentLogs.filter((log) => log.startedAt >= weekStart).length
  const scheduledThisWeek = Object.values(workoutData.schedule).filter(Boolean).length
  const completedDays = new Set(
    workoutData.recentLogs.filter((log) => log.startedAt >= weekStart).map((log) => log.startedAt.getDay()),
  )
  const activeDaysThisWeek = completedDays.size
  const totalVolume = workoutData.recentLogs
    .filter((log) => log.startedAt >= weekStart)
    .reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const nextWorkout = resolveNextWorkoutLabel(workoutData.schedule, messages)
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
      value: totalVolume.toLocaleString(),
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const isHelperAccent = "helperTone" in card && card.helperTone === "accent"

          return (
            <div
              key={card.label}
              className={cn(
                "rounded-[28px] border p-5 shadow-sm",
                card.tone === "primary" && "border-primary/18 bg-primary/5",
                card.tone === "blue" && "border-primary/18 bg-primary/6",
                card.tone === "neutral" && "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{card.value}</p>
                  <p
                    className={cn(
                      "mt-2 text-sm",
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
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    card.tone === "primary" && "bg-primary/10 text-primary",
                    card.tone === "blue" && "bg-primary/10 text-primary",
                    card.tone === "neutral" && "bg-muted text-muted-foreground",
                  )}
                >
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_470px]">
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-28" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_470px]">
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
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <div className="space-y-7">
        <section className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
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
