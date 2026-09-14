import { ProgressClient, type ProgressClientInitialData } from "@/components/progress/progress-client"
import { requireAppSession } from "@/lib/auth/server"
import {
  fetchDashboardAnalytics,
  fetchProgressAnalytics,
  fetchProgressCalendar,
  fetchRecoveryHistory,
  fetchVolumeRecovery,
  fetchWeightEntries,
  fetchWorkouts,
} from "@/lib/fitness/api"
import {
  PROGRESS_OVERVIEW_RECOVERY_DAYS,
  PROGRESS_OVERVIEW_WEIGHT_DAYS,
  progressAnalyticsRange,
  READINESS_TREND_DEFAULT_DAYS,
} from "@/lib/fitness/progress-ranges"

const PROGRESS_TABS = ["overview", "history", "volume"] as const

type ProgressPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>
}

/** A failed seed is dropped; the client query fetches what the server could not. */
function seed<T>(promise: Promise<T>) {
  return promise.catch(() => undefined)
}

export default async function ProgressPage({ searchParams }: ProgressPageProps) {
  const [{ accessToken, profile }, { tab: requestedTab }] = await Promise.all([
    requireAppSession({ role: "trainee" }),
    searchParams,
  ])
  // "year" and "prs" were merged into History and Overview; old links still land there.
  const tab = PROGRESS_TABS.find((value) => value === requestedTab) ?? (requestedTab === "year" ? "history" : "overview")
  const now = new Date()
  const viewYear = now.getFullYear()
  const viewMonth = now.getMonth() + 1
  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
  const analyticsRange = progressAnalyticsRange(now)

  // Only the tab being opened is fetched here. Switching tabs afterwards is a
  // shallow URL update on the client that reads (or fills) the query cache.
  const isHistory = tab === "history"
  const isOverview = tab === "overview"
  const recoveryDays = tab === "volume" ? READINESS_TREND_DEFAULT_DAYS : PROGRESS_OVERVIEW_RECOVERY_DAYS

  const [
    calendar,
    prevCalendar,
    workoutCollection,
    analytics,
    dashboardAnalytics,
    volumeRecovery,
    weightEntries,
    recoveryHistory,
  ] = await Promise.all([
    isHistory ? seed(fetchProgressCalendar(accessToken, viewYear, viewMonth)) : undefined,
    isHistory ? seed(fetchProgressCalendar(accessToken, prevYear, prevMonth, { summaryOnly: true })) : undefined,
    isHistory ? seed(fetchWorkouts(accessToken)) : undefined,
    isOverview ? seed(fetchProgressAnalytics(accessToken)) : undefined,
    isOverview ? seed(fetchDashboardAnalytics(accessToken, analyticsRange.start, analyticsRange.end)) : undefined,
    isHistory ? undefined : seed(fetchVolumeRecovery(accessToken)),
    isOverview ? seed(fetchWeightEntries(accessToken, PROGRESS_OVERVIEW_WEIGHT_DAYS)) : undefined,
    isHistory ? undefined : seed(fetchRecoveryHistory(accessToken, recoveryDays)),
  ])

  const initialData: ProgressClientInitialData = {
    analytics,
    analyticsRange,
    calendar,
    dashboardAnalytics,
    // The calendar endpoint returns log stubs without exercises, so the muscle
    // map is fed from the workout collection instead: weekLogs is every session
    // since Monday UTC, historyLogs the last 20 (where last week comes from).
    historyLogs: workoutCollection?.historyLogs,
    prevCalendar,
    programs: workoutCollection?.programs,
    recoveryHistory: recoveryHistory ? { data: recoveryHistory, days: recoveryDays } : undefined,
    viewMonth,
    viewYear,
    volumeRecovery,
    weekLogs: workoutCollection?.weekLogs,
    weightEntries,
    weightUnitLabel: profile.preferredWeightUnit === "lbs" ? "lbs" : "kg",
    workoutCollection,
  }

  return <ProgressClient initialData={initialData} />
}
