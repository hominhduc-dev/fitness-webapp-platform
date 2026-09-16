"use client"

import Link from "next/link"
import type { ActiveWorkoutSession } from "@/lib/workout/session-storage"
import { useActiveWorkoutSessionList } from "@/lib/workout/use-active-workout-sessions"
import { ChevronRight, Clock, Dumbbell, Layers, Moon, Play } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { Workout } from "@/lib/types"
import { formatRepTarget } from "@/lib/workout-reps"

interface TodayWorkoutProps {
  workout: Workout | null
  completed?: boolean
  activeSessions?: ActiveWorkoutSession[]
  workouts?: Workout[]
}

export function TodayWorkout({ activeSessions, workout: scheduledWorkout, completed = false, workouts = [] }: TodayWorkoutProps) {
  const activeId = useActiveWorkoutSessionList(activeSessions).sessions[0]?.workoutId ?? null
  const activeWorkout = workouts.find((item) => item.id === activeId)
  const workout = activeWorkout ?? scheduledWorkout
  const isCompleted = !activeWorkout && completed
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const { messages } = useLocale()
  const copy = messages.dashboard

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{copy.todaysWorkout}</h2>
      <Link href="/workout" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {copy.viewPlan}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )

  if (!workout) {
    return (
      <section className="glass-card flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4">
        {header}
        <div className="mt-4 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Moon className="size-7" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-foreground">{copy.restDay}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{copy.restDayCopy}</p>
          </div>
        </div>
      </section>
    )
  }

  const muscleGroups = [...new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup).filter(Boolean))]
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const stats = [
    ...(workout.duration ? [{ icon: Clock, label: `${workout.duration} ${copy.min}` }] : []),
    { icon: Dumbbell, label: `${workout.exercises.length} ${copy.exercises}` },
    { icon: Layers, label: `${totalSets} ${copy.sets}` },
  ]

  return (
      <section className="glass-card flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-4">
      {header}

      <div className="mt-4 flex min-w-0 items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Dumbbell className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-snug text-foreground">{workout.name}</h3>
          {muscleGroups.length > 0 ? (
            <p className="mt-0.5 line-clamp-2 text-sm capitalize text-muted-foreground">
              {muscleGroups.slice(0, 4).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 flex gap-2 md:flex-wrap">
        {stats.map((stat) => (
          <li
            key={stat.label}
          className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-surface-subtle px-2 py-1.5 text-xs font-medium tnum text-foreground md:flex-none md:px-3"
          >
            <stat.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {stat.label}
          </li>
        ))}
      </ul>

      {/* The exercise list has room on wider screens; phones keep the card short. */}
      <ul className="mt-4 hidden min-w-0 space-y-1.5 md:block">
        {workout.exercises.slice(0, 4).map((exercise) => (
          <li key={exercise.id} className="flex min-w-0 items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm leading-5 text-foreground">
              {formatExerciseVariationLabel({
                displayName: exercise.variation.displayName,
                exerciseName: exercise.exercise.name,
                isDefault: exercise.variation.isDefault,
                variationName: exercise.variation.name,
              })}
            </span>
            <span className="shrink-0 font-mono text-xs font-medium tnum text-muted-foreground">
              {exercise.sets.length}×{formatRepTarget({
                reps: exercise.sets[0]?.targetReps,
                repsMin: exercise.sets[0]?.targetRepsMin,
              })}
            </span>
          </li>
        ))}
        {workout.exercises.length > 4 ? (
          <li className="label-micro pt-1">{copy.moreExercises(workout.exercises.length - 4)}</li>
        ) : null}
      </ul>

      <Button asChild size="lg" className="dashboard-primary-cta mt-4 h-10 w-full gap-2 rounded-xl text-sm lg:mt-auto">
        <Link href={isCompleted ? '/schedule' : `/workout/${workout.id}/start${activeWorkout ? '' : `?logDate=${dateKey}`}`} scroll>
          <Play className="size-4 fill-current" aria-hidden="true" />
          {activeWorkout ? messages.schedule.resume : isCompleted ? messages.schedule.review : copy.startWorkout}
        </Link>
      </Button>
    </section>
  )
}
