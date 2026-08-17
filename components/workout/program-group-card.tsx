"use client"

import Link from "next/link"
import { ChevronDown, Play } from "lucide-react"
import { useMemo, useState } from "react"

import { RoutineDot } from "@/components/workout/routine-dot"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { resolveCurrentWeekProgress } from "@/lib/fitness/program-week"
import { getTotalSets, inferRoutineTag } from "@/lib/fitness/routine-tag"
import type { TraineeProgram } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProgramGroupCardProps = {
  program: TraineeProgram
  workouts: Workout[]
}

/**
 * One card per multi-week program, mirroring the coach-side ProgramCard: the
 * sessions collapse into a single container instead of scattering across the
 * routine grid.
 *
 * `workouts` only ever holds the CURRENT week's sessions — the backend filters
 * by `weekIndex` in `isWorkoutVisibleForAssignmentWeek` before the board ever
 * sees them — so the expanded list is this week's plan, not the whole program.
 */
export function ProgramGroupCard({ program, workouts }: ProgramGroupCardProps) {
  const { messages } = useLocale()
  const [isOpen, setIsOpen] = useState(false)

  const progress = useMemo(
    () => resolveCurrentWeekProgress(program.assignedAt, program.duration),
    [program.assignedAt, program.duration],
  )

  const isCompleted = progress?.kind === "completed"
  // `not-started` and an unparseable assignedAt both read as week 1 — the
  // program exists and has sessions, so showing "week 0" would be wrong.
  const currentWeek = progress?.kind === "active" ? progress.weekIndex + 1 : isCompleted ? program.duration : 1
  const percent = isCompleted ? 100 : Math.round((currentWeek / Math.max(1, program.duration)) * 100)

  return (
    <article className="flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-[10px] border border-border bg-card p-5 transition-colors duration-150 hover:border-foreground/20">
      <div className="min-w-0">
        <Badge variant="micro" className="mb-2">
          {messages.workoutPage.programBadge}
        </Badge>
        <h2 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {program.name}
        </h2>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs leading-snug text-muted-foreground tnum">
          <span className={cn(isCompleted && "text-foreground")}>
            {isCompleted
              ? messages.workoutPage.programCompleted
              : messages.workoutPage.weekProgress(currentWeek, program.duration)}
          </span>
          <span>{messages.workoutPage.sessionsThisWeek(workouts.length)}</span>
        </div>
        <Progress value={percent} />
      </div>

      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 pointer-coarse:h-11 w-full items-center justify-between gap-2 rounded-[8px] border border-border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{isOpen ? messages.workoutPage.collapseProgram : messages.workoutPage.expandProgram}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
      </button>

      {isOpen ? (
        <div className="flex min-w-0 flex-col gap-2">
          {workouts.map((workout) => {
            const tag = inferRoutineTag(workout)

            return (
              <div
                key={workout.id}
                className="flex min-w-0 flex-col gap-2 rounded-[8px] bg-muted/45 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <RoutineDot tag={tag} />
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{workout.name}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] leading-snug text-muted-foreground tnum">
                    {messages.workoutPage.exerciseCount(workout.exercises.length)} ·{" "}
                    {messages.workoutPage.setCount(getTotalSets(workout))}
                  </p>
                </div>
                <Link href={`/workout/${workout.id}/start`} className="shrink-0">
                  <Button
                    size="sm"
                    className="h-9 pointer-coarse:h-10 w-full justify-center gap-1.5 rounded-[8px] bg-foreground text-sm font-semibold text-background hover:bg-foreground/90 sm:w-auto"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {messages.workoutPage.start}
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}
