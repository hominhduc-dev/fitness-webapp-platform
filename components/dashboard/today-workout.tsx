"use client"

import { Play, Clock, Dumbbell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { Workout } from "@/lib/types"
import { useLocale } from "@/components/providers/locale-provider"

interface TodayWorkoutProps {
  workout: Workout | null
}

export function TodayWorkout({ workout }: TodayWorkoutProps) {
  const { locale, messages } = useLocale()

  if (!workout) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">{messages.dashboard.todaysWorkout}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Dumbbell className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-2 text-muted-foreground">{messages.dashboard.restDay}</p>
          <p className="text-sm text-muted-foreground">{messages.dashboard.restDayCopy}</p>
        </div>
      </div>
    )
  }

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0)
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{messages.dashboard.todaysWorkout.toUpperCase()}</p>
            <h3 className="mt-1 text-2xl font-bold">{workout.name}</h3>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {workout.duration} {messages.dashboard.min}
              </span>
              <span>{workout.exercises.length} {messages.dashboard.exercises}</span>
            </div>
          </div>
          <Link href={`/workout/${workout.id}/start`}>
            <Button
              size="lg"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25"
            >
              <Play className="h-5 w-5" />
              {messages.dashboard.start}
            </Button>
          </Link>
        </div>

        {/* Progress indicator */}
        {completedSets > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{messages.dashboard.sessionProgress}</span>
              <span className="font-medium">
                {completedSets}/{totalSets} {locale === "en" ? "sets" : "set"}
              </span>
            </div>
            <Progress value={progress} className="mt-2 h-2" />
          </div>
        )}
      </div>

      {/* Exercise preview */}
      <div className="divide-y divide-border">
        {workout.exercises.slice(0, 3).map((ex, idx) => (
          <div key={ex.id} className="flex items-center gap-4 px-6 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-sm font-medium">
              {idx + 1}
            </div>
            <div className="flex-1">
              <p className="font-medium">{ex.exercise.name}</p>
              <p className="text-sm text-muted-foreground">
                {ex.sets.length} {locale === "en" ? "sets" : "set"} × {ex.sets[0]?.targetReps} reps
              </p>
            </div>
          </div>
        ))}
        {workout.exercises.length > 3 && (
          <div className="px-6 py-3 text-center text-sm text-muted-foreground">
            {messages.dashboard.moreExercises(workout.exercises.length - 3)}
          </div>
        )}
      </div>
    </div>
  )
}
