import { ProgressClient, type ProgressClientInitialData } from "@/components/progress/progress-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchProgressCalendar } from "@/lib/fitness/api"

export default async function ProgressPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const now = new Date()
  const viewYear = now.getFullYear()
  const viewMonth = now.getMonth() + 1
  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
  const [calendar, prevCalendar] = await Promise.all([
    fetchProgressCalendar(accessToken, viewYear, viewMonth),
    fetchProgressCalendar(accessToken, prevYear, prevMonth, { summaryOnly: true }).catch(() => null),
  ])
  const initialData: ProgressClientInitialData = {
    calendar,
    prevCalendar,
    viewMonth,
    viewYear,
    weightUnitLabel: profile.preferredWeightUnit === "lbs" ? "lbs" : "kg",
  }

  return <ProgressClient initialData={initialData} />
}
