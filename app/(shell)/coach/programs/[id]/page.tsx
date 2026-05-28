import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTrainees, fetchExerciseLibrary, fetchExercises } from "@/lib/fitness/api"
import { flattenExerciseLibraryToVariationOptions, mergeExerciseOptions } from "@/lib/fitness/exercise-options"

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [exerciseOptions, exerciseLibrary, traineeOptions] = await Promise.all([
    fetchExercises(accessToken),
    fetchExerciseLibrary(accessToken),
    fetchCoachTrainees(accessToken),
  ])

  const fallbackExerciseOptions = flattenExerciseLibraryToVariationOptions(exerciseLibrary)
  const resolvedExerciseOptions = mergeExerciseOptions(exerciseOptions, fallbackExerciseOptions)

  return (
    <ProgramEditorLazy
      programId={id}
      initialExerciseOptions={resolvedExerciseOptions}
      initialTraineeOptions={traineeOptions}
    />
  )
}
