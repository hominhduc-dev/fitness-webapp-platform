"use client"

import Link from "next/link"
import type { ActiveWorkoutSession } from "@/lib/workout/session-storage"
import { useActiveWorkoutSessionList } from "@/lib/workout/use-active-workout-sessions"
import { ChevronRight, Clock, Dumbbell, Layers, Minus, Moon, Play, TrendingDown, TrendingUp } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { WorkoutSessionLink } from "@/components/workout/workout-session-link"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { TrainingRecommendation } from "@/lib/fitness/types"
import { useTrainingRecommendation } from "@/lib/queries/progress"
import type { Workout } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"

type ExerciseRecommendation = NonNullable<TrainingRecommendation["workout"]>["exercises"][number]

const DAY_TONE: Record<TrainingRecommendation["day"]["action"], string> = {
  light_session: "bg-warning-soft text-warning-text",
  proceed: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success-text",
  reduce_volume: "bg-warning-soft text-warning-text",
  rest: "bg-destructive/10 text-destructive-text",
}

function direction(action: ExerciseRecommendation["action"]) {
  if (action === "add_load" || action === "add_reps") return "up" as const
  if (action === "reduce_load") return "down" as const
  return "hold" as const
}

/** Today's adjusted target for an exercise: "82.5×8", or the first set's with "…" when sets differ. */
function adjustedTarget(recommendation: ExerciseRecommendation) {
  const [first] = recommendation.sets
  if (!first) return null
  const label = first.weight != null ? `${first.weight}×${first.reps}` : `${first.reps}`
  return recommendation.sets.every((set) => set.weight === first.weight && set.reps === first.reps) ? label : `${label}…`
}

interface TodayWorkoutProps {
  workout: Workout | null
  completed?: boolean
  activeSessions?: ActiveWorkoutSession[]
  preferActiveSession?: boolean
  workouts?: Workout[]
}

export function TodayWorkout({ activeSessions, workout: scheduledWorkout, completed = false, preferActiveSession = true, workouts = [] }: TodayWorkoutProps) {
  const activeSessionList = useActiveWorkoutSessionList(activeSessions)
  const activeId = preferActiveSession ? activeSessionList.sessions[0]?.workoutId ?? null : null
  const activeWorkout = workouts.find((item) => item.id === activeId)
  const workout = activeWorkout ?? scheduledWorkout
  const isCompleted = !activeWorkout && completed
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const { messages } = useLocale()
  const copy = messages.dashboard
  const recommendationQuery = useTrainingRecommendation()
  const recommendation = recommendationQuery.data
  const planCopy = messages.trainingRecommendation

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
  // The coach's plan, adjusted: the server reconciles today's readiness, the
  // week's muscle volume and each exercise's history into one target per
  // exercise. Only applied to the workout it was computed for — an active
  // session on another workout shows its plan as programmed.
  const plan = recommendation?.workout?.id === workout.id ? recommendation.workout : null
  const adjustments = new Map(
    (plan?.exercises ?? []).flatMap((exercise) =>
      exercise.workoutExerciseId && exercise.action !== "establish_baseline" ? [[exercise.workoutExerciseId, exercise] as const] : [],
    ),
  )
  const muscleLabels = messages.volumeRecovery.muscleLabels
  const phase = recommendation?.intensity.phase ? planCopy.phase[recommendation.intensity.phase] ?? recommendation.intensity.phase : null

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

      {recommendation && !isCompleted ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", DAY_TONE[recommendation.day.action])}>
            {planCopy.day[recommendation.day.action]}
            {recommendation.day.setAdjustmentPct !== 0 && recommendation.day.action !== "rest"
              ? ` · ${planCopy.setAdjustment(recommendation.day.setAdjustmentPct)}`
              : ""}
          </span>
          {phase || recommendation.intensity.targetRir != null ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {[phase, recommendation.intensity.targetRir != null ? planCopy.targetRir(recommendation.intensity.targetRir) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}

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

      {/* Phones keep the card short unless there is an adjusted target to show. */}
      <ul className={cn("mt-4 min-w-0 space-y-2", adjustments.size === 0 && "hidden md:block")}>
        {workout.exercises.slice(0, 4).map((exercise) => {
          const adjustment = isCompleted ? undefined : adjustments.get(exercise.id)
          const target = adjustment ? adjustedTarget(adjustment) : null
          const trend = adjustment ? direction(adjustment.action) : null
          const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
          const muscleLabel = adjustment?.muscleSlug
            ? muscleLabels[adjustment.muscleSlug as keyof typeof muscleLabels] ?? adjustment.muscleSlug
            : null
          const why = adjustment?.heldBy === "day"
            ? planCopy.heldByDay
            : adjustment && (adjustment.heldBy === "muscle" || adjustment.setDelta !== 0) && muscleLabel
              ? planCopy.heldByMuscle(muscleLabel.toLowerCase())
              : null

          return (
            <li key={exercise.id} className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm leading-5 text-foreground">
                  {formatExerciseVariationLabel({
                    displayName: exercise.variation.displayName,
                    exerciseName: exercise.exercise.name,
                    isDefault: exercise.variation.isDefault,
                    variationName: exercise.variation.name,
                  })}
                </span>
                {adjustment ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {planCopy.exercise[adjustment.action]}
                    {why ? ` · ${why}` : ""}
                  </span>
                ) : null}
              </span>
              {adjustment && target ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  {adjustment.setDelta !== 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px font-mono text-[10px] font-semibold tnum",
                        adjustment.setDelta > 0 ? "bg-primary/10 text-primary" : "bg-warning-soft text-warning-text",
                      )}
                    >
                      {planCopy.setDelta(adjustment.setDelta)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-mono text-sm font-semibold tnum",
                      trend === "up" && "text-success-text",
                      trend === "down" && "text-warning-text",
                      trend === "hold" && "text-foreground",
                    )}
                  >
                    <TrendIcon className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                    {target}
                  </span>
                </span>
              ) : (
                <span className="shrink-0 font-mono text-xs font-medium tnum text-muted-foreground">
                  {exercise.sets.length}×{formatRepTarget({
                    reps: exercise.sets[0]?.targetReps,
                    repsMin: exercise.sets[0]?.targetRepsMin,
                  })}
                </span>
              )}
            </li>
          )
        })}
        {workout.exercises.length > 4 ? (
          <li className="label-micro pt-1">{copy.moreExercises(workout.exercises.length - 4)}</li>
        ) : null}
      </ul>

      <Button asChild size="lg" className="dashboard-primary-cta mt-4 h-10 w-full gap-2 rounded-xl text-sm lg:mt-auto">
        {isCompleted ? (
          <Link href="/schedule" scroll>
            <Play className="size-4 fill-current" aria-hidden="true" />
            {messages.schedule.review}
          </Link>
        ) : (
          <WorkoutSessionLink href={`/workout/${workout.id}/start${activeWorkout ? '' : `?logDate=${dateKey}`}`} scroll>
            <Play className="size-4 fill-current" aria-hidden="true" />
            {activeWorkout ? messages.schedule.resume : copy.startWorkout}
          </WorkoutSessionLink>
        )}
      </Button>
    </section>
  )
}
