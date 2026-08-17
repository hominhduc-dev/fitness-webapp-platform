"use client"

import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { RoutineBuilderDialog } from "@/components/workout/routine-builder-dialog"
import { FilterChip } from "@/components/workout/filter-chip"
import { ProgramGroupCard } from "@/components/workout/program-group-card"
import { RoutineCard } from "@/components/workout/routine-card"
import { RoutineDot } from "@/components/workout/routine-dot"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { getTagLabel, inferRoutineTag, type RoutineTag } from "@/lib/fitness/routine-tag"
import type { TraineeProgram } from "@/lib/fitness/types"
import type { Workout, WorkoutLog } from "@/lib/types"

type RoutinesWorkoutBoardProps = {
  historyLogs: WorkoutLog[]
  programs: TraineeProgram[]
  workouts: Workout[]
}

type ProgramGroup = {
  program: TraineeProgram
  workouts: Workout[]
}

const FILTERS: RoutineTag[] = ["all", "push", "pull", "legs", "upper", "lower", "full"]

function CreateRoutineButton() {
  const { messages } = useLocale()

  return (
    <RoutineBuilderDialog
      trigger={
        <Button className="h-10 w-full justify-center gap-2 rounded-[8px] bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 sm:w-auto">
          <Plus className="h-4 w-4" />
          {messages.workoutPage.createRoutine}
        </Button>
      }
    />
  )
}

export function RoutinesWorkoutBoard({ historyLogs, programs, workouts }: RoutinesWorkoutBoardProps) {
  const { messages } = useLocale()
  const [filter, setFilter] = useState<RoutineTag>("all")
  const reusableWorkouts = useMemo(() => workouts.filter((workout) => !workout.scheduledDate), [workouts])
  const visibleWorkouts = useMemo(
    () => reusableWorkouts.filter((workout) => filter === "all" || inferRoutineTag(workout) === filter),
    [filter, reusableWorkouts],
  )

  // A personal routine is wrapped in a synthetic one-week program by
  // `createPersonalWorkoutForTrainee`, so `duration > 1` is what separates a real
  // multi-week program from a standalone routine.
  const multiWeekById = useMemo(
    () => new Map(programs.filter((program) => program.duration > 1).map((program) => [program.id, program])),
    [programs],
  )

  const { programGroups, standaloneWorkouts } = useMemo(() => {
    const groups = new Map<string, ProgramGroup>()
    const standalone: Workout[] = []

    visibleWorkouts.forEach((workout) => {
      const program = workout.programId ? multiWeekById.get(workout.programId) : undefined

      if (!program) {
        standalone.push(workout)
        return
      }

      const group = groups.get(program.id)

      if (group) {
        group.workouts.push(workout)
        return
      }

      groups.set(program.id, { program, workouts: [workout] })
    })

    return { programGroups: Array.from(groups.values()), standaloneWorkouts: standalone }
  }, [multiWeekById, visibleWorkouts])

  // The heading sits directly above the grid, so it counts what is actually
  // rendered: one entry per program card plus each standalone routine.
  const cardCount = programGroups.length + standaloneWorkouts.length

  return (
    <>
      <div className="mb-5 flex flex-col items-start justify-between gap-3.5 sm:mb-7 sm:flex-row sm:items-end">
        <div>
          <span className="label-micro mb-2 block">{messages.workoutPage.routines}</span>
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-[36px]">
            {messages.workoutPage.savedRoutines(cardCount)}
          </h1>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/workout/ai-generate" className="min-w-0 sm:w-auto">
            <Button variant="outline" className="h-10 w-full justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold sm:w-auto">
              <Sparkles className="h-4 w-4" />
              {messages.workoutPage.aiCreateWorkout}
            </Button>
          </Link>
          <CreateRoutineButton />
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-6 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((tag) => (
          <FilterChip key={tag} active={filter === tag} onClick={() => setFilter(tag)}>
            {tag !== "all" ? <RoutineDot tag={tag} /> : null}
            {getTagLabel(tag, messages)}
          </FilterChip>
        ))}
      </div>

      {cardCount > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {programGroups.map((group) => (
            <ProgramGroupCard key={group.program.id} program={group.program} workouts={group.workouts} />
          ))}
          {standaloneWorkouts.map((workout) => (
            <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">{messages.workoutPage.noRoutinesTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.workoutPage.noRoutinesCopy}</p>
          <div className="mt-5 flex justify-center">
            <CreateRoutineButton />
          </div>
        </div>
      )}
    </>
  )
}
