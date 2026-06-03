"use client"

import Link from "next/link"
import { memo, useEffect, useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, isBefore, isSameDay, isToday, startOfDay, startOfWeek } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Loader2, MessageSquare, Play, Plus, Search, Trash2, User } from "lucide-react"

import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkout, fetchExercises } from "@/lib/fitness/api"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"
import type { ExerciseVariationOption, Workout, WorkoutLog, WorkoutScheduleEntry, WeeklySchedule } from "@/lib/types"
import type { AppMessages } from "@/lib/i18n/messages"

type WeeklyCalendarProps = {
  recentLogs: WorkoutLog[]
  schedule: WeeklySchedule
  scheduleEntries?: WorkoutScheduleEntry[]
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
  restTime?: string
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

type ScheduleEntry = WorkoutScheduleEntry
type WorkoutLogIndex = {
  byDateAndWorkoutId: Map<string, Map<string, WorkoutLog>>
  firstByDate: Map<string, WorkoutLog>
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
    restTime: "",
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

function buildLogsByPlannedDateAndWorkoutId(logs: WorkoutLog[]): WorkoutLogIndex {
  return logs.reduce<WorkoutLogIndex>(
    (index, log) => {
      const plannedDate = log.plannedDate ?? log.startedAt
      const dateKey = getDateKey(plannedDate)
      const logsByWorkout = index.byDateAndWorkoutId.get(dateKey) ?? new Map<string, WorkoutLog>()

      logsByWorkout.set(log.workout.id, log)
      index.byDateAndWorkoutId.set(dateKey, logsByWorkout)

      if (!index.firstByDate.has(dateKey)) {
        index.firstByDate.set(dateKey, log)
      }

      return index
    },
    {
      byDateAndWorkoutId: new Map<string, Map<string, WorkoutLog>>(),
      firstByDate: new Map<string, WorkoutLog>(),
    },
  )
}

function getLogForDate(logIndex: WorkoutLogIndex, date: Date, workout: Workout | null) {
  const dateKey = getDateKey(date)

  if (!workout) {
    return logIndex.firstByDate.get(dateKey) ?? null
  }

  return logIndex.byDateAndWorkoutId.get(dateKey)?.get(workout.id) ?? null
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
    restTime: workoutExercise.restTime != null ? String(workoutExercise.restTime) : "",
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

function getStatusBadge(entry: ScheduleEntry, messages: AppMessages) {
  if (entry.isCompleted) {
    return { className: "bg-ok-soft text-success", label: messages.schedule.done }
  }

  if (entry.isToday) {
    return { className: "bg-primary-soft text-primary", label: messages.schedule.todayLabel }
  }

  if (entry.isMissed) {
    return { className: "bg-warn-soft text-warning", label: messages.schedule.missedLabel }
  }

  return null
}

function buildWeekEntries({
  logIndex,
  optimisticScheduleByDate,
  schedule,
  weekStart,
  workouts,
}: {
  logIndex: WorkoutLogIndex
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
    const log = getLogForDate(logIndex, date, workout)

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
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
  const workout = entry.workout
  const badge = getStatusBadge(entry, messages)
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
            {format(entry.date, "EEE", { locale: dateLocale })}
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
                  {messages.schedule.coach}
                </span>
              ) : null}
            </div>
          </div>

          {entry.isToday ? (
            <Button asChild size="sm" className="mt-auto">
              <Link href={`/workout/${workout.id}/start`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                {entry.log && !entry.log.completedAt ? messages.schedule.resume : messages.workoutPage.start}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="mt-auto justify-start px-0 text-primary hover:bg-transparent hover:text-primary">
              <Link href={`/workout/${workout.id}/start`}>
                {entry.isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                {entry.isCompleted ? messages.schedule.review : messages.schedule.open}
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
          {messages.schedule.addRoutine}
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
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
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
          <DialogTitle className="text-[15px] font-semibold">{messages.schedule.pickRoutine}</DialogTitle>
          <p className="font-mono text-[11px] text-muted-foreground tnum">
            {date ? format(date, "EEE, MMM d", { locale: dateLocale }) : messages.schedule.restDayTitle}
          </p>
          <div className="relative pt-2">
            <Search className="pointer-events-none absolute left-3 top-[1.35rem] h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.schedule.searchRoutines}
              className="h-9 bg-background pl-8 text-sm"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {error ? (
            <div className="border-b border-destructive/20 bg-destructive-soft px-5 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {visibleRoutines.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              {messages.schedule.noRoutinesMatch}
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
                    {routine.tag} · {messages.workoutPage.exerciseCount(routine.exercises.length)}
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
            {messages.schedule.createNewRoutine}
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
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
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
          <p className="label-micro">
            {messages.schedule.newRoutineForDate(date ? format(date, "EEE, MMM d", { locale: dateLocale }) : messages.schedule.restDayTitle)}
          </p>
          <DialogTitle className="text-[23px] font-semibold tracking-[-0.02em]">
            {name.trim() || messages.workoutPage.untitledRoutine}
          </DialogTitle>
          <p className="font-mono text-xs text-muted-foreground tnum">
            {messages.workoutPage.exerciseCount(exercises.length)} · {messages.workoutPage.setCount(totalSets)}
          </p>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={messages.workoutPage.routineNamePlaceholder}
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
                  {tagOption === "push"
                    ? messages.workoutPage.tagPush
                    : tagOption === "pull"
                      ? messages.workoutPage.tagPull
                      : tagOption === "legs"
                        ? messages.workoutPage.tagLegs
                        : tagOption === "upper"
                          ? messages.workoutPage.tagUpper
                          : tagOption === "lower"
                            ? messages.workoutPage.tagLower
                            : messages.workoutPage.tagFull}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
          {error ? (
            <div className="mb-4 rounded-[10px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {exercises.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              {messages.workoutPage.noExercisesYet}
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
                      aria-label={messages.schedule.moveExerciseUp}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => moveExercise(index, 1)}
                      disabled={index === exercises.length - 1 || isSaving}
                      aria-label={messages.schedule.moveExerciseDown}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))}
                      aria-label={messages.workoutPage.removeExercise}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 pl-8">
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">{messages.workoutPage.set}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={exercise.sets}
                      onChange={(event) => updateExercise(exercise.id, { sets: Math.max(1, Number(event.target.value) || 1) })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">{messages.schedule.repsRange}</Label>
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
                  <div className="flex flex-col gap-1">
                    <Label className="label-micro">REST</Label>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={exercise.restTime ?? ""}
                      onChange={(event) => updateExercise(exercise.id, { restTime: event.target.value })}
                      className="h-9 bg-background text-center font-mono text-sm tnum"
                      placeholder="90"
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
            {messages.workoutPage.addExercise}
          </Button>
        </div>

        <DialogFooter className="border-t border-border px-7 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => onSave({ exercises, id: createDraftId(), name: name.trim(), tag })}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {messages.schedule.saveRoutine}
          </Button>
        </DialogFooter>

        {isExerciseSearchOpen ? (
          <AddExerciseModal
            existingVariationIds={exercises.map((exercise) => exercise.variationId).filter(Boolean)}
            exercises={exerciseOptions}
            onClose={() => setIsExerciseSearchOpen(false)}
            footer={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:text-primary"
                disabled
              >
                <Plus className="h-3.5 w-3.5" />
                {messages.schedule.createCustomExercise}
              </Button>
            }
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
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CoachProgramCard({ coachWorkouts }: { coachWorkouts: Workout[] }) {
  const { messages } = useLocale()

  if (coachWorkouts.length === 0) {
    return null
  }

  const daysPerWeek = new Set(coachWorkouts.map((workout) => workout.scheduledDay).filter((day) => day != null)).size || coachWorkouts.length
  const progressPct = 25

  return (
    <div className="mb-7 grid gap-5 rounded-[12px] bg-foreground px-5 py-5 text-background md:grid-cols-[1.35fr_1fr] md:px-7 md:py-6">
      <div>
        <p className="label-micro mb-2 text-background/55">{messages.schedule.yourCoachProgram}</p>
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.015em]">{messages.schedule.currentTrainingBlock}</h2>
        <p className="mt-1.5 font-mono text-xs text-background/70 tnum">
          {messages.schedule.assignedByCoach(daysPerWeek, coachWorkouts.length)}
        </p>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-background/70">
          {messages.schedule.coachAssignedCopy}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" className="border-background/15 bg-background/10 text-background hover:bg-background/15">
            <Link href="/workout">{messages.schedule.viewProgram}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
            <Link href="/coach/find">
              <MessageSquare className="h-3.5 w-3.5" />
              {messages.schedule.messageCoach}
            </Link>
          </Button>
        </div>
      </div>

      <div className="self-center">
        <div className="mb-2 flex justify-between">
          <span className="label-micro text-background/55">{messages.schedule.activePlan}</span>
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

const SourceFilters = memo(function SourceFilters({
  showSource,
  onChange,
}: {
  showSource: SourceFilter
  onChange: (source: SourceFilter) => void
}) {
  const { messages } = useLocale()

  return (
    <div className="flex flex-wrap gap-1.5">
      <SourceChip active={showSource === "all"} onClick={() => onChange("all")}>
        {messages.schedule.allSources}
      </SourceChip>
      <SourceChip active={showSource === "coach"} onClick={() => onChange("coach")}>
        <User className="h-3 w-3" />
        {messages.schedule.fromCoach}
      </SourceChip>
      <SourceChip active={showSource === "self"} onClick={() => onChange("self")}>
        {messages.schedule.mine}
      </SourceChip>
    </div>
  )
})

const CalendarGrid = memo(function CalendarGrid({
  entries,
  onRestDayClick,
}: {
  entries: ScheduleEntry[]
  onRestDayClick: (date: Date) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
      {entries.map((entry) => (
        <DayCard
          key={getDateKey(entry.date)}
          entry={entry}
          onRestDayClick={onRestDayClick}
        />
      ))}
    </div>
  )
})

const NextWeekPreview = memo(function NextWeekPreview({
  entries,
  nextWeekStart,
  onRestDayClick,
}: {
  entries: ScheduleEntry[]
  nextWeekStart: Date
  onRestDayClick: (date: Date) => void
}) {
  const { messages } = useLocale()

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="label-micro">{messages.schedule.nextWeekRange(formatWeekRangeLabel(nextWeekStart))}</p>
        <span className="label-micro text-muted-foreground">{messages.schedule.previewWorkout}</span>
      </div>
      <div className="opacity-70">
        <CalendarGrid entries={entries} onRestDayClick={onRestDayClick} />
      </div>
    </>
  )
})

function RoutineDialogs({
  date,
  error,
  exerciseOptions,
  isLoadingExercises,
  isRoutineBuilderOpen,
  isSavingRoutine,
  library,
  onClose,
  onCreateNew,
  onPick,
  onBuilderClose,
  onSaveDraft,
}: {
  date: Date
  error: string | null
  exerciseOptions: ExerciseVariationOption[]
  isLoadingExercises: boolean
  isRoutineBuilderOpen: boolean
  isSavingRoutine: boolean
  library: Routine[]
  onClose: () => void
  onCreateNew: () => void
  onPick: (routine: Routine) => void
  onBuilderClose: () => void
  onSaveDraft: (routine: Routine) => void
}) {
  return (
    <>
      <RoutinePickerDialog
        date={date}
        error={error}
        isSaving={isSavingRoutine}
        library={library}
        open={!isRoutineBuilderOpen}
        onClose={onClose}
        onCreateNew={onCreateNew}
        onPick={onPick}
      />

      <RoutineBuilderDialog
        date={date}
        error={error}
        exerciseOptions={exerciseOptions}
        isLoadingExercises={isLoadingExercises}
        isSaving={isSavingRoutine}
        open={isRoutineBuilderOpen}
        onClose={onBuilderClose}
        onSave={onSaveDraft}
      />
    </>
  )
}

export function WeeklyCalendar({ recentLogs, schedule, scheduleEntries = [], weekLogs, workouts }: WeeklyCalendarProps) {
  const { session } = useAuth()
  const { messages } = useLocale()
  const [showSource, setShowSource] = useState<SourceFilter>("all")
  const [showNextWeekPreview, setShowNextWeekPreview] = useState(false)
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const requestIdleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 1))
    const cancelIdleCallback = window.cancelIdleCallback ?? window.clearTimeout
    const idleId = requestIdleCallback(() => setShowNextWeekPreview(true))

    return () => cancelIdleCallback(idleId)
  }, [])

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const nextWeekStart = useMemo(() => addDays(weekStart, 7), [weekStart])
  const logsForDisplay = visibleWeekLogs.length > 0 ? visibleWeekLogs : visibleRecentLogs
  const logsByPlannedDateAndWorkoutId = useMemo(() => buildLogsByPlannedDateAndWorkoutId(logsForDisplay), [logsForDisplay])
  const recentLogsByPlannedDateAndWorkoutId = useMemo(
    () => buildLogsByPlannedDateAndWorkoutId(visibleRecentLogs),
    [visibleRecentLogs],
  )
  const hasOptimisticSchedule = Object.keys(optimisticScheduleByDate).length > 0
  const thisWeekEntries = useMemo(() => {
    if (!hasOptimisticSchedule && scheduleEntries.length > 0) {
      return scheduleEntries
    }

    return buildWeekEntries({
      logIndex: logsByPlannedDateAndWorkoutId,
      optimisticScheduleByDate,
      schedule,
      weekStart,
      workouts: visibleWorkouts,
    })
  }, [hasOptimisticSchedule, logsByPlannedDateAndWorkoutId, optimisticScheduleByDate, schedule, scheduleEntries, visibleWorkouts, weekStart])
  const nextWeekEntries = useMemo(() => {
    if (!showNextWeekPreview) {
      return []
    }

    return buildWeekEntries({
      logIndex: recentLogsByPlannedDateAndWorkoutId,
      optimisticScheduleByDate,
      schedule,
      weekStart: nextWeekStart,
      workouts: visibleWorkouts,
    })
  }, [nextWeekStart, optimisticScheduleByDate, recentLogsByPlannedDateAndWorkoutId, schedule, showNextWeekPreview, visibleWorkouts])

  const routineLibrary = useMemo(() => [
    ...extraRoutineLibrary,
    ...visibleWorkouts
      .filter((workout) => !workout.scheduledDate)
      .slice()
      .sort((left, right) => Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal)))
      .map((workout, index) => mapWorkoutToRoutine(workout, index)),
  ], [extraRoutineLibrary, visibleWorkouts])

  const coachWorkouts = useMemo(() => visibleWorkouts.filter((workout) => !workout.isPersonal), [visibleWorkouts])
  const plannedCount = useMemo(() => thisWeekEntries.filter((entry) => entry.workout).length, [thisWeekEntries])
  const completedCount = useMemo(() => thisWeekEntries.filter((entry) => entry.isCompleted).length, [thisWeekEntries])
  const filteredThisWeek = useMemo(
    () => thisWeekEntries.filter((entry) => showSource === "all" || Boolean(entry.workout && entry.source === showSource)),
    [showSource, thisWeekEntries],
  )
  const filteredNextWeek = useMemo(
    () => nextWeekEntries.filter((entry) => showSource === "all" || Boolean(entry.workout && entry.source === showSource)),
    [nextWeekEntries, showSource],
  )

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
      setRoutineError(loadError instanceof Error ? loadError.message : messages.schedule.loadExerciseLibraryError)
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
          const parsedRest = Number(exercise.restTime)

          return {
            reps: repTarget.reps,
            repsMin: repTarget.repsMin,
            restTime: exercise.restTime?.trim() && Number.isFinite(parsedRest) ? Math.max(0, Math.round(parsedRest)) : undefined,
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
      setRoutineError(saveError instanceof Error ? saveError.message : messages.schedule.unableAddRoutine)
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
      restTime?: number
      sets: number
      variationId: string
      weight?: number
    }>

    try {
      normalizedExercises = routine.exercises.map((exercise, index) => {
        const repTarget = parseRepTargetText(exercise.reps)

        if (!repTarget) {
          throw new Error(messages.schedule.invalidRepsRange(index + 1))
        }

        const parsedWeight = Number(exercise.weight)
        const parsedRest = Number(exercise.restTime)

        return {
          reps: repTarget.reps,
          repsMin: repTarget.repsMin,
          restTime: exercise.restTime?.trim() && Number.isFinite(parsedRest) ? Math.max(0, Math.round(parsedRest)) : undefined,
          sets: Math.max(1, exercise.sets),
          variationId: exercise.variationId,
          weight:
            exercise.weight.trim() && Number.isFinite(parsedWeight)
              ? Math.max(0, parsedWeight)
              : undefined,
        }
      })
    } catch (buildError) {
      setRoutineError(buildError instanceof Error ? buildError.message : messages.schedule.invalidRoutineData)
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
      setRoutineError(saveError instanceof Error ? saveError.message : messages.schedule.unableSaveRoutine)
    } finally {
      setIsSavingRoutine(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-micro mb-2">{messages.schedule.thisWeekRange(formatWeekRangeLabel(weekStart))}</p>
          <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em] sm:text-[36px]">{messages.schedule.plannedSessions(plannedCount)}</h1>
          <p className="mt-2 font-mono text-[13px] text-muted-foreground tnum">
            {messages.schedule.doneToGo(completedCount, plannedCount, Math.max(0, plannedCount - completedCount))}
          </p>
        </div>
        <SourceFilters showSource={showSource} onChange={setShowSource} />
      </div>

      <CoachProgramCard coachWorkouts={coachWorkouts} />

      <p className="label-micro mb-3">{messages.schedule.thisWeek}</p>
      <div className="mb-8">
        <CalendarGrid
          entries={filteredThisWeek}
          onRestDayClick={(date) => {
            setSelectedRestDate(date)
            setRoutineError(null)
          }}
        />
      </div>

      {showNextWeekPreview ? (
        <NextWeekPreview
          entries={filteredNextWeek}
          nextWeekStart={nextWeekStart}
          onRestDayClick={(date) => {
            setSelectedRestDate(date)
            setRoutineError(null)
          }}
        />
      ) : null}

      <div className="mt-7 text-center">
        <Button asChild variant="ghost">
          <Link href="/workout">
            <CalendarDays className="h-4 w-4" />
            {messages.schedule.viewFullPlan}
          </Link>
        </Button>
      </div>

      {selectedRestDate ? (
        <RoutineDialogs
          date={selectedRestDate}
          error={routineError}
          exerciseOptions={exerciseOptions}
          isLoadingExercises={isLoadingExercises}
          isRoutineBuilderOpen={isRoutineBuilderOpen}
          isSavingRoutine={isSavingRoutine}
          library={routineLibrary}
          onClose={closeRoutineFlow}
          onCreateNew={openRoutineBuilder}
          onPick={(routine) => void saveTemplateToRestDate(routine)}
          onBuilderClose={() => {
            setIsRoutineBuilderOpen(false)
            setRoutineError(null)
          }}
          onSaveDraft={(routine) => void saveDraftToRestDate(routine)}
        />
      ) : null}
    </section>
  )
}
