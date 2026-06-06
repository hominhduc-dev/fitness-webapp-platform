"use client"

import { ArrowDownNarrowWide, CheckCircle2, ChevronDown, ChevronUp, Edit3, TrendingUp } from "lucide-react"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { CoachUpdate, Workout, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"

function formatDateTime(value: Date, locale: string) {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    weekday: "short",
  })
}

function formatDuration(log: WorkoutLog) {
  const endTime = log.completedAt ?? log.startedAt
  return Math.max(1, Math.round((endTime.getTime() - log.startedAt.getTime()) / 60_000))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value))
}

function formatMetric(value: number | string | undefined, suffix = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}${suffix}`
  }

  if (typeof value === "string" && value.trim()) {
    return `${value}${suffix}`
  }

  return "--"
}

function calculateSetVolume(set: WorkoutLog["exercises"][number]["sets"][number]) {
  if (!set.completed || set.weight == null) return undefined

  const reps = set.actualReps ?? set.targetReps
  return Number.isFinite(reps) ? Number((set.weight * reps).toFixed(1)) : undefined
}

function countTotalSets(log: WorkoutLog) {
  return log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}

function countCompletedSets(log: WorkoutLog) {
  return log.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0)
}

function countCompletedExerciseSets(exercise: WorkoutLog["exercises"][number]) {
  return exercise.sets.filter((set) => set.completed).length
}

function getCoachUpdateMeta(type: CoachUpdate["type"]) {
  switch (type) {
    case "weight_up":
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
        icon: TrendingUp,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--success)_8%,transparent)]",
        textClassName: "text-success",
      }
    case "rir_down":
    case "weight_down":
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]",
        icon: ArrowDownNarrowWide,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--warning)_8%,transparent)]",
        textClassName: "text-warning",
      }
    case "rir_up":
    case "edit":
    default:
      return {
        buttonBgClassName: "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
        hoverClassName: "hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]",
        icon: Edit3,
        panelBgClassName: "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
        textClassName: "text-primary",
      }
  }
}

export function WorkoutLogReview({ log }: { log: WorkoutLog }) {
  const { locale } = useLocale()
  const completedSets = countCompletedSets(log)
  const totalSets = countTotalSets(log)
  const totalVolume = log.totalVolume ?? log.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + (calculateSetVolume(set) ?? 0), 0),
    0,
  )

  return (
    <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Started", value: formatDateTime(log.startedAt, locale) },
          { label: "Duration", value: `${formatDuration(log)}m` },
          { label: "Sets", value: `${completedSets}/${totalSets}` },
          { label: "Volume", value: `${formatNumber(totalVolume)} kg` },
        ].map((item) => (
          <div key={item.label} className="rounded-[8px] border border-border bg-muted/20 px-3 py-2.5">
            <p className="label-micro text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-mono text-[13px] font-medium leading-tight text-foreground tnum">{item.value}</p>
          </div>
        ))}
      </div>

      {log.notes ? (
        <div className="mt-4 rounded-[8px] border border-border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
          {log.notes}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {log.exercises.map((exercise) => {
          const exerciseVolume = exercise.sets.reduce((sum, set) => sum + (calculateSetVolume(set) ?? 0), 0)

          return (
            <section key={exercise.id} className="rounded-[10px] border border-border bg-card">
              <div className="border-b border-border px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {formatExerciseVariationLabel({
                        exerciseName: exercise.exercise.name,
                        isDefault: exercise.variation.isDefault,
                        variationName: exercise.variation.name,
                      })}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exercise.exercise.muscleGroup}
                      {exercise.restTime ? ` · Rest ${exercise.restTime}s` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {countCompletedExerciseSets(exercise)}/{exercise.sets.length} sets
                    </span>
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {formatNumber(exerciseVolume)} kg
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Set</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                      <th className="px-3 py-2 font-medium">Actual</th>
                      <th className="px-3 py-2 font-medium">kg</th>
                      <th className="px-3 py-2 font-medium">RIR</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => (
                      <tr key={set.id} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-2.5 font-mono text-xs font-medium tnum">{set.setNumber}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatRepTarget({ reps: set.targetReps, repsMin: set.targetRepsMin })}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatMetric(set.actualReps)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatMetric(set.weight)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatMetric(set.rir)}
                        </td>
                        <td className="px-3 py-2.5">
                          {set.completed ? (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              Done
                            </span>
                          ) : (
                            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              --
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function WorkoutPlanPreview({ workout }: { workout: Workout }) {
  const [openUpdateIds, setOpenUpdateIds] = useState<Set<string>>(new Set())
  const toggleUpdate = (exerciseId: string) => {
    setOpenUpdateIds((current) => {
      const next = new Set(current)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
      } else {
        next.add(exerciseId)
      }
      return next
    })
  }

  return (
    <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="space-y-3">
        {workout.exercises.map((exercise) => {
          const coachUpdate = exercise.coachUpdate
          const coachUpdateMeta = coachUpdate ? getCoachUpdateMeta(coachUpdate.type) : null
          const CoachUpdateIcon = coachUpdateMeta?.icon
          const isUpdateOpen = openUpdateIds.has(exercise.id)

          return (
            <section key={exercise.id} className="rounded-[10px] border border-border bg-card">
              <div className="border-b border-border px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {formatExerciseVariationLabel({
                          exerciseName: exercise.exercise.name,
                          isDefault: exercise.variation.isDefault,
                          variationName: exercise.variation.name,
                        })}
                      </h3>
                      {coachUpdate && coachUpdateMeta && CoachUpdateIcon ? (
                        <button
                          type="button"
                          onClick={() => toggleUpdate(exercise.id)}
                          aria-label="Coach update"
                          aria-expanded={isUpdateOpen}
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-[5px] border-0 px-[7px] py-[3px]",
                            "font-mono text-[9.5px] font-semibold uppercase tracking-[0.07em]",
                            "transition-colors duration-150",
                            isUpdateOpen ? coachUpdateMeta.buttonBgClassName : "bg-muted/60",
                            coachUpdateMeta.textClassName,
                            coachUpdateMeta.hoverClassName,
                          )}
                        >
                          <CoachUpdateIcon className="h-[11px] w-[11px]" />
                          <span>Coach</span>
                          {isUpdateOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {exercise.exercise.muscleGroup}
                      {exercise.restTime ? ` · Rest ${exercise.restTime}s` : ""}
                    </p>
                    {coachUpdate && isUpdateOpen && coachUpdateMeta && CoachUpdateIcon ? (
                      <div className={cn("mt-2 flex items-start gap-1.5 rounded-[7px] px-2.5 py-[7px]", coachUpdateMeta.panelBgClassName)}>
                        <CoachUpdateIcon className={cn("mt-px h-[13px] w-[13px] shrink-0", coachUpdateMeta.textClassName)} />
                        <span className="text-[12.5px] leading-[1.4] text-foreground">{coachUpdate.text}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {exercise.sets.length} sets
                    </span>
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      Preview
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Set</th>
                      <th className="px-3 py-2 font-medium">Target</th>
                      <th className="px-3 py-2 font-medium">kg</th>
                      <th className="px-3 py-2 font-medium">RIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => (
                      <tr key={set.id} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-2.5 font-mono text-xs font-medium tnum">{set.setNumber}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatRepTarget({ reps: set.targetReps, repsMin: set.targetRepsMin })}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatMetric(set.weight)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground tnum">
                          {formatMetric(set.rir)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
