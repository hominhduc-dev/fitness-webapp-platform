"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useMemo } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { resolveCurrentWeekProgress } from "@/lib/fitness/program-week"
import type { TraineeProgram } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProgramGroupCardProps = {
  program: TraineeProgram
  workouts: Workout[]
}

/**
 * Summary tile for a multi-week program, standing in for the sessions it holds
 * so they stop scattering across the routine grid.
 *
 * `workouts` only ever holds the CURRENT week's sessions — the backend filters
 * by `weekIndex` before the board sees them — which is why the whole program
 * lives behind the detail page rather than expanding here.
 */
export function ProgramGroupCard({ program, workouts }: ProgramGroupCardProps) {
  const { messages } = useLocale()

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
    <Link
      href={`/workout/programs/${program.id}`}
      className="group flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-[10px] border border-border bg-card p-5 transition-colors duration-150 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[286px]"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Badge variant="micro" className="mb-2">
            {messages.workoutPage.programBadge}
          </Badge>
          <h2 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {program.name}
          </h2>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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

      <p className="mt-auto text-sm font-medium text-foreground">{messages.workoutPage.viewProgram}</p>
    </Link>
  )
}
