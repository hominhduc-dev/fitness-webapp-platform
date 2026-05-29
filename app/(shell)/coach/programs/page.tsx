import { ProgramsBoard } from "@/components/coach/programs-board"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTrainees, fetchExerciseLibrary, fetchExercises } from "@/lib/fitness/api"
import { flattenExerciseLibraryToVariationOptions, mergeExerciseOptions } from "@/lib/fitness/exercise-options"

export default async function CoachProgramsPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [programs, trainees, exerciseOptions, exerciseLibrary] = await Promise.all([
    fetchCoachPrograms(accessToken),
    fetchCoachTrainees(accessToken),
    fetchExercises(accessToken),
    fetchExerciseLibrary(accessToken),
  ])

  const fallbackExerciseOptions = flattenExerciseLibraryToVariationOptions(exerciseLibrary)
  const resolvedExerciseOptions = mergeExerciseOptions(exerciseOptions, fallbackExerciseOptions)

  return (
    <div className="px-4 py-6 md:px-9 md:py-10">
      <ProgramsBoard initialPrograms={programs} trainees={trainees} exerciseOptions={resolvedExerciseOptions} />
    </div>
  )
}
