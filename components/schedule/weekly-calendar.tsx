"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, isBefore, isSameDay, isToday, startOfDay, startOfWeek } from "date-fns"
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Loader2, MessageSquare, Play, Plus, Search, Trash2, User } from "lucide-react"

import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkout, fetchExercises } from "@/lib/fitness/api"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"
import type { ExerciseVariationOption, Workout, WorkoutLog, WeeklySchedule } from "@/lib/types"

type WeeklyCalendarProps = {
  recentLogs: WorkoutLog[]
  schedule: WeeklySchedule
  showHero?: boolean
  weekLogs?: WorkoutLog[]
  workouts: Workout[]
}

type SourceFilter = "all" | "coach" | "self"
type RoutineKind = "push" | "pull" | "legs" | "full_body" | "cardio" | "other"
type RoutineTag = "push" | "pull" | "legs" | "upper" | "lower" | "full"

type RoutineExercise = {
  fallbackEquipment?: string
  fallbackExerciseName?: string
  fallbackIsDefault?: boolean
  fallbackMuscleGroup?: string
  fallbackVariationName?: string
  id: string
  reps: string
  sets: number
  variationId: string
  weight: string
}

type Routine = {
  exercises: RoutineExercise[]
  id: string
  name: string
  tag: RoutineTag
}

type ScheduleEntry = {
  date: Date
  durationLabel?: string
  isCompleted: boolean
  isMissed: boolean
  isToday: boolean
  log: WorkoutLog | null
  source: "coach" | "self"
  weekday: number
  workout: Workout | null
}

const DISPLAY_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const ROUTINE_TAGS: RoutineTag[] = ["push", "pull", "legs", "upper", "lower", "full"]
const TAG_DOT_COLOR: Record<RoutineTag, string> = {
  full: "var(--muted-foreground)",
  legs: "var(--warning)",
  lower: "var(--chart-5)",
  pull: "var(--success)",
  push: "var(--primary)",
  upper: "var(--chart-4)",
}

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createEmptyRoutineExercise(defaultVariationId = ""): RoutineExercise {
  return {
    id: createDraftId(),
    reps: "8-12",
    sets: 3,
    variationId: defaultVariationId,
    weight: "",
  }
}

function mapRoutineTagToWorkoutKind(tag: RoutineTag): RoutineKind {
  if (tag === "full" || tag === "upper") return "full_body"
  if (tag === "lower") return "legs"
  return tag
}

function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function getWeekDateForScheduledDay(weekStart: Date, scheduledDay: number) {
  return addDays(weekStart, (scheduledDay + 6) % 7)
}

function getScheduledWorkoutForDate(workouts: Workout[], schedule: WeeklySchedule, date: Date) {
  const oneOffWorkout = workouts.find((workout) => workout.scheduledDate && isSameDay(workout.scheduledDate, date))

  if (oneOffWorkout) {
    return oneOffWorkout
  }

  const recurringWorkout = workouts.find(
    (workout) => !workout.scheduledDate && workout.scheduledDay === date.getDay(),
  )

  return recurringWorkout ?? schedule[date.getDay()] ?? null
}

function getLogForDate(logs: WorkoutLog[], date: Date, workout: Workout | null) {
  const logsForDate = logs.filter((log) => isSameDay(log.startedAt, date))

  if (logsForDate.length === 0) {
    return null
  }

  if (!workout) {
    return logsForDate[0]
  }

  return logsForDate.find((log) => log.workout.id === workout.id) ?? logsForDate[0]
}

function getDurationLabel(workout: Workout | null, log: WorkoutLog | null) {
  if (log?.completedAt) {
    return `${Math.max(1, differenceInMinutes(log.completedAt, log.startedAt))}m`
  }

  if (log) {
    return `${Math.max(1, differenceInMinutes(new Date(), log.startedAt))}m so far`
  }

  if (workout?.duration) {
    return `${workout.duration}m`
  }

  return undefined
}

function formatWeekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  return `${format(weekStart, "MMM d")} - ${format(weekEnd, weekStart.getMonth() === weekEnd.getMonth() ? "d" : "MMM d")}`
}

function getRoutineTag(workout: Workout | null) {
  if (!workout) {
    return "full"
  }

  if (workout.kind === "full_body") {
    return "full"
  }

  if (workout.kind && workout.kind !== "other" && workout.kind !== "cardio") {
    return workout.kind
  }

  const muscleGroups = workout.exercises.map((exercise) => exercise.exercise.muscleGroup.toLowerCase())

  if (muscleGroups.some((group) => group.includes("leg"))) return "legs"
  if (muscleGroups.some((group) => group.includes("back"))) return "pull"
  if (muscleGroups.some((group) => group.includes("chest") || group.includes("shoulder"))) return "push"

  return workout.kind === "cardio" ? "cardio" : "full"
}

function getRoutineTagForLibrary(workout: Workout, index: number): RoutineTag {
  const tag = getRoutineTag(workout)

  if (tag === "push" || tag === "pull" || tag === "legs" || tag === "full") {
    return tag
  }

  const normalizedName = workout.name.toLowerCase()

  if (normalizedName.includes("push")) return "push"
  if (normalizedName.includes("pull")) return "pull"
  if (normalizedName.includes("leg")) return "legs"
  if (normalizedName.includes("upper")) return "upper"
  if (normalizedName.includes("lower")) return "lower"
  if (normalizedName.includes("full")) return "full"

  return ROUTINE_TAGS[index % ROUTINE_TAGS.length]
}

function mapWorkoutExerciseToRoutineExercise(workoutExercise: Workout["exercises"][number]): RoutineExercise {
  return {
    fallbackEquipment: workoutExercise.variation.equipment,
    fallbackExerciseName: workoutExercise.exercise.name,
    fallbackIsDefault: workoutExercise.variation.isDefault,
    fallbackMuscleGroup: workoutExercise.exercise.muscleGroup,
    fallbackVariationName: workoutExercise.variation.name,
    id: workoutExercise.id || createDraftId(),
    reps: formatRepTarget({
      reps: workoutExercise.sets[0]?.targetReps ?? 1,
      repsMin: workoutExercise.sets[0]?.targetRepsMin,
    }),
    sets: workoutExercise.sets.length || 1,
    variationId: workoutExercise.variation.id,
    weight: workoutExercise.sets[0]?.weight != null ? String(workoutExercise.sets[0].weight) : "",
  }
}

function mapWorkoutToRoutine(workout: Workout, index: number): Routine {
  return {
    exercises: workout.exercises.map(mapWorkoutExerciseToRoutineExercise),
    id: workout.id || createDraftId(),
    name: workout.name || `Routine ${index + 1}`,
    tag: getRoutineTagForLibrary(workout, index),
  }
}

function getTagColor(tag: string) {
  const colors: Record<string, string> = {
    cardio: "var(--chart-5)",
    full: "var(--muted-foreground)",
    legs: "var(--warning)",
    lower: "var(--chart-5)",
    pull: "var(--success)",
    push: "var(--primary)",
    upper: "var(--chart-4)",
  }

  return colors[tag] ?? "var(--muted-foreground)"
}

function getStatusBadge(entry: ScheduleEntry) {
  if (entry.isCompleted) {
    return { className: "bg-success/10 text-success", label: "Done" }
  }

  if (entry.isToday) {
    return { className: "bg-primary/10 text-primary", label: "Today" }
  }

  if (entry.isMissed) {
    return { className: "bg-warning/10 text-warning", label: "Missed" }
  }

  return null
}

function buildWeekEntries({
  logs,
  optimisticScheduleByDate,
  schedule,
  weekStart,
  workouts,
}: {
  logs: WorkoutLog[]
  optimisticScheduleByDate: Record<string, Workout | null>
  schedule: WeeklySchedule
  weekStart: Date
  workouts: Workout[]
}) {
  return DISPLAY_WEEKDAY_ORDER.map((weekday, displayIndex) => {
    const date = addDays(weekStart, displayIndex)
    const dateKey = getDateKey(date)
    const baseWorkout = getScheduledWorkoutForDate(workouts, schedule, date)
    const workout = Object.hasOwn(optimisticScheduleByDate, dateKey)
      ? optimisticScheduleByDate[dateKey] ?? null
      : baseWorkout
    const log = getLogForDate(logs, date, workout)

    return {
      date,
      durationLabel: getDurationLabel(workout, log),
      isCompleted: Boolean(log),
      isMissed: Boolean(workout && !log && isBefore(startOfDay(date), startOfDay(new Date()))),
      isToday: isToday(date),
      log,
      source: workout?.isPersonal ? "self" : "coach",
      weekday,
      workout,
    } satisfies ScheduleEntry
  })
}

function SourceChip({
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
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function DayCard({
  entry,
  onRestDayClick,
}: {
  entry: ScheduleEntry
  onRestDayClick: (date: Date) => void
}) {
  const workout = entry.workout
  const badge = getStatusBadge(entry)
  const tag = getRoutineTag(workout)

  return (
    <div
      className={cn(
        "relative flex min-h-[130px] flex-col gap-2.5 rounded-[10px] border bg-card p-4 transition-colors duration-150",
        entry.isToday ? "border-primary" : workout ? "border-border hover:border-input" : "border-border",
        entry.isCompleted && "bg-muted/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={cn("label-micro", entry.isToday ? "text-primary" : "text-muted-foreground")}>
            {format(entry.date, "EEE")}
          </div>
          <div className={cn("mt-0.5 font-mono text-lg font-semibold leading-none tnum", entry.isToday ? "text-primary" : "text-foreground")}>
            {format(entry.date, "d")}
          </div>
        </div>
        {badge ? (
          <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", badge.className)}>
            {badge.label}
          </span>
        ) : null}
      </div>

      {workout ? (
        <>
          <div className="mt-1 min-w-0">
            <div className="mb-1 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getTagColor(tag) }} />
              <span className="label-micro">{tag}</span>
            </div>
            <div
              className={cn(
                "line-clamp-2 text-sm font-medium leading-snug text-foreground",
                entry.isCompleted && "text-muted-foreground line-through decoration-border",
              )}
            >
              {workout.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {entry.durationLabel ? (
                <span className="font-mono text-[11px] text-muted-foreground tnum">{entry.durationLabel}</span>
              ) : null}
              {entry.source === "coach" ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <User className="h-2.5 w-2.5" />
                  Coach
                </span>
              ) : null}
            </div>
          </div>

          {entry.isToday ? (
            <Button asChild size="sm" className="mt-auto">
              <Link href={`/workout/${workout.id}/start`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                {entry.log && !entry.log.completedAt ? "Resume" : "Start"}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="mt-auto justify-start px-0 text-primary hover:bg-transparent hover:text-primary">
              <Link href={`/workout/${workout.id}/start`}>
                {entry.isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                {entry.isCompleted ? "Review" : "Open"}
              </Link>
            </Button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onRestDayClick(entry.date)}
          className="flex flex-1 flex-col items-center justify-center rounded-[8px] border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-primary"
        >
          <Plus className="mb-1 h-4 w-4" />
          Add routine
        </button>
      )}
    </div>
  )
}

function RoutineDot({ tag }: { tag: RoutineTag }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TAG_DOT_COLOR[tag] }} />
}

function RoutinePickerDialog({
  date,
  error,
  isSaving,
  library,
  onClose,
  onCreateNew,
  onPick,
  open,
}: {
  date: Date | null
  error: string | null
  isSaving: boolean
  library: Routine[]
  onClose: () => void
  onCreateNew: () => void
  onPick: (routine: Routine) => void
  open: boolean
}) {
  const [query, setQuery] = useState("")
  const visibleRoutines = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return library
      .filter((routine) => routine.exercises.length > 0)
      .filter((routine) => {
        if (!normalized) {
          return true
        }

        return [routine.name, routine.tag].join(" ").toLowerCase().includes(normalized)
      })
  }, [library, query])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[80] flex max-h-[calc(100svh-1.5rem)] min-h-0 flex-col overflow-hidden rounded-[14px] border-border p-0 sm:max-h-[72svh] sm:max-w-[400px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-[15px] font-semibold">Pick a routine</DialogTitle>
          <p className="font-mono text-[11px] text-muted-foreground tnum">
            {date ? format(date, "EEE, MMM d") : "Rest day"}
          </p>
          <div className="relative pt-2">
            <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search routines..."
              className="h-9 bg-background pl-8 text-sm"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {error ? (
            <div className="border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {visibleRoutines.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No routines match this search. Create a new routine for this rest day.
            </div>
          ) : (
            visibleRoutines.map((routine, index) => (
              <button
                key={routine.id}
                type="button"
                disabled={isSaving}
                onClick={() => onPick(routine)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
                  index < visibleRoutines.length - 1 && "border-b border-border",
                )}
              >
                <RoutineDot tag={routine.tag} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{routine.name}</span>
                  <span className="label-micro mt-0.5 block">
                    {routine.tag} · {routine.exercises.length} exercise{routine.exercises.length === 1 ? "" : "s"}
                  </span>
                </span>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </button>
            ))
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:justify-center">
          <Button type="button" variant="ghost" size="sm" className="text-primary" onClick={onCreateNew} disabled={isSaving}>
            <Plus className="h-3.5 w-3.5" />
            Create new routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoutineBuilderDialog({
  date,
  error,
  exerciseOptions,
  isLoadingExercises,
  isSaving,
  onClose,
  onSave,
  open,
}: {
  date: Date | null
  error: string | null
  exerciseOptions: ExerciseVariationOption[]
  isLoadingExercises: boolean
  isSaving: boolean
  onClose: () => void
  onSave: (routine: Routine) => void
  open: boolean
}) {
  const [name, setName] = useState("")
  const [tag, setTag] = useState<RoutineTag>("push")
  const [exercises, setExercises] = useState<RoutineExercise[]>([])
  const [isExerciseSearchOpen, setIsExerciseSearchOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setTag("push")
      setExercises([])
      setIsExerciseSearchOpen(false)
    }
  }, [open])

  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const canSave = name.trim().length > 0 && exercises.length > 0 && exercises.every((exercise) => exercise.variationId) && !isSaving

  const updateExercise = (exerciseId: string, patch: Partial<RoutineExercise>) => {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    )
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((current) => {
      const target = index + direction

      if (target < 0 || target >= current.length) {
        return current
      }

      const next = current.slice()
      const moving = next[index]
      next[index] = next[target]
      next[target] = moving
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[90] flex h-[90svh] max-h-[90svh] min-h-0 flex-col overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border px-7 pb-4 pt-6 text-left">
          <p className="label-micro">New routine · {date ? format(date, "EEE, MMM d") : "Rest day"}</p>
          <DialogTitle className="text-[23px] font-semibold tracking-[-0.02em]">
            {name.trim() || "Untitled routine"}
          </DialogTitle>
          <p className="font-mono text-xs text-muted-foreground tnum">
            {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {totalSets} set{totalSets === 1 ? "" : "s"}
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Saturday push"
              className="h-10 flex-1 bg-background"
            />
            <div className="flex gap-1.5 overflow-x-auto">
              {ROUTINE_TAGS.map((tagOption) => (
                <button
                  key={tagOption}
                  type="button"
                  onClick={() => setTag(tagOption)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors",
                    tag === tagOption
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <RoutineDot tag={tagOption} />
                  {tagOption}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
          {error ? (
            <div className="mb-4 rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {exercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No exercises yet. Add your first one.
            </div>
          ) : null}

          <div className="space-y-2.5">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="rounded-[10px] border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="w-5 text-right font-mono text-xs font-semibold text-muted-foreground tnum">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ExercisePicker
                      exercises={exerciseOptions}
                      fallbackSelection={{
                        equipment: exercise.fallbackEquipment,
                        exerciseName: exercise.fallbackExerciseName,
                        isDefault: exercise.fallbackIsDefault,
                        muscleGroup: exercise.fallbackMuscleGroup,
                        variationName: exercise.fallbackVariationName,
                      }}
                      selectedVariationId={exercise.variationId}
                      disabled={isLoadingExercises || isSaving}
                      onSelect={(variationId) => {
                        const option = exerciseOptions.find((item) => item.id === variationId)

                        updateExercise(exercise.id, {
                          fallbackEquipment: option?.equipment,
                          fallbackExerciseName: option?.exerciseName,
                          fallbackIsDefault: option?.isDefault,
                          fallbackMuscleGroup: option?.muscleGroup,
                          fallbackVariationName: option?.variationName,
                          variationId,
                        })
                      }}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(index, -1)}
                      disabled={index === 0 || isSaving}
                      aria-label="Move exercise up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(index, 1)}
                      disabled={index === exercises.length - 1 || isSaving}
                      aria-label="Move exercise down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))}
                      aria-label="Remove exercise"
                      disabled={isSaving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 pl-8">
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">Sets</Label>
                    <Input
                      type="number"
                      min={1}
                      value={exercise.sets}
                      onChange={(event) => updateExercise(exercise.id, { sets: Math.max(1, Number(event.target.value) || 1) })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">Reps range</Label>
                    <Input
                      value={exercise.reps}
                      onChange={(event) => updateExercise(exercise.id, { reps: event.target.value })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                      placeholder="8-12"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">Kg</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={exercise.weight}
                      onChange={(event) => updateExercise(exercise.id, { weight: event.target.value })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full border-dashed bg-transparent text-primary hover:bg-muted hover:text-primary"
            onClick={() => setIsExerciseSearchOpen(true)}
            disabled={isLoadingExercises || isSaving || exerciseOptions.length === 0}
          >
            {isLoadingExercises ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add exercise
          </Button>
        </div>

        <DialogFooter className="border-t border-border px-7 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => onSave({ exercises, id: createDraftId(), name: name.trim(), tag })}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save routine
          </Button>
        </DialogFooter>

        <ExerciseSearchDialog
          existingVariationIds={exercises.map((exercise) => exercise.variationId).filter(Boolean)}
          exerciseOptions={exerciseOptions}
          open={isExerciseSearchOpen}
          onClose={() => setIsExerciseSearchOpen(false)}
          onPick={(option) => {
            setExercises((current) => [
              ...current,
              {
                ...createEmptyRoutineExercise(),
                fallbackEquipment: option.equipment,
                fallbackExerciseName: option.exerciseName,
                fallbackIsDefault: option.isDefault,
                fallbackMuscleGroup: option.muscleGroup,
                fallbackVariationName: option.variationName,
                variationId: option.id,
              },
            ])
            setIsExerciseSearchOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExerciseSearchDialog({
  existingVariationIds,
  exerciseOptions,
  onClose,
  onPick,
  open,
}: {
  existingVariationIds: string[]
  exerciseOptions: ExerciseVariationOption[]
  onClose: () => void
  onPick: (option: ExerciseVariationOption) => void
  open: boolean
}) {
  const [query, setQuery] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("all")
  const existingSet = useMemo(() => new Set(existingVariationIds), [existingVariationIds])
  const muscleGroups = useMemo(
    () => ["all", ...Array.from(new Set(exerciseOptions.map((option) => option.muscleGroup))).sort((left, right) => left.localeCompare(right))],
    [exerciseOptions],
  )
  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return exerciseOptions
      .slice()
      .sort((left, right) => {
        const nameComparison = left.exerciseName.localeCompare(right.exerciseName)

        if (nameComparison !== 0) {
          return nameComparison
        }

        return left.variationName.localeCompare(right.variationName)
      })
      .filter((option) => {
        if (muscleGroup !== "all" && option.muscleGroup !== muscleGroup) {
          return false
        }

        if (!normalizedQuery) {
          return true
        }

        return [
          option.exerciseName,
          option.variationName,
          option.name,
          option.muscleGroup,
          option.equipment ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      })
  }, [exerciseOptions, muscleGroup, query])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setMuscleGroup("all")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[110] flex h-[82svh] max-h-[82svh] min-h-0 flex-col overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[480px]">
        <DialogHeader className="border-b border-border px-6 pb-3 pt-5 text-left">
          <DialogTitle className="text-xl font-semibold tracking-[-0.01em]">Add exercise</DialogTitle>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="h-10 rounded-[4px] bg-background pl-9 text-sm focus-visible:ring-primary/30"
              autoFocus
            />
          </div>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {muscleGroups.map((group) => {
              const active = muscleGroup === group

              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setMuscleGroup(group)}
                  className={cn(
                    "h-8 shrink-0 rounded-full border px-3 text-sm font-medium capitalize transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {group === "all" ? "All" : group}
                </button>
              )
            })}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleExercises.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">No exercises match this search.</div>
          ) : (
            visibleExercises.map((option) => {
              const added = existingSet.has(option.id)

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={added}
                  onClick={() => onPick(option)}
                  className={cn(
                    "flex w-full items-center gap-4 border-b border-border px-6 py-3 text-left transition-colors",
                    added ? "cursor-default opacity-55" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{option.exerciseName}</span>
                    <span className="label-micro mt-0.5 block truncate">
                      {option.muscleGroup} · {option.equipment || "Bodyweight"}
                    </span>
                  </span>
                  {added ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-success">Added</span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3 sm:justify-center">
          <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary" disabled>
            <Plus className="h-3.5 w-3.5" />
            Create custom exercise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CoachProgramCard({ coachWorkouts }: { coachWorkouts: Workout[] }) {
  if (coachWorkouts.length === 0) {
    return null
  }

  const daysPerWeek = new Set(coachWorkouts.map((workout) => workout.scheduledDay).filter((day) => day != null)).size || coachWorkouts.length
  const progressPct = 25

  return (
    <div className="mb-7 grid gap-5 rounded-[12px] bg-foreground px-5 py-5 text-background md:grid-cols-[1.35fr_1fr] md:px-7 md:py-6">
      <div>
        <p className="label-micro mb-2 text-background/55">Your coach program</p>
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.015em]">Current training block</h2>
        <p className="mt-1.5 font-mono text-xs text-background/70 tnum">
          Assigned by coach · {daysPerWeek} days/week · {coachWorkouts.length} routines
        </p>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-background/70">
          Coach-assigned sessions are reflected in your weekly plan. Personal workouts can still be added on open days.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" className="border-background/15 bg-background/10 text-background hover:bg-background/15">
            <Link href="/workout">View program</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
            <Link href="/coach/find">
              <MessageSquare className="h-3.5 w-3.5" />
              Message coach
            </Link>
          </Button>
        </div>
      </div>

      <div className="self-center">
        <div className="mb-2 flex justify-between">
          <span className="label-micro text-background/55">Active plan</span>
          <span className="font-mono text-[11px] text-background tnum">{progressPct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-background/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }).map((_, index) => (
            <span
              key={index}
              className={cn("h-1.5 rounded-sm", index < 3 ? "bg-primary" : "bg-background/10")}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="label-micro text-background/40">w1</span>
          <span className="label-micro text-background/40">w12</span>
        </div>
      </div>
    </div>
  )
}

export function WeeklyCalendar({ recentLogs, schedule, weekLogs, workouts }: WeeklyCalendarProps) {
  const { session } = useAuth()
  const [showSource, setShowSource] = useState<SourceFilter>("all")
  const [optimisticScheduleByDate, setOptimisticScheduleByDate] = useState<Record<string, Workout | null>>({})
  const [visibleWorkouts, setVisibleWorkouts] = useState(workouts)
  const [visibleRecentLogs, setVisibleRecentLogs] = useState(recentLogs)
  const [visibleWeekLogs, setVisibleWeekLogs] = useState(weekLogs ?? [])
  const [extraRoutineLibrary, setExtraRoutineLibrary] = useState<Routine[]>([])
  const [selectedRestDate, setSelectedRestDate] = useState<Date | null>(null)
  const [isRoutineBuilderOpen, setIsRoutineBuilderOpen] = useState(false)
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseVariationOption[]>([])
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [isSavingRoutine, setIsSavingRoutine] = useState(false)
  const [routineError, setRoutineError] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticScheduleByDate({})
    setVisibleWorkouts(workouts)
  }, [schedule, workouts])

  useEffect(() => {
    setVisibleRecentLogs(recentLogs)
    setVisibleWeekLogs(weekLogs ?? [])
  }, [recentLogs, weekLogs])

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const nextWeekStart = addDays(weekStart, 7)
  const logsForDisplay = visibleWeekLogs.length > 0 ? visibleWeekLogs : visibleRecentLogs
  const thisWeekEntries = buildWeekEntries({
    logs: logsForDisplay,
    optimisticScheduleByDate,
    schedule,
    weekStart,
    workouts: visibleWorkouts,
  })
  const nextWeekEntries = buildWeekEntries({
    logs: visibleRecentLogs,
    optimisticScheduleByDate,
    schedule,
    weekStart: nextWeekStart,
    workouts: visibleWorkouts,
  })

  const routineLibrary = [
    ...extraRoutineLibrary,
    ...visibleWorkouts
      .filter((workout) => !workout.scheduledDate)
      .slice()
      .sort((left, right) => Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal)))
      .map((workout, index) => mapWorkoutToRoutine(workout, index)),
  ]

  const coachWorkouts = visibleWorkouts.filter((workout) => !workout.isPersonal)
  const plannedCount = thisWeekEntries.filter((entry) => entry.workout).length
  const completedCount = thisWeekEntries.filter((entry) => entry.isCompleted).length
  const filteredThisWeek = thisWeekEntries.filter((entry) => showSource === "all" || Boolean(entry.workout && entry.source === showSource))
  const filteredNextWeek = nextWeekEntries.filter((entry) => showSource === "all" || Boolean(entry.workout && entry.source === showSource))

  const handleWorkoutSaved = (workout: Workout, previousWorkout?: Workout, referenceDate?: Date) => {
    const nextVisibleWorkouts = [...visibleWorkouts.filter((currentWorkout) => currentWorkout.id !== workout.id), workout]

    setVisibleWorkouts(nextVisibleWorkouts)

    if (referenceDate) {
      setOptimisticScheduleByDate((current) => ({
        ...current,
        [getDateKey(referenceDate)]: workout,
      }))
    }

    if (previousWorkout?.scheduledDate) {
      setOptimisticScheduleByDate((current) => ({
        ...current,
        [getDateKey(previousWorkout.scheduledDate as Date)]: null,
      }))
    }
  }

  const closeRoutineFlow = () => {
    setSelectedRestDate(null)
    setIsRoutineBuilderOpen(false)
    setRoutineError(null)
  }

  const ensureExerciseOptions = async () => {
    if (exerciseOptions.length > 0 || isLoadingExercises) {
      return
    }

    if (!session?.access_token) {
      setRoutineError("You need to be signed in to create a routine.")
      return
    }

    setIsLoadingExercises(true)
    setRoutineError(null)

    try {
      const exercises = await fetchExercises(session.access_token)
      setExerciseOptions(exercises)
    } catch (loadError) {
      setRoutineError(loadError instanceof Error ? loadError.message : "Unable to load exercise library.")
    } finally {
      setIsLoadingExercises(false)
    }
  }

  const openRoutineBuilder = () => {
    void ensureExerciseOptions()
    setSelectedRestDate((currentDate) => {
      if (!currentDate) {
        return currentDate
      }

      window.requestAnimationFrame(() => {
        setIsRoutineBuilderOpen(true)
      })

      return currentDate
    })
  }

  const saveTemplateToRestDate = async (routine: Routine) => {
    if (!selectedRestDate || !session?.access_token || isSavingRoutine) {
      return
    }

    if (routine.exercises.length === 0) {
      setRoutineError("This routine has no exercises yet.")
      return
    }

    setIsSavingRoutine(true)
    setRoutineError(null)

    try {
      const createdWorkout = await createWorkout(session.access_token, {
        duration: Math.max(30, routine.exercises.reduce((sum, exercise) => sum + exercise.sets * 3, 0)),
        exercises: routine.exercises.map((exercise) => {
          const repTarget = parseRepTargetText(exercise.reps) ?? { reps: 1, repsMin: undefined }
          const parsedWeight = Number(exercise.weight)

          return {
            reps: repTarget.reps,
            repsMin: repTarget.repsMin,
            sets: Math.max(1, exercise.sets),
            variationId: exercise.variationId,
            weight:
              exercise.weight.trim() && Number.isFinite(parsedWeight)
                ? Math.max(0, parsedWeight)
                : undefined,
          }
        }),
        kind: mapRoutineTagToWorkoutKind(routine.tag),
        name: routine.name,
        scheduledDate: format(selectedRestDate, "yyyy-MM-dd"),
      })

      setExtraRoutineLibrary((current) => [routine, ...current.filter((item) => item.id !== routine.id)])
      handleWorkoutSaved(createdWorkout, undefined, selectedRestDate)
      closeRoutineFlow()
    } catch (saveError) {
      setRoutineError(saveError instanceof Error ? saveError.message : "Unable to add this routine.")
    } finally {
      setIsSavingRoutine(false)
    }
  }

  const saveDraftToRestDate = async (routine: Routine) => {
    if (!selectedRestDate || !session?.access_token || isSavingRoutine) {
      return
    }

    let normalizedExercises: Array<{
      reps: number
      repsMin?: number
      sets: number
      variationId: string
      weight?: number
    }>

    try {
      normalizedExercises = routine.exercises.map((exercise, index) => {
        const repTarget = parseRepTargetText(exercise.reps)

        if (!repTarget) {
          throw new Error(`Reps range is invalid on exercise ${index + 1}. Use 8-12 or 10.`)
        }

        const parsedWeight = Number(exercise.weight)

        return {
          reps: repTarget.reps,
          repsMin: repTarget.repsMin,
          sets: Math.max(1, exercise.sets),
          variationId: exercise.variationId,
          weight:
            exercise.weight.trim() && Number.isFinite(parsedWeight)
              ? Math.max(0, parsedWeight)
              : undefined,
        }
      })
    } catch (buildError) {
      setRoutineError(buildError instanceof Error ? buildError.message : "Invalid routine data.")
      return
    }

    setIsSavingRoutine(true)
    setRoutineError(null)

    try {
      const createdWorkout = await createWorkout(session.access_token, {
        duration: Math.max(30, normalizedExercises.reduce((sum, exercise) => sum + exercise.sets * 3, 0)),
        exercises: normalizedExercises,
        kind: mapRoutineTagToWorkoutKind(routine.tag),
        name: routine.name,
        scheduledDate: format(selectedRestDate, "yyyy-MM-dd"),
      })

      setExtraRoutineLibrary((current) => [routine, ...current.filter((item) => item.id !== routine.id)])
      handleWorkoutSaved(createdWorkout, undefined, selectedRestDate)
      closeRoutineFlow()
    } catch (saveError) {
      setRoutineError(saveError instanceof Error ? saveError.message : "Unable to save this routine.")
    } finally {
      setIsSavingRoutine(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-micro mb-2">This week · {formatWeekRangeLabel(weekStart)}</p>
          <h1 className="text-[36px] font-semibold leading-none tracking-[-0.02em]">{plannedCount} sessions planned.</h1>
          <p className="mt-2 font-mono text-[13px] text-muted-foreground tnum">
            {completedCount}/{plannedCount} done this week · {Math.max(0, plannedCount - completedCount)} to go
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SourceChip active={showSource === "all"} onClick={() => setShowSource("all")}>
            All
          </SourceChip>
          <SourceChip active={showSource === "coach"} onClick={() => setShowSource("coach")}>
            <User className="h-3 w-3" />
            From coach
          </SourceChip>
          <SourceChip active={showSource === "self"} onClick={() => setShowSource("self")}>
            Mine
          </SourceChip>
        </div>
      </div>

      <CoachProgramCard coachWorkouts={coachWorkouts} />

      <p className="label-micro mb-3">This week</p>
      <div className="mb-8 grid grid-cols-2 gap-2.5 md:grid-cols-7">
        {filteredThisWeek.map((entry) => (
          <DayCard
            key={getDateKey(entry.date)}
            entry={entry}
            onRestDayClick={(date) => {
              setSelectedRestDate(date)
              setRoutineError(null)
            }}
          />
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <p className="label-micro">Next week · {formatWeekRangeLabel(nextWeekStart)}</p>
        <span className="label-micro text-muted-foreground">Preview</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 opacity-70 md:grid-cols-7">
        {filteredNextWeek.map((entry) => (
          <DayCard
            key={getDateKey(entry.date)}
            entry={entry}
            onRestDayClick={(date) => {
              setSelectedRestDate(date)
              setRoutineError(null)
            }}
          />
        ))}
      </div>

      <div className="mt-7 text-center">
        <Button asChild variant="ghost">
          <Link href="/workout">
            <CalendarDays className="h-4 w-4" />
            View full plan
          </Link>
        </Button>
      </div>

      <RoutinePickerDialog
        date={selectedRestDate}
        error={routineError}
        isSaving={isSavingRoutine}
        library={routineLibrary}
        open={Boolean(selectedRestDate) && !isRoutineBuilderOpen}
        onClose={closeRoutineFlow}
        onCreateNew={openRoutineBuilder}
        onPick={(routine) => void saveTemplateToRestDate(routine)}
      />

      <RoutineBuilderDialog
        date={selectedRestDate}
        error={routineError}
        exerciseOptions={exerciseOptions}
        isLoadingExercises={isLoadingExercises}
        isSaving={isSavingRoutine}
        open={Boolean(selectedRestDate) && isRoutineBuilderOpen}
        onClose={() => {
          setIsRoutineBuilderOpen(false)
          setRoutineError(null)
        }}
        onSave={(routine) => void saveDraftToRestDate(routine)}
      />
    </section>
  )
}
