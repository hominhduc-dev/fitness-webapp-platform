import { ExerciseLibraryClient } from "@/components/coach/exercise-library-client"
import { getServerMessages } from "@/lib/i18n/server"

export default async function CoachExercisesPage() {
  const messages = await getServerMessages()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">{messages.coach.exerciseLibraryTitle}</h1>
        <p className="mt-1 text-muted-foreground">
          {messages.coach.exerciseLibraryDescription}
        </p>
      </div>

      <ExerciseLibraryClient />
    </div>
  )
}
