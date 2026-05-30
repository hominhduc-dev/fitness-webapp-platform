import { Suspense } from "react"

import { RoutinesWorkoutBoard } from "@/components/workout/routines-workout-board"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

function RoutinesPageSkeleton() {
  return (
    <div>
      <div className="mb-5 flex flex-col items-start justify-between gap-3.5 sm:mb-7 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-8 w-36 rounded sm:h-9" />
        </div>
        <Skeleton className="h-10 w-full rounded-[8px] sm:w-36" />
      </div>
      <div className="mb-5 flex gap-2 overflow-hidden sm:mb-6">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-[286px] rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}

async function RoutinesContent() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)

  return <RoutinesWorkoutBoard historyLogs={workoutData.historyLogs} workouts={workoutData.workouts} />
}

export default function WorkoutPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 sm:py-8 md:px-10">
      <Suspense fallback={<RoutinesPageSkeleton />}>
        <RoutinesContent />
      </Suspense>
    </main>
  )
}
