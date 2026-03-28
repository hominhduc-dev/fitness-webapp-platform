import { Suspense, cache } from "react"

import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

const getScheduleData = cache(async (accessToken: string) => fetchWorkouts(accessToken))

async function ScheduleCalendar({ accessToken }: { accessToken: string }) {
  const workoutData = await getScheduleData(accessToken)

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
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center gap-2 sm:gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>

          <Skeleton className="h-4 w-48" />
        </div>

        <div className="space-y-3 lg:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          ))}
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-7 xl:gap-4">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex h-[230px] flex-col rounded-[24px] border border-border bg-card p-4 shadow-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-9 w-8" />
              </div>
              <div className="mt-5 flex flex-1 flex-col">
                <Skeleton className="h-[78px] w-full rounded-[18px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default async function SchedulePage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })

  return (
    <div className="w-full max-w-full overflow-x-hidden text-foreground">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
        <div className="space-y-8">
          <section className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">Weekly Schedule</h1>
            <p className="max-w-2xl text-base text-muted-foreground">Plan and organize your training week</p>
          </section>

          <Suspense fallback={<ScheduleCalendarSkeleton />}>
            <ScheduleCalendar accessToken={accessToken} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
