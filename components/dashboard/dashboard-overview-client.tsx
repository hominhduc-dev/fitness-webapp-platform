"use client"

import { useState, useSyncExternalStore } from "react"

import { AIChatBubble } from "@/components/ai/chat-bubble"
import { WorkoutCelebration } from "@/components/workout/workout-celebration"
import { CheckInPrompt } from "./check-in-prompt"
import { NutritionSummary } from "./nutrition-summary"
import { QuickActions } from "./quick-actions"
import { ReadinessCard } from "./readiness-card"
import { RecentActivity } from "./recent-activity"
import { TodayWorkout } from "./today-workout"
import { WeekStrip } from "./week-strip"
import { WeeklyProgressCard } from "./weekly-progress-card"
import { WeeklyVolumeCard } from "./weekly-volume-card"
import { useLocale } from "@/components/providers/locale-provider"
import type { fetchProgressAnalytics, fetchRecoveryHistory, fetchVolumeRecovery } from "@/lib/fitness/api"
import { fetchDashboard } from "@/lib/fitness/api"
import { READINESS_TREND_DEFAULT_DAYS } from "@/lib/fitness/progress-ranges"
import { useNutritionDay } from "@/lib/queries/meals"
import { useProgressAnalytics, useRecoveryHistory, useVolumeRecovery } from "@/lib/queries/progress"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import type { AppMessages } from "@/lib/i18n/messages"
type DashboardMessages = AppMessages
type DashboardData = Awaited<ReturnType<typeof fetchDashboard>>

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function isSameCalendarDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function resolveNextWorkoutLabel(entries: DashboardData["scheduleEntries"], messages: DashboardMessages) {
  const now = new Date()
  const today = formatDateKey(now)
  const next = entries.find((entry) => formatDateKey(entry.date) >= today && entry.workout && !entry.isCompleted)
  if (!next?.workout) return { subtitle: messages.dashboard.noWorkoutScheduled, value: messages.dashboard.rest }
  const offset = Math.round((Date.UTC(next.date.getFullYear(), next.date.getMonth(), next.date.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
  return { subtitle: next.workout.name, value: offset === 0 ? messages.common.today : offset === 1 ? messages.dashboard.tomorrow : messages.dashboard.inDays(offset) }
}

type DashboardSeeds = {
  analytics?: Awaited<ReturnType<typeof fetchProgressAnalytics>>
  recoveryHistory?: Awaited<ReturnType<typeof fetchRecoveryHistory>>
  volumeRecovery?: Awaited<ReturnType<typeof fetchVolumeRecovery>>
}

const subscribeToNothing = () => () => {}
const clientHydrated = () => true
const serverHydrated = () => false

export function DashboardOverviewClient({
  initialData,
  preferredWeightUnit,
  seeds,
}: {
  initialData: DashboardData
  preferredWeightUnit?: "kg" | "lbs"
  seeds?: DashboardSeeds
}) {
  const [aiChatOpen, setAIChatOpen] = useState(false)
  const hasHydrated = useSyncExternalStore(subscribeToNothing, clientHydrated, serverHydrated)
  const { messages } = useLocale()
  const dashboardQuery = useUserQuery({
    queryKey: ["workouts", "dashboard"],
    queryFn: async () => fetchDashboard(await requireAccessToken()),
    initialData,
  })
  const dashboard = hasHydrated && dashboardQuery.data ? dashboardQuery.data : initialData
  // The dashboard payload uses targetCalories/totalCalories while NutritionDay
  // uses targets/totals. Read the shared meals query so dashboard reflects a
  // meal logged from /meals instead of a stale ISR snapshot.
  const todayNutritionQuery = useNutritionDay(formatDateKey(dashboard.dailyNutrition.date))
  const dailyNutrition = hasHydrated && todayNutritionQuery.data
    ? {
        date: todayNutritionQuery.data.date,
        meals: todayNutritionQuery.data.meals,
        targetCalories: todayNutritionQuery.data.targets.calories,
        totalCalories: todayNutritionQuery.data.totals.calories,
      }
    : dashboard.dailyNutrition
  // Seeded before the cards below render, so they read these keys from the
  // cache instead of fetching them after hydration.
  useVolumeRecovery({ initialData: seeds?.volumeRecovery })
  useProgressAnalytics({ initialData: seeds?.analytics })
  useRecoveryHistory(READINESS_TREND_DEFAULT_DAYS, { initialData: seeds?.recoveryHistory })

  const { activeDaysThisWeek, workoutsThisWeek } = dashboard.weekStats
  const scheduledThisWeek = dashboard.scheduleEntries.filter((entry) => entry.workout).length
  const nextWorkout = resolveNextWorkoutLabel(dashboard.scheduleEntries, messages)
  const volumeUnitLabel = preferredWeightUnit === "lbs" ? messages.dashboard.lbs : "kg"
  return (
    <div className="space-y-4">
      {/* Renders nothing until a finished session left a flag behind. */}
      <WorkoutCelebration />

      <div className="hidden md:block">
        <WeekStrip
          getDayPlan={(date) => {
            const entry = dashboard.scheduleEntries.find((item) => isSameCalendarDate(item.date, date))
            return {
              completed: entry?.isCompleted ?? false,
              workoutName: entry?.workout?.name ?? null,
            }
          }}
        />
      </div>

      <CheckInPrompt />

      <div data-tour="dashboard-quick-actions"><QuickActions onOpenAIChat={() => setAIChatOpen(true)} /></div>

      {/* Mobile keeps the task-first reading order. Desktop follows the
          overview matrix from the dashboard mockup. */}
      {/* Phones pair readiness and nutrition as two squares; every other card
          spans both columns. From `sm` the pair goes back to full width. */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="order-3 col-span-2 min-w-0 lg:order-none lg:col-span-1 lg:col-start-1 lg:row-span-2 lg:row-start-1" data-tour="dashboard-today-workout">
          <TodayWorkout
            activeSessions={dashboard.activeSessions}
            preferActiveSession={hasHydrated}
            workout={dashboard.todayWorkout}
            workouts={dashboard.workouts}
            completed={dashboard.scheduleEntries.some((entry) => entry.isToday && entry.isCompleted)}
          />
        </div>

        <div className="order-1 col-span-1 min-w-0 sm:col-span-2 lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-1" data-tour="dashboard-readiness">
          <ReadinessCard />
        </div>

        <div className="order-2 col-span-1 min-w-0 sm:col-span-2 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1" data-tour="dashboard-nutrition">
          <NutritionSummary nutrition={dailyNutrition} />
        </div>

        <div className="order-4 col-span-2 min-w-0 lg:order-none lg:col-span-1 lg:col-start-2 lg:row-start-2" data-tour="dashboard-weekly-progress">
          <WeeklyProgressCard
            activeDays={activeDaysThisWeek}
            completedWorkouts={workoutsThisWeek}
            nextWorkout={nextWorkout}
            scheduledWorkouts={scheduledThisWeek}
            volumeUnitLabel={volumeUnitLabel}
          />
        </div>

        <div className="order-5 col-span-2 min-w-0 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-3" data-tour="dashboard-weekly-volume">
          <WeeklyVolumeCard />
        </div>

        <div className="order-6 col-span-2 min-w-0 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-2" data-tour="dashboard-recent-activity">
          <RecentActivity logs={dashboard.recentLogs} />
        </div>
      </div>

      <AIChatBubble open={aiChatOpen} onOpenChange={setAIChatOpen} />
    </div>
  )
}
