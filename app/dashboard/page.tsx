import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { NutritionSummary } from "@/components/dashboard/nutrition-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { StatsCard } from "@/components/dashboard/stats-card"
import { TodayWorkout } from "@/components/dashboard/today-workout"
import { requireAppSession } from "@/lib/auth/server"
import { fetchMeals, fetchWorkouts } from "@/lib/fitness/api"
import { getServerMessages, getServerLocale } from "@/lib/i18n/server"

function startOfWeek(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

function resolveNextWorkoutLabel(
  schedule: Record<number, Awaited<ReturnType<typeof fetchWorkouts>>["todayWorkout"]>,
  messages: Awaited<ReturnType<typeof getServerMessages>>,
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

export default async function DashboardPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const messages = await getServerMessages()
  const [workoutData, mealData] = await Promise.all([fetchWorkouts(accessToken), fetchMeals(accessToken)])
  const weekStart = startOfWeek(new Date())
  const workoutsThisWeek = workoutData.recentLogs.filter((log) => log.startedAt >= weekStart).length
  const scheduledThisWeek = Object.values(workoutData.schedule).filter(Boolean).length
  const totalVolume = workoutData.recentLogs
    .filter((log) => log.startedAt >= weekStart)
    .reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const nextWorkout = resolveNextWorkoutLabel(workoutData.schedule, messages)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">
                {messages.dashboard.welcomeBack}, <span className="text-primary">{profile.name.split(" ")[0]}</span>
              </h1>
              <p className="mt-1 text-muted-foreground">
                {workoutData.todayWorkout
                  ? messages.dashboard.readyToday
                  : messages.dashboard.noWorkoutToday}
              </p>
            </div>

            <div className="mb-6">
              <QuickActions />
            </div>

            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title={messages.dashboard.weeklyStreak}
                value={`${workoutData.recentLogs.length} ${messages.dashboard.logs}`}
                iconName="flame"
                variant="accent"
              />
              <StatsCard
                title={messages.dashboard.thisWeek}
                value={`${workoutsThisWeek}/${scheduledThisWeek || 0}`}
                subtitle={messages.dashboard.workoutsCompleted}
                iconName="target"
                variant="primary"
              />
              <StatsCard
                title={messages.dashboard.totalVolume}
                value={totalVolume > 0 ? totalVolume.toLocaleString() : "0"}
                subtitle={messages.dashboard.loggedThisWeek}
                iconName="trending-up"
              />
              <StatsCard title={messages.dashboard.nextWorkout} value={nextWorkout.value} subtitle={nextWorkout.subtitle} iconName="calendar" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <TodayWorkout workout={workoutData.todayWorkout} />
              <NutritionSummary nutrition={mealData.dailyNutrition} />
            </div>

            <div className="mt-6">
              <RecentActivity logs={workoutData.recentLogs} />
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
