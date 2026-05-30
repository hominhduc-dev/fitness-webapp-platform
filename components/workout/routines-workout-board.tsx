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
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TAG_DOT_COLOR[tag] }} />
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
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors",
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
        <Button className="h-10 w-full gap-2 rounded-[8px] bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90 sm:w-auto">
          <Plus className="h-4 w-4" />
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
    <article className="group flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-[10px] border border-border bg-card p-5 transition-colors duration-150 hover:border-foreground/20 sm:min-h-[286px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <RoutineDot tag={tag} />
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {tag}
              </span>
            </span>
            {!workout.isPersonal ? (
              <span className="inline-flex items-center gap-1 rounded-[3px] bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-foreground/80">
                <User className="h-2.5 w-2.5" />
                from coach
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {workout.name}
          </h2>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs leading-snug text-muted-foreground tnum">
            <span>{workout.exercises.length} exercises</span>
            <span>{totalSets} sets</span>
            <span>last {lastUsed}</span>
          </div>
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
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-[8px] bg-muted/45 px-3 py-2.5 font-mono text-xs leading-tight">
        {workout.exercises.slice(0, 4).map((exercise) => {
          const firstSet = exercise.sets[0]
          const reps = formatRepTarget({
            reps: firstSet?.targetReps,
            repsMin: firstSet?.targetRepsMin,
          })

          return (
            <div key={exercise.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
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
        {workout.exercises.length > 4 ? <p className="text-[11px] text-muted-foreground">+ {workout.exercises.length - 4} more</p> : null}
      </div>

      <div className="mt-auto flex gap-2">
        <Link href={`/workout/${workout.id}/start`} className="min-w-0 flex-1">
          <Button className="h-10 w-full justify-center gap-2 rounded-[8px] bg-foreground text-sm font-semibold text-background hover:bg-foreground/90" size="sm">
            <Play className="h-4 w-4" />
            Start
          </Button>
        </Link>
        {workout.isPersonal ? (
          <>
            <CreateWorkoutDialogLazy
              workoutToEdit={workout}
              trigger={
                <Button variant="outline" size="sm" className="h-10 gap-2 rounded-[8px] bg-transparent px-3 text-sm font-medium">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              }
            />
            <DeleteWorkoutButton
              workoutId={workout.id}
              size="sm"
              variant="outline"
              className="h-10 rounded-[8px] bg-transparent"
              confirmTitle="Delete routine?"
              confirmDescription="This will remove the personal routine. Coach-assigned routines are not affected."
            />
          </>
        ) : null}
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
      <div className="mb-5 flex flex-col items-start justify-between gap-3.5 sm:mb-7 sm:flex-row sm:items-end">
        <div>
          <span className="label-micro mb-2 block">Routines</span>
          <h1 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-[36px]">
            {reusableWorkouts.length} saved.
          </h1>
        </div>
        <CreateRoutineButton workoutTemplates={reusableWorkouts} />
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-6 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((tag) => (
          <FilterChip key={tag} active={filter === tag} onClick={() => setFilter(tag)}>
            {tag !== "all" ? <RoutineDot tag={tag} /> : null}
            {getTagLabel(tag)}
          </FilterChip>
        ))}
      </div>

      {visibleWorkouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
