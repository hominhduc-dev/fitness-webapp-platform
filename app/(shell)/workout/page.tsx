import Link from "next/link"
import { Suspense } from "react"
import { ChevronDown, Clock, Dumbbell, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreateWorkoutDialog } from "@/components/workout/create-workout-dialog"
import { DeleteWorkoutButton } from "@/components/workout/delete-workout-button"
import { EditWorkoutButton } from "@/components/workout/edit-workout-button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import { fetchWorkouts } from "@/lib/fitness/api"

function WorkoutPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
          <Skeleton className="h-11 w-24 rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, groupIndex) => (
          <div key={groupIndex} className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <div className="flex items-center justify-between gap-4 p-4 md:p-5">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
            <div className="border-t border-border p-4 md:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, cardIndex) => (
                  <div key={cardIndex} className="flex min-h-[19rem] flex-col overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex-1 p-5">
                      <div className="space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                      <div className="mt-6 space-y-3">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-4/5" />
                        <Skeleton className="h-5 w-full" />
                      </div>
                      <div className="mt-6 flex gap-2">
                        <Skeleton className="h-7 w-16 rounded-full" />
                        <Skeleton className="h-7 w-16 rounded-full" />
                      </div>
                    </div>
                    <div className="border-t border-border bg-muted/30 p-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function WorkoutContent() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)
  const quickStartWorkout = workoutData.todayWorkout ?? workoutData.workouts[0] ?? null
  const personalWorkouts = workoutData.workouts.filter((workout) => workout.isPersonal)
  const coachWorkouts = workoutData.workouts.filter((workout) => !workout.isPersonal)

  const renderWorkoutGrid = (workouts: typeof workoutData.workouts) => (
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workouts.map((workout) => (
        <div
          key={workout.id}
          className="group flex h-full min-h-[19rem] flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30"
        >
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-4 min-h-[3.75rem]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="line-clamp-1 text-lg font-semibold transition-colors group-hover:text-primary">
                    {workout.name}
                  </h3>
                  {workout.isPersonal ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Personal</span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {workout.duration ?? "?"} min
                  </span>
                  <span>{workout.exercises.length} exercises</span>
                </div>
              </div>
            </div>

            <div className="mb-4 min-h-[6.75rem] space-y-2.5">
                {workout.exercises.slice(0, 3).map((exercise) => (
                  <div key={exercise.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <span className="line-clamp-1 text-[1.08rem] font-medium text-slate-600">
                      {formatExerciseVariationLabel({
                        exerciseName: exercise.exercise.name,
                        isDefault: exercise.variation.isDefault,
                        variationName: exercise.variation.name,
                      })}
                    </span>
                  <span className="text-[1.05rem] font-semibold tracking-tight text-slate-900">
                    {exercise.sets.length} × {exercise.sets[0]?.targetReps ?? "?"}
                  </span>
                </div>
              ))}
              {workout.exercises.length > 3 ? (
                <p className="pt-0.5 text-xs font-medium text-muted-foreground">
                  +{workout.exercises.length - 3} more exercises
                </p>
              ) : null}
            </div>

            <div className="mt-auto flex min-h-[2rem] flex-wrap content-start gap-2">
              {[...new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))].map((group) => (
                <span
                  key={group}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-muted/30 p-3">
            <Link href={`/workout/${workout.id}/start`} className="flex-1">
              <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                <Play className="h-4 w-4" />
                Start Workout
              </Button>
            </Link>
            {workout.isPersonal ? <EditWorkoutButton workout={workout} /> : null}
            {workout.isPersonal ? <DeleteWorkoutButton workoutId={workout.id} /> : null}
          </div>
        </div>
      ))}
    </div>
  )

  const renderWorkoutGroup = ({
    title,
    description,
    workouts,
    emptyMessage,
  }: {
    title: string
    description: string
    workouts: typeof workoutData.workouts
    emptyMessage: string
  }) => (
    <details open className="group overflow-hidden rounded-2xl border border-border bg-card/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {workouts.length} workout{workouts.length === 1 ? "" : "s"}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </summary>

      <div className="border-t border-border p-4 md:p-5">
        {workouts.length > 0 ? (
          renderWorkoutGrid(workouts)
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>
    </details>
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Workouts</h1>
          <p className="mt-1 text-muted-foreground">Coach-assigned plans and personal workouts you can build yourself</p>
        </div>
        <CreateWorkoutDialog workoutTemplates={workoutData.workouts} />
      </div>

      {quickStartWorkout ? (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Quick Start</h2>
          <Link href={`/workout/${quickStartWorkout.id}/start`}>
            <div className="group rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
                    <Dumbbell className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{quickStartWorkout.name}</h3>
                    <p className="text-muted-foreground">
                      {quickStartWorkout.exercises.length} exercises · {quickStartWorkout.duration ?? "?"} min
                    </p>
                  </div>
                </div>
                <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                  <Play className="h-5 w-5" />
                  Start
                </Button>
              </div>
            </div>
          </Link>
        </div>
      ) : null}

      <div>
        <h2 className="mb-4 text-lg font-semibold">Your Workouts</h2>
        {workoutData.workouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-lg font-semibold">No workouts yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your own workout now or wait for a coach to assign a program.
            </p>
            <div className="mt-4 flex justify-center">
              <CreateWorkoutDialog workoutTemplates={workoutData.workouts} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {renderWorkoutGroup({
              title: "My Workouts",
              description: "Workouts you created yourself. You can expand, collapse, and delete them anytime.",
              workouts: personalWorkouts,
              emptyMessage: "You have not created any personal workouts yet.",
            })}
            {renderWorkoutGroup({
              title: "Coach Workouts",
              description: "Programs assigned by your coach, grouped separately for easier tracking.",
              workouts: coachWorkouts,
              emptyMessage: "No workouts from your coach have been assigned yet.",
            })}
          </div>
        )}
      </div>
    </>
  )
}

export default function WorkoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <Suspense fallback={
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Workouts</h1>
              <p className="mt-1 text-muted-foreground">Coach-assigned plans and personal workouts you can build yourself</p>
            </div>
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
          <WorkoutPageSkeleton />
        </div>
      }>
        <WorkoutContent />
      </Suspense>
    </div>
  )
}
