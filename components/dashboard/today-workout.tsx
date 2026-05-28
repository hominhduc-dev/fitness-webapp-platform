"use client"

import Link from "next/link"
import { Dumbbell, Play } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { Workout } from "@/lib/types"
import { formatRepTarget } from "@/lib/workout-reps"

interface TodayWorkoutProps {
  workout: Workout | null
}

export function TodayWorkout({ workout }: TodayWorkoutProps) {
  const { messages } = useLocale()

  if (!workout) {
    return (
      <div className="flex flex-col rounded-[10px] border border-border bg-card p-5">
        <span className="label-micro mb-4 block">{messages.dashboard.todaysWorkout}</span>
        <div className="flex flex-1 min-h-[220px] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[10px] bg-muted">
            <Dumbbell className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">{messages.dashboard.restDay}</p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{messages.dashboard.restDayCopy}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-[10px] border border-border bg-card p-5">
      <span className="label-micro mb-4 block">{messages.dashboard.todaysWorkout}</span>

      <div className="flex flex-1 flex-col justify-between gap-5">
        {/* Workout header */}
        <div>
          <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-foreground">
            {workout.name}
          </h3>
          <p className="mt-1 font-mono text-[11px] tnum text-muted-foreground">
            {workout.exercises.length} {messages.dashboard.exercises}
            {workout.duration ? ` · ${workout.duration} ${messages.dashboard.min}` : ""}
          </p>
        </div>

        {/* Exercise list */}
        <div className="space-y-2">
          {workout.exercises.slice(0, 4).map((exercise) => (
            <div key={exercise.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-foreground">
                {formatExerciseVariationLabel({
                  exerciseName: exercise.exercise.name,
                  isDefault: exercise.variation.isDefault,
                  variationName: exercise.variation.name,
                })}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-medium tnum text-muted-foreground">
                {exercise.sets.length}×{formatRepTarget({
                  reps: exercise.sets[0]?.targetReps,
                  repsMin: exercise.sets[0]?.targetRepsMin,
                })}
              </span>
            </div>
          ))}
          {workout.exercises.length > 4 && (
            <p className="label-micro pt-1">
              +{workout.exercises.length - 4} more
            </p>
          )}
        </div>

        {/* Muscle tags */}
        <div className="flex flex-wrap gap-1.5">
          {[...new Set(workout.exercises.map((ex) => ex.exercise.muscleGroup))].slice(0, 4).map((group) => (
            <span
              key={group}
              className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground"
            >
              {group}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link href={`/workout/${workout.id}/start`}>
          <Button className="w-full gap-1.5">
            <Play className="h-3.5 w-3.5" />
            {messages.dashboard.start}
          </Button>
        </Link>
      </div>
    </div>
  )
}
