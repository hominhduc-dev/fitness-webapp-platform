import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            <WeeklyCalendar recentLogs={workoutData.recentLogs} schedule={workoutData.schedule} />
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
