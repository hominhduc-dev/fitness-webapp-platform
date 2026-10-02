"use client"

import Link from "next/link"
import { ChevronRight, Minus, Play, TrendingDown, TrendingUp } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrainingRecommendation } from "@/lib/fitness/types"
import { useTrainingRecommendation } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

type ExerciseRecommendation = NonNullable<TrainingRecommendation["workout"]>["exercises"][number]

const VISIBLE_EXERCISES = 4

const DAY_TONE: Record<TrainingRecommendation["day"]["action"], string> = {
  light_session: "bg-warning-soft text-warning-text",
  proceed: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success-text",
  reduce_volume: "bg-warning-soft text-warning-text",
  rest: "bg-destructive/10 text-destructive-text",
}

function exerciseDirection(action: ExerciseRecommendation["action"]) {
  if (action === "add_load" || action === "add_reps") return "up" as const
  if (action === "reduce_load") return "down" as const
  return "hold" as const
}

/** "82.5×8" when every set shares a target, else the first set's with a "+". */
function targetText(exercise: ExerciseRecommendation) {
  const [first] = exercise.sets
  if (!first) return null
  const label = first.weight != null ? `${first.weight}×${first.reps}` : `${first.reps}`
  const same = exercise.sets.every((set) => set.weight === first.weight && set.reps === first.reps)
  return same ? label : `${label}…`
}

function ExerciseRow({ exercise }: { exercise: ExerciseRecommendation }) {
  const { messages } = useLocale()
  const copy = messages.trainingRecommendation
  const direction = exerciseDirection(exercise.action)
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus
  const target = targetText(exercise)
  const muscleLabel = exercise.muscleSlug
    ? messages.volumeRecovery.muscleLabels[exercise.muscleSlug as keyof typeof messages.volumeRecovery.muscleLabels] ?? exercise.muscleSlug
    : null
  const why = exercise.heldBy === "day"
    ? copy.heldByDay
    : (exercise.heldBy === "muscle" || exercise.setDelta !== 0) && muscleLabel
      ? copy.heldByMuscle(muscleLabel.toLowerCase())
      : null

  return (
    <li className="flex min-w-0 items-center gap-2.5 py-2">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          direction === "up" && "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success-text",
          direction === "down" && "bg-warning-soft text-warning-text",
          direction === "hold" && "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{exercise.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {copy.exercise[exercise.action]}
          {why ? ` · ${why}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {target ? <span className="font-mono text-sm font-semibold tnum text-foreground">{target}</span> : null}
        {exercise.setDelta !== 0 ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-px font-mono text-[10px] font-semibold tnum",
              exercise.setDelta > 0 ? "bg-primary/10 text-primary" : "bg-warning-soft text-warning-text",
            )}
          >
            {copy.setDelta(exercise.setDelta)}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/**
 * One place that answers "what do I do today": the day's guidance, each
 * exercise's reconciled progression and the muscles whose weekly volume should
 * change. The server has already reconciled the three, so nothing here can
 * contradict the session screen.
 */
export function TrainingRecommendationCard() {
  const { messages } = useLocale()
  const copy = messages.trainingRecommendation
  const query = useTrainingRecommendation()

  if (query.isPending) return <Skeleton className="h-44 rounded-2xl" />
  if (!query.data) return null

  const { day, intensity, muscles, workout } = query.data
  const exercises = workout?.exercises ?? []
  const visible = exercises.slice(0, VISIBLE_EXERCISES)
  const hidden = exercises.length - visible.length
  const phase = intensity.phase ? copy.phase[intensity.phase] ?? intensity.phase : null

  return (
    <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="training-recommendation-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="training-recommendation-title" className="label-micro mr-auto text-muted-foreground">{copy.title}</h2>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", DAY_TONE[day.action])}>
          {copy.day[day.action]}
          {day.setAdjustmentPct !== 0 && day.action !== "rest" ? ` · ${copy.setAdjustment(day.setAdjustmentPct)}` : ""}
        </span>
        {phase || intensity.targetRir != null ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {[phase, intensity.targetRir != null ? copy.targetRir(intensity.targetRir) : null].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>

      {workout ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{workout.name}</p>
            {workout.isCompleted ? (
              <span className="text-xs font-medium text-success-text">{copy.completed}</span>
            ) : day.action !== "rest" ? (
              <Link
                href={`/workout/${workout.id}/start`}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 pointer-coarse:min-h-11"
              >
                <Play className="size-3.5" aria-hidden="true" />
                {copy.startWorkout}
              </Link>
            ) : null}
          </div>
          {visible.length > 0 ? (
            <ul className="mt-1 divide-y divide-border">
              {visible.map((exercise) => <ExerciseRow key={exercise.name} exercise={exercise} />)}
            </ul>
          ) : null}
          {hidden > 0 ? (
            <Link
              href={`/workout/${workout.id}/start`}
              className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              {copy.moreExercises(hidden)}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{copy.noWorkout}</p>
      )}

      {muscles.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">{copy.weeklyVolume}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {muscles.map((muscle) => (
              <span
                key={muscle.muscleSlug}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium tnum",
                  muscle.action === "increase" ? "bg-primary/10 text-primary" : "bg-warning-soft text-warning-text",
                )}
              >
                {messages.volumeRecovery.muscleLabels[muscle.muscleSlug as keyof typeof messages.volumeRecovery.muscleLabels] ?? muscle.muscleSlug}
                {" "}
                {copy.muscle[muscle.action]} {muscle.currentSets}→{muscle.recommendedSets}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
