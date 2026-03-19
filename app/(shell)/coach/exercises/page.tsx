import { ExerciseLibraryClient } from "@/components/coach/exercise-library-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchExercises } from "@/lib/fitness/api"

export default async function CoachExercisesPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const exercises = await fetchExercises(accessToken)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Exercise Library</h1>
        <p className="mt-1 text-muted-foreground">
          Browse the available exercise library before building or updating programs.
        </p>
      </div>

      <ExerciseLibraryClient initialExercises={exercises} />
    </div>
  )
}
