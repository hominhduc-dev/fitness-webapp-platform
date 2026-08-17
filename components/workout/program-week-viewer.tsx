"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useMemo, useState } from "react"

import { FilterChip } from "@/components/workout/filter-chip"
import { RoutineCard } from "@/components/workout/routine-card"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { clampWeeks, resolveCurrentWeekProgress } from "@/lib/fitness/program-week"
import type { CoachProgram } from "@/lib/fitness/types"
import type { Workout, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProgramWeekViewerProps = {
  assignedAt?: Date
  historyLogs: WorkoutLog[]
  program: CoachProgram
}

/**
 * Read-only week browser for a trainee's assigned program. The coach editor
 * covers the same ground but is an authoring tool bound to coach-only
 * endpoints, so this is a separate, much smaller view.
 */
export function ProgramWeekViewer({ assignedAt, historyLogs, program }: ProgramWeekViewerProps) {
  const { messages } = useLocale()
  const totalWeeks = clampWeeks(program.duration)

  const progress = useMemo(
    () => resolveCurrentWeekProgress(assignedAt, totalWeeks),
    [assignedAt, totalWeeks],
  )

  const currentWeekIndex =
    progress?.kind === "active" ? progress.weekIndex : progress?.kind === "completed" ? totalWeeks - 1 : 0

  // A missing weekIndex means "week 1" — that is how the AI generator stores a
  // program it expects to repeat, and it is also how older rows were written.
  const workoutsByWeek = useMemo(() => {
    const byWeek = new Map<number, Workout[]>()

    program.workouts.forEach((workout) => {
      const weekIndex = typeof workout.weekIndex === "number" ? workout.weekIndex : 0
      const bucket = byWeek.get(weekIndex)

      if (bucket) {
        bucket.push(workout)
        return
      }

      byWeek.set(weekIndex, [workout])
    })

    return byWeek
  }, [program.workouts])

  const [activeWeek, setActiveWeek] = useState(currentWeekIndex)
  const weekWorkouts = workoutsByWeek.get(activeWeek) ?? []
  const isCompleted = progress?.kind === "completed"
  const percent = isCompleted ? 100 : Math.round(((currentWeekIndex + 1) / totalWeeks) * 100)

  return (
    <>
      <Link
        href="/workout"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {messages.workoutPage.backToRoutines}
      </Link>

      <div className="mb-5 sm:mb-7">
        <Badge variant="micro" className="mb-2">
          {messages.workoutPage.programBadge}
        </Badge>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[36px]">
          {program.name}
        </h1>
        {program.description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
        ) : null}
        <div className="mt-2.5 max-w-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted-foreground tnum">
            <span className={cn(isCompleted && "text-foreground")}>
              {isCompleted
                ? messages.workoutPage.programCompleted
                : messages.workoutPage.weekProgress(currentWeekIndex + 1, totalWeeks)}
            </span>
            <span>{messages.workoutPage.sessionCount(program.workouts.length)}</span>
          </div>
          <Progress value={percent} />
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-6 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: totalWeeks }, (_value, weekIndex) => (
          <FilterChip
            key={weekIndex}
            active={activeWeek === weekIndex}
            onClick={() => setActiveWeek(weekIndex)}
            className={cn(
              weekIndex === currentWeekIndex && activeWeek !== weekIndex && "border-foreground/40",
              weekIndex < currentWeekIndex && activeWeek !== weekIndex && "text-muted-foreground",
            )}
          >
            {messages.workoutPage.weekShort(weekIndex + 1)}
            {weekIndex === currentWeekIndex ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            ) : null}
          </FilterChip>
        ))}
      </div>

      {weekWorkouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {weekWorkouts.map((workout) => (
            <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">{messages.workoutPage.emptyWeekTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.workoutPage.emptyWeekCopy}</p>
        </div>
      )}
    </>
  )
}
