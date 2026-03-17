import { Sidebar } from "@/components/layout/sidebar"
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#f6f6f8] text-foreground md:bg-background">
      <Sidebar role="trainee" />

      <div className="flex min-w-0 flex-1 flex-col bg-[#f6f6f8] md:bg-transparent">
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-6">
          <div className="w-full md:mx-auto md:max-w-[1240px] md:px-8 md:py-8">
            <WeeklyCalendar recentLogs={workoutData.recentLogs} schedule={workoutData.schedule} />
          </div>
        </main>
      </div>
    </div>
  )
}
