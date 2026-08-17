import { ProgressClient, type ProgressClientInitialData } from "@/components/progress/progress-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchProgressCalendar, fetchWorkouts } from "@/lib/fitness/api"

export default async function ProgressPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const now = new Date()
  const viewYear = now.getFullYear()
  const viewMonth = now.getMonth() + 1
  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
  const [calendar, prevCalendar, workoutCollection] = await Promise.all([
    fetchProgressCalendar(accessToken, viewYear, viewMonth),
    fetchProgressCalendar(accessToken, prevYear, prevMonth, { summaryOnly: true }).catch(() => null),
    fetchWorkouts(accessToken).catch(() => null),
  ])
  const initialData: ProgressClientInitialData = {
    calendar,
    // The calendar endpoint returns log stubs without exercises, so the muscle
    // map is fed from the workout collection instead: weekLogs is every session
    // since Monday UTC, historyLogs the last 20 (where last week comes from).
    historyLogs: workoutCollection?.historyLogs ?? [],
    prevCalendar,
    programs: workoutCollection?.programs ?? [],
    viewMonth,
    viewYear,
    weekLogs: workoutCollection?.weekLogs ?? [],
    weightUnitLabel: profile.preferredWeightUnit === "lbs" ? "lbs" : "kg",
  }

  return <ProgressClient initialData={initialData} />
}
