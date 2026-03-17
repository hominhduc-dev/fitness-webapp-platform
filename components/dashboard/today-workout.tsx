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
      <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)] sm:p-6">
        <h3 className="mb-4 text-lg font-bold tracking-tight text-slate-950">{messages.dashboard.todaysWorkout}</h3>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Dumbbell className="h-8 w-8 text-slate-500" />
          </div>
          <p className="mb-2 text-lg font-semibold text-slate-900">{messages.dashboard.restDay}</p>
          <p className="max-w-md text-sm leading-6 text-slate-500">{messages.dashboard.restDayCopy}</p>
        </div>
      </div>
    )
  }

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0)
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  return (
    <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)]">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f3fd5_0%,#1349ec_46%,#3b82f6_100%)] p-5 text-primary-foreground sm:p-6">
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/72">{messages.dashboard.todaysWorkout}</p>
            <h3 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{workout.name}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/78">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {workout.duration} {messages.dashboard.min}
              </span>
              <span>{workout.exercises.length} {messages.dashboard.exercises}</span>
            </div>
          </div>
          <Link href={`/workout/${workout.id}/start`} className="w-full sm:w-auto sm:shrink-0">
            <Button
              size="lg"
              className="w-full gap-2 rounded-2xl bg-white text-primary font-semibold shadow-[0_20px_45px_-26px_rgba(15,23,42,0.35)] hover:bg-white/95 sm:w-auto"
            >
              <Play className="h-5 w-5" />
              {messages.dashboard.start}
            </Button>
          </Link>
        </div>

        {completedSets > 0 && (
          <div className="relative mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/72">{messages.dashboard.sessionProgress}</span>
              <span className="font-medium">
                {completedSets}/{totalSets} {locale === "en" ? "sets" : "set"}
              </span>
            </div>
            <Progress value={progress} className="mt-2 h-2.5 bg-white/20 [&_[data-slot=progress-indicator]]:bg-white" />
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {workout.exercises.slice(0, 3).map((ex, idx) => (
          <div key={ex.id} className="flex items-center gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-3.5 py-3 sm:gap-4 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-700 shadow-sm">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-slate-900">{ex.exercise.name}</p>
              <p className="text-sm text-slate-500">
                {ex.sets.length} {locale === "en" ? "sets" : "set"} × {ex.sets[0]?.targetReps} reps
              </p>
            </div>
          </div>
        ))}
        {workout.exercises.length > 3 && (
          <div className="px-2 pt-1 text-center text-sm text-slate-500">
            {messages.dashboard.moreExercises(workout.exercises.length - 3)}
          </div>
        )}
      </div>
    </div>
  )
}
