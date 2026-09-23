import { RoutinesWorkoutBoard } from "@/components/workout/routines-workout-board"
import { requireAppSession } from "@/lib/auth/server"
import { fetchWorkouts } from "@/lib/fitness/api"

export const revalidate = 30

export default async function WorkoutPage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const initialData = await fetchWorkouts(accessToken)

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 pb-6 pt-page md:px-6">
      <RoutinesWorkoutBoard initialData={initialData} />
    </main>
  )
}
