import { Suspense } from "react"

import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export const revalidate = 30

async function ScheduleCalendar({ accessToken }: { accessToken: string }) {
  const workoutData = await fetchWorkouts(accessToken)

  return (
    <WeeklyCalendar
      recentLogs={workoutData.recentLogs}
      schedule={workoutData.schedule}
      showHero={false}
      weekLogs={workoutData.weekLogs}
      workouts={workoutData.workouts}
    />
  )
}

function ScheduleCalendarSkeleton() {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-64 rounded-full" />
      </div>
      <Skeleton className="mb-7 h-48 rounded-[12px]" />
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-[130px] rounded-[10px]" />
        ))}
      </div>
    </section>
  )
}

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })

  return (
    <div className="w-full max-w-full overflow-x-hidden text-foreground">
      <Suspense fallback={<ScheduleCalendarSkeleton />}>
        <ScheduleCalendar accessToken={accessToken} />
      </Suspense>
    </div>
  )
}
