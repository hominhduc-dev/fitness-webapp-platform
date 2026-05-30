"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, Play, Plus, User } from "lucide-react"
import { useMemo, useState } from "react"

import { CreateWorkoutDialogLazy } from "@/components/workout/create-workout-dialog-lazy"
import { DeleteWorkoutButton } from "@/components/workout/delete-workout-button"
import { Button } from "@/components/ui/button"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { Workout, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"

type RoutineTag = "all" | "push" | "pull" | "legs" | "upper" | "lower" | "full"

type RoutinesWorkoutBoardProps = {
  historyLogs: WorkoutLog[]
  workouts: Workout[]
}

const FILTERS: RoutineTag[] = ["all", "push", "pull", "legs", "upper", "lower", "full"]

const TAG_DOT_COLOR: Record<Exclude<RoutineTag, "all">, string> = {
  full: "var(--ink-600)",
  legs: "var(--warning)",
  lower: "#1a8a8a",
  pull: "var(--success)",
  push: "var(--primary)",
  upper: "#7c5dff",
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function inferRoutineTag(workout: Workout): Exclude<RoutineTag, "all"> {
  if (workout.kind === "push" || workout.kind === "pull" || workout.kind === "legs") {
    return workout.kind
  }

  if (workout.kind === "full_body") {
    return "full"
  }

  const name = normalizeText(workout.name)
  if (name.includes("upper")) return "upper"
  if (name.includes("lower")) return "lower"
  if (name.includes("push")) return "push"
  if (name.includes("pull")) return "pull"
  if (name.includes("leg")) return "legs"
  if (name.includes("full")) return "full"

  const groups = new Set(workout.exercises.map((exercise) => normalizeText(exercise.exercise.muscleGroup)))
  const hasUpper = ["chest", "back", "shoulders", "arms", "biceps", "triceps"].some((group) => groups.has(group))
  const hasLower = ["legs", "quads", "hamstrings", "glutes", "calves"].some((group) => groups.has(group))

  if (hasUpper && hasLower) return "full"
  if (hasUpper) return "upper"
  if (hasLower) return "lower"

  return "full"
}

function getTagLabel(tag: RoutineTag) {
  return tag === "all" ? "All" : tag[0].toUpperCase() + tag.slice(1).replace("_", " ")
}

function getTotalSets(workout: Workout) {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}

function getLastUsed(workout: Workout, historyLogs: WorkoutLog[]) {
  const latestLog = historyLogs.find((log) => log.workout.id === workout.id)

  if (!latestLog) {
    return "never"
  }

  return formatRelativeCompact(latestLog.completedAt ?? latestLog.startedAt)
}

function formatRelativeCompact(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000))

  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return "last week"
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

function RoutineDot({ tag }: { tag: Exclude<RoutineTag, "all"> }) {
  return <span className="h-2.5 w-2.5 rounded-full" style={{ background: TAG_DOT_COLOR[tag] }} />
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-12 shrink-0 items-center gap-2 rounded-full border px-5 text-base font-semibold transition-colors sm:h-10 sm:px-4 sm:text-sm",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/25",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CreateRoutineButton({ workoutTemplates }: { workoutTemplates: Workout[] }) {
  return (
    <CreateWorkoutDialogLazy
      workoutTemplates={workoutTemplates}
      trigger={
        <Button className="h-12 w-full gap-3 rounded-[10px] bg-foreground px-6 text-base font-semibold text-background hover:bg-foreground/90 sm:h-10 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm">
          <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
          Create routine
        </Button>
      }
    />
  )
}

function RoutineCard({ historyLogs, workout }: { historyLogs: WorkoutLog[]; workout: Workout }) {
  const tag = inferRoutineTag(workout)
  const totalSets = getTotalSets(workout)
  const lastUsed = getLastUsed(workout, historyLogs)

  return (
    <article className="group flex min-h-[420px] flex-col gap-6 rounded-[18px] border border-border bg-card p-8 transition-colors hover:border-foreground/20 sm:min-h-[360px] sm:p-6 xl:p-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <RoutineDot tag={tag} />
              <span className="font-mono text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground sm:text-xs">
                {tag}
              </span>
            </span>
            {!workout.isPersonal ? (
              <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-muted px-2 py-1 font-mono text-sm font-semibold uppercase tracking-[0.08em] text-foreground/80 sm:text-[11px]">
                <User className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                from coach
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-xl">
            {workout.name}
          </h2>
          <p className="mt-3 max-w-[22ch] font-mono text-2xl leading-snug text-muted-foreground tnum sm:max-w-none sm:text-sm">
            {workout.exercises.length} exercises · {totalSets} sets · last {lastUsed}
          </p>
        </div>

        {workout.isPersonal ? (
          <CreateWorkoutDialogLazy
            workoutToEdit={workout}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Edit routine"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            }
          />
        ) : (
          <MoreHorizontal className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] bg-muted/45 px-6 py-5 font-mono text-[22px] leading-tight sm:gap-2 sm:px-4 sm:py-3 sm:text-sm">
        {workout.exercises.slice(0, 4).map((exercise) => {
          const firstSet = exercise.sets[0]
          const reps = formatRepTarget({
            reps: firstSet?.targetReps,
            repsMin: firstSet?.targetRepsMin,
          })

          return (
            <div key={exercise.id} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-foreground">
                {formatExerciseVariationLabel({
                  exerciseName: exercise.exercise.name,
                  isDefault: exercise.variation.isDefault,
                  variationName: exercise.variation.name,
                })}
              </span>
              <span className="shrink-0 text-muted-foreground tnum">
                {exercise.sets.length} × {reps}
                {firstSet?.weight ? ` · ${firstSet.weight}kg` : ""}
              </span>
            </div>
          )
        })}
        {workout.exercises.length > 4 ? (
          <p className="text-[22px] text-muted-foreground sm:text-xs">+ {workout.exercises.length - 4} more</p>
        ) : null}
      </div>

      <div className="mt-auto flex gap-4 sm:gap-2">
        <Link href={`/workout/${workout.id}/start`} className="min-w-0 flex-1">
          <Button className="h-14 w-full gap-3 rounded-[10px] bg-foreground text-lg font-semibold text-background hover:bg-foreground/90 sm:h-10 sm:text-sm" size="sm">
            <Play className="h-6 w-6 sm:h-4 sm:w-4" />
            Start
          </Button>
        </Link>
        {workout.isPersonal ? (
          <>
            <CreateWorkoutDialogLazy
              workoutToEdit={workout}
              trigger={
                <Button variant="outline" size="sm" className="h-14 gap-3 rounded-[10px] bg-transparent px-5 text-lg font-semibold sm:h-10 sm:gap-2 sm:px-3 sm:text-sm">
                  <Pencil className="h-6 w-6 sm:h-4 sm:w-4" />
                  Edit
                </Button>
              }
            />
            <DeleteWorkoutButton
              workoutId={workout.id}
              size="sm"
              variant="outline"
              className="h-14 rounded-[10px] bg-transparent sm:h-10"
              confirmTitle="Delete routine?"
              confirmDescription="This will remove the personal routine. Coach-assigned routines are not affected."
            />
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-14 gap-3 rounded-[10px] bg-transparent px-5 text-lg font-semibold sm:h-10 sm:gap-2 sm:px-3 sm:text-sm"
            aria-disabled="true"
          >
            <Pencil className="h-6 w-6 sm:h-4 sm:w-4" />
            Edit
          </Button>
        )}
      </div>
    </article>
  )
}

export function RoutinesWorkoutBoard({ historyLogs, workouts }: RoutinesWorkoutBoardProps) {
  const [filter, setFilter] = useState<RoutineTag>("all")
  const reusableWorkouts = useMemo(() => workouts.filter((workout) => !workout.scheduledDate), [workouts])
  const visibleWorkouts = useMemo(
    () => reusableWorkouts.filter((workout) => filter === "all" || inferRoutineTag(workout) === filter),
    [filter, reusableWorkouts],
  )

  return (
    <>
      <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:mb-7 sm:flex-row sm:items-end">
        <div>
          <span className="label-micro mb-5 block text-base sm:mb-2 sm:text-xs">Routines</span>
          <h1 className="text-5xl font-semibold leading-none tracking-normal text-foreground sm:text-[2.25rem]">
            {reusableWorkouts.length} saved.
          </h1>
        </div>
        <CreateRoutineButton workoutTemplates={reusableWorkouts} />
      </div>

      <div className="-mx-4 mb-10 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mb-6 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0">
        {FILTERS.map((tag) => (
          <FilterChip key={tag} active={filter === tag} onClick={() => setFilter(tag)}>
            {tag !== "all" ? <RoutineDot tag={tag} /> : null}
            {getTagLabel(tag)}
          </FilterChip>
        ))}
      </div>

      {visibleWorkouts.length > 0 ? (
        <div className="grid gap-7 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {visibleWorkouts.map((workout) => (
            <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No routines yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one or ask your coach to assign a routine.</p>
          <div className="mt-5 flex justify-center">
            <CreateRoutineButton workoutTemplates={reusableWorkouts} />
          </div>
        </div>
      )}
    </>
  )
}
