import { Suspense } from "react"
import { notFound } from "next/navigation"

import { ProgramWeekViewer } from "@/components/workout/program-week-viewer"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/auth/api"
import { requireAppSession } from "@/lib/auth/server"
import { fetchTraineeProgram, fetchWorkouts } from "@/lib/fitness/api"

function ProgramDetailSkeleton() {
  return (
    <div>
      <Skeleton className="mb-5 h-4 w-28 rounded" />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-9 w-64 rounded" />
        <Skeleton className="h-2 w-full max-w-sm rounded-full" />
      </div>
      <div className="mb-5 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
          <Skeleton key={item} className="h-8 w-14 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-[286px] rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}

async function ProgramDetailContent({ programId }: { programId: string }) {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })

  // getTraineeProgramDetail already scopes to programs the caller owns or is
  // assigned to, so a 404 here means "not yours" as much as "not found".
  const [program, workoutData] = await Promise.all([
    fetchTraineeProgram(accessToken, programId).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        notFound()
      }

      throw error
    }),
    fetchWorkouts(accessToken),
  ])

  const assignedAt = program.assignedTrainees.find((trainee) => trainee.id === profile.id)?.assignedAt
  // Only a program the trainee authored is theirs to reshape; a coach's plan
  // stays read-only here, and the backend enforces the same rule.
  const canEdit = program.createdBy === profile.id && !program.archivedAt

  return (
    <ProgramWeekViewer
      assignedAt={assignedAt}
      canEdit={canEdit}
      historyLogs={workoutData.historyLogs}
      program={program}
    />
  )
}

export default async function TraineeProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <main className="mx-auto w-full max-w-[1100px] min-w-0 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-8 md:px-10">
      <Suspense fallback={<ProgramDetailSkeleton />}>
        <ProgramDetailContent programId={id} />
      </Suspense>
    </main>
  )
}
