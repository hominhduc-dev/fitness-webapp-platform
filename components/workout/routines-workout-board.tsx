"use client"

import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { RoutineBuilderDialog } from "@/components/workout/routine-builder-dialog"
import { FilterChip } from "@/components/workout/filter-chip"
import { ProgramGroupCard } from "@/components/workout/program-group-card"
import { RoutineCard } from "@/components/workout/routine-card"
import { RoutineDot } from "@/components/workout/routine-dot"
import { RoutinesLoadingState } from "@/components/workout/routines-loading-state"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { getTagLabel, inferRoutineTag, type RoutineTag } from "@/lib/fitness/routine-tag"
import type { TraineeProgram } from "@/lib/fitness/types"
import type { WorkoutCollection } from "@/lib/fitness/types"
import { useWorkouts } from "@/lib/queries/workouts"
import type { Workout } from "@/lib/types"

type RoutinesWorkoutBoardProps = {
  initialData?: WorkoutCollection
}

type ProgramGroup = {
  program: TraineeProgram
  workouts: Workout[]
}

const FILTERS: RoutineTag[] = ["all", "push", "pull", "legs", "upper", "lower", "full"]
const EMPTY_PROGRAMS: TraineeProgram[] = []
const EMPTY_WORKOUTS: Workout[] = []

function CreateRoutineButton() {
  const { messages } = useLocale()

  return (
    <RoutineBuilderDialog
      trigger={
        <Button className="h-10 w-full justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto">
          <Plus className="h-4 w-4" />
          {messages.workoutPage.createRoutine}
        </Button>
      }
    />
  )
}

export function RoutinesWorkoutBoard({ initialData }: RoutinesWorkoutBoardProps = {}) {
  const workoutsQuery = useWorkouts(initialData)
  const data = workoutsQuery.data
  const historyLogs = data?.historyLogs ?? []
  const programs = data?.programs ?? EMPTY_PROGRAMS
  const workouts = data?.workouts ?? EMPTY_WORKOUTS
  const { messages } = useLocale()
  const [filter, setFilter] = useState<RoutineTag>("all")
  const matchesFilter = useMemo(
    () => (workout: Workout) => filter === "all" || inferRoutineTag(workout) === filter,
    [filter],
  )
  const reusableWorkouts = useMemo(() => workouts.filter((workout) => !workout.scheduledDate), [workouts])
  const visibleWorkouts = useMemo(() => reusableWorkouts.filter(matchesFilter), [matchesFilter, reusableWorkouts])

  /**
   * Sessions pinned to a single date rather than to a weekday.
   *
   * They used to be filtered out of this board entirely, which left a routine a
   * trainee created for one date with nowhere to be edited or deleted: the card
   * that carries those two buttons only exists here. Newest first, because the
   * one just created is the one being looked for.
   */
  const datedWorkouts = useMemo(
    () =>
      workouts
        .filter((workout) => workout.scheduledDate && matchesFilter(workout))
        .sort((left, right) => new Date(right.scheduledDate!).getTime() - new Date(left.scheduledDate!).getTime()),
    [matchesFilter, workouts],
  )

  // A personal routine is wrapped in a synthetic one-week program by
  // `createPersonalWorkoutForTrainee`, and only that wrapper should scatter
  // into loose cards. Authorship cannot be the test: a trainee also authors the
  // AI program they accepted, and that is a plan like a coach's.
  const programById = useMemo(
    () => new Map(programs.filter((program) => !program.isStandaloneRoutine).map((program) => [program.id, program])),
    [programs],
  )

  const { programGroups, standaloneWorkouts } = useMemo(() => {
    // Seeded with every assigned program, so one that serves no session this
    // week — it starts later, or it has finished — still has a card saying so
    // instead of vanishing from the board. A tag filter is a search, though, so
    // it may only narrow what is already here.
    const groups = new Map<string, ProgramGroup>(
      filter === "all"
        ? Array.from(programById.values()).map((program) => [program.id, { program, workouts: [] }] as const)
        : [],
    )
    const standalone: Workout[] = []

    visibleWorkouts.forEach((workout) => {
      const program = workout.programId ? programById.get(workout.programId) : undefined

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
  }, [filter, programById, visibleWorkouts])

  // The heading sits directly above the grid, so it counts what is actually
  // rendered: one entry per program card, each standalone routine, and each
  // one-off below them.
  const cardCount = programGroups.length + standaloneWorkouts.length + datedWorkouts.length

  if (workoutsQuery.isPending && !data) {
    return <RoutinesLoadingState />
  }

  if (workoutsQuery.isError && !data) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-4 text-center">
        <p className="text-sm text-destructive-text">{messages.workoutPage.loadRoutinesError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void workoutsQuery.refetch()}>
          {messages.common.tryAgain}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex flex-col items-start justify-between gap-3.5 sm:mb-7 sm:flex-row sm:items-end" data-tour="trainee-workout-today">
        <div>
          <span className="label-micro mb-2 block">{messages.workoutPage.routines}</span>
          <h1 className="text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-4xl">
            {messages.workoutPage.savedRoutines(cardCount)}
          </h1>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row" data-tour="trainee-workout-actions">
          <Link href="/workout/ai-generate" className="min-w-0 sm:w-auto">
            <Button variant="outline" className="h-10 w-full justify-center gap-2 rounded-lg px-4 text-sm font-semibold sm:w-auto">
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

      {programGroups.length + standaloneWorkouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3" data-tour="trainee-workout-list">
          {programGroups.map((group) => (
            <ProgramGroupCard key={group.program.id} program={group.program} workouts={group.workouts} />
          ))}
          {standaloneWorkouts.map((workout) => (
            <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
          ))}
        </div>
      ) : null}

      {datedWorkouts.length > 0 ? (
        <section className={programGroups.length + standaloneWorkouts.length > 0 ? "mt-8" : undefined}>
          <div className="mb-3.5">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              {messages.workoutPage.oneOffSessions}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{messages.workoutPage.oneOffSessionsCopy}</p>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3" data-tour={programGroups.length + standaloneWorkouts.length > 0 ? undefined : "trainee-workout-list"}>
            {datedWorkouts.map((workout) => (
              <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
            ))}
          </div>
        </section>
      ) : null}

      {cardCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center" data-tour="trainee-workout-list">
          <p className="text-sm font-medium text-foreground">{messages.workoutPage.noRoutinesTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{messages.workoutPage.noRoutinesCopy}</p>
          <div className="mt-5 flex justify-center">
            <CreateRoutineButton />
          </div>
        </div>
      ) : null}
    </>
  )
}
