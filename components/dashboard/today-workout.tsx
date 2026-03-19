"use client"

import Link from "next/link"
import { Clock, Dumbbell, Play } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { Workout } from "@/lib/types"

interface TodayWorkoutProps {
  workout: Workout | null
}

export function TodayWorkout({ workout }: TodayWorkoutProps) {
  const { messages } = useLocale()

  if (!workout) {
    return (
      <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
        <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.todaysWorkout}</h3>

        <div className="flex min-h-[290px] flex-col items-center justify-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Dumbbell className="h-9 w-9 text-muted-foreground" />
          </div>
          <p className="mt-6 text-3xl font-bold tracking-tight text-foreground">{messages.dashboard.restDay}</p>
          <p className="mt-3 max-w-md text-base text-muted-foreground">{messages.dashboard.restDayCopy}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
      <h3 className="text-2xl font-black tracking-tight text-foreground">{messages.dashboard.todaysWorkout}</h3>

      <div className="mt-5 flex min-h-[290px] flex-col justify-between">
        <div className="space-y-5">
          <div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{workout.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-base text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {workout.duration ?? "?"} {messages.dashboard.min}
              </span>
              <span>
                {workout.exercises.length} {messages.dashboard.exercises}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {workout.exercises.slice(0, 3).map((exercise) => (
              <div key={exercise.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                <span className="line-clamp-1 text-[1.08rem] font-medium text-slate-600">
                  {exercise.exercise.name}
                </span>
                <span className="text-[1.05rem] font-semibold tracking-tight text-slate-900">
                  {exercise.sets.length} × {exercise.sets[0]?.targetReps ?? "?"}
                </span>
              </div>
            ))}
            {workout.exercises.length > 3 ? (
              <p className="pt-0.5 text-xs font-medium text-muted-foreground">
                {messages.dashboard.moreExercises(workout.exercises.length - 3)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
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

        <Link href={`/workout/${workout.id}/start`} className="mt-6">
          <Button className="h-12 w-full rounded-2xl text-base font-semibold">
            <Play className="h-4 w-4" />
            {messages.dashboard.start}
          </Button>
        </Link>
      </div>
    </div>
  )
}
