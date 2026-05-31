import { ExerciseLibraryClient } from "@/components/coach/exercise-library-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachExerciseImportRequests, fetchCoachExercises } from "@/lib/fitness/api"

export default async function CoachExercisesPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [exercises, importRequests] = await Promise.all([
    fetchCoachExercises(accessToken),
    fetchCoachExerciseImportRequests(accessToken).catch(() => []),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Exercise Library</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your personal exercise library and review the shared system catalog before building plans.
        </p>
      </div>

      <ExerciseLibraryClient initialExercises={exercises} initialImportRequests={importRequests} />
    </div>
  )
}
