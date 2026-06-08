"use client"

import Link from "next/link"
import { memo, useEffect, useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, startOfDay } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, MessageSquare, Play, Plus, Search, Trash2, User } from "lucide-react"

import { AddExerciseModal } from "@/components/exercises/add-exercise-modal"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { WorkoutLogReview, WorkoutPlanPreview } from "@/components/workout/workout-log-review"
import { createWorkout, fetchExercises, fetchWorkoutDetail } from "@/lib/fitness/api"
import { formatRepTarget, parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"
import type { ExerciseVariationOption, Workout, WorkoutLog, WorkoutScheduleEntry, WeeklySchedule } from "@/lib/types"
import type { AppMessages } from "@/lib/i18n/messages"

type WeeklyCalendarProps = {
  historyLogs?: WorkoutLog[]
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
  rir?: string
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

function getRoutineTagLabel(tag: RoutineTag, messages: AppMessages) {
  const labels: Record<RoutineTag, string> = {
    full: messages.workoutPage.tagFull,
    legs: messages.workoutPage.tagLegs,
    lower: messages.workoutPage.tagLower,
    pull: messages.workoutPage.tagPull,
    push: messages.workoutPage.tagPush,
    upper: messages.workoutPage.tagUpper,
  }

  return labels[tag]
}

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Returns a local-midnight Date whose calendar date (yyyy-MM-dd) matches the
// UTC Monday that starts the week containing `date`. Mirrors backend's
// startOfUtcWeek so frontend and server always agree on the week boundary.
function startOfUtcWeekAsLocal(date: Date): Date {
  const utcDay = date.getUTCDay()
  const offset = utcDay === 0 ? -6 : 1 - utcDay
  const utcMondayMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + offset * 86_400_000
  const utcMonday = new Date(utcMondayMs)
  return new Date(utcMonday.getUTCFullYear(), utcMonday.getUTCMonth(), utcMonday.getUTCDate())
}

function createEmptyRoutineExercise(defaultVariationId = ""): RoutineExercise {
  return {
    id: createDraftId(),
    reps: "8-12",
    rir: "",
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

function isRecurringWorkout(workout: Workout | null): workout is Workout & { scheduledDate?: undefined; scheduledDay: number } {
  return Boolean(workout && !workout.scheduledDate && typeof workout.scheduledDay === "number")
}

function getScheduleOccurrenceKey(workoutId: string, plannedDateKey: string) {
  return `${workoutId}:${plannedDateKey}`
}

function normalizeScheduleMatchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function getWorkoutCompletionMatchKeys(workout: Pick<Workout, "id" | "name" | "scheduledDay">) {
  const keys = [`id:${workout.id}`]
  const normalizedName = normalizeScheduleMatchText(workout.name)

  if (normalizedName) {
    keys.push(`name:${normalizedName}`)

    if (typeof workout.scheduledDay === "number") {
      keys.push(`day:${workout.scheduledDay}:name:${normalizedName}`)
    }
  }

  return keys
}

function getRecurringWorkoutPlannedDateKey(workout: Workout, weekStart: Date) {
  if (!isRecurringWorkout(workout)) {
    return null
  }

  const displayIndex = DISPLAY_WEEKDAY_ORDER.indexOf(workout.scheduledDay)

  if (displayIndex < 0) {
    return null
  }

  return getDateKey(addDays(weekStart, displayIndex))
}

function getLogPlannedDateKey(log: WorkoutLog) {
  if (log.plannedDate) {
    return getDateKey(log.plannedDate)
  }

  if (isRecurringWorkout(log.workout)) {
    const startedDay = startOfDay(log.startedAt)
    const dayOffset = (startedDay.getDay() - log.workout.scheduledDay + 7) % 7
    return getDateKey(addDays(startedDay, -dayOffset))
  }

  if (log.workout.scheduledDate) {
    return getDateKey(log.workout.scheduledDate)
  }

  return getDateKey(log.startedAt)
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
    rir: workoutExercise.sets[0]?.rir != null ? String(workoutExercise.sets[0].rir) : "",
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

  if (entry.isCatchUp) {
    return { className: "bg-warn-soft text-warning", label: messages.schedule.catchUpLabel }
  }

  if (entry.isMissed) {
    return { className: "bg-warn-soft text-warning", label: messages.schedule.missedLabel }
  }

  return null
}

// Sequential weekly schedule: completed sessions show on the day they were actually
// trained; days with no session are simply empty (never "missed"). Each uncompleted
// recurring session is laid out, in program order, on the earliest free day at or after
// both today and its coach-assigned weekday — an on-track week keeps the coach's layout
// (rest days included), a behind week slides the rest forward. Mirrors the backend builder.
function buildWeekEntries({
  logs,
  optimisticScheduleByDate,
  weekStart,
  workouts,
}: {
  logs: WorkoutLog[]
  optimisticScheduleByDate: Record<string, Workout | null>
  weekStart: Date
  workouts: Workout[]
}): ScheduleEntry[] {
  const todayKey = getDateKey(startOfDay(new Date()))
  const weekStartKey = getDateKey(weekStart)
  const weekEndKey = getDateKey(addDays(weekStart, 7))
  const weekLogs = logs.filter((log) => {
    const key = getDateKey(log.startedAt)
    return key >= weekStartKey && key < weekEndKey
  })

  const cells = DISPLAY_WEEKDAY_ORDER.map((weekday, displayIndex) => {
    const date = addDays(weekStart, displayIndex)
    return { date, dateKey: getDateKey(date), weekday }
  })

  const todayIndex = (() => {
    const found = cells.findIndex((cell) => cell.dateKey === todayKey)
    if (found >= 0) return found
    return todayKey < weekStartKey ? -1 : cells.length
  })()

  const logByDay = new Map<string, WorkoutLog>()
  for (const log of weekLogs) {
    const key = getDateKey(log.startedAt)
    if (!logByDay.has(key)) {
      logByDay.set(key, log)
    }
  }
  const completedOccurrenceKeys = new Set<string>()
  const completedWorkoutMatchKeysForWeek = new Set<string>()
  const coachUpdatedWorkoutMatchKeys = new Set<string>()
  workouts
    .filter((workout) => workout.hasCoachUpdate)
    .forEach((workout) => getWorkoutCompletionMatchKeys(workout).forEach((key) => coachUpdatedWorkoutMatchKeys.add(key)))

  for (const log of weekLogs) {
    const plannedDateKey = getLogPlannedDateKey(log)

    if (plannedDateKey >= weekStartKey && plannedDateKey < weekEndKey) {
      completedOccurrenceKeys.add(getScheduleOccurrenceKey(log.workout.id, plannedDateKey))
      getWorkoutCompletionMatchKeys(log.workout).forEach((key) => completedWorkoutMatchKeysForWeek.add(key))
    }
  }

  // One-off workouts pinned to a date stay on that date; optimistic edits override.
  const oneOffByDay = new Map<string, Workout>()
  for (const workout of workouts) {
    if (workout.scheduledDate) {
      oneOffByDay.set(getDateKey(workout.scheduledDate), workout)
    }
  }
  for (const [dateKey, workout] of Object.entries(optimisticScheduleByDate)) {
    if (workout) {
      oneOffByDay.set(dateKey, workout)
    } else {
      oneOffByDay.delete(dateKey)
    }
  }

  const remaining = workouts
    .filter((workout) => {
      const plannedDateKey = getRecurringWorkoutPlannedDateKey(workout, weekStart)

      return Boolean(
        plannedDateKey &&
          !completedOccurrenceKeys.has(getScheduleOccurrenceKey(workout.id, plannedDateKey)) &&
          !getWorkoutCompletionMatchKeys(workout).some((key) => completedWorkoutMatchKeysForWeek.has(key)),
      )
    })
    .sort((left, right) => DISPLAY_WEEKDAY_ORDER.indexOf(left.scheduledDay as number) - DISPLAY_WEEKDAY_ORDER.indexOf(right.scheduledDay as number))

  const occupied = cells.map((cell) => logByDay.has(cell.dateKey) || oneOffByDay.has(cell.dateKey))
  const assigned = new Array<Workout | null>(cells.length).fill(null)

  for (const session of remaining) {
    const schedIndex = DISPLAY_WEEKDAY_ORDER.indexOf(session.scheduledDay as number)
    const start = Math.max(0, todayIndex < 0 ? schedIndex : Math.max(todayIndex, schedIndex))
    for (let i = start; i < cells.length; i += 1) {
      if (!occupied[i]) {
        occupied[i] = true
        assigned[i] = session
        break
      }
    }
  }

  return cells.map((cell, index) => {
    const isPast = cell.dateKey < todayKey
    const dayIsToday = cell.dateKey === todayKey
    const log = logByDay.get(cell.dateKey) ?? null

    if (log) {
      const logHasCoachUpdate = getWorkoutCompletionMatchKeys(log.workout).some((key) => coachUpdatedWorkoutMatchKeys.has(key))
      const entryWorkout = logHasCoachUpdate ? { ...log.workout, hasCoachUpdate: true } : log.workout

      return {
        date: cell.date,
        durationLabel: getDurationLabel(entryWorkout, log),
        isCatchUp: false,
        isCompleted: true,
        isMissed: false,
        isRolledOver: false,
        isToday: dayIsToday,
        log,
        source: entryWorkout.isPersonal ? "self" : "coach",
        weekday: cell.weekday,
        workout: entryWorkout,
      } satisfies ScheduleEntry
    }

    const oneOff = oneOffByDay.get(cell.dateKey) ?? null
    if (oneOff) {
      return {
        date: cell.date,
        durationLabel: getDurationLabel(oneOff, null),
        isCatchUp: false,
        isCompleted: false,
        isMissed: isPast,
        isRolledOver: false,
        isToday: dayIsToday,
        log: null,
        source: oneOff.isPersonal ? "self" : "coach",
        weekday: cell.weekday,
        workout: oneOff,
      } satisfies ScheduleEntry
    }

    const placed = assigned[index]
    const schedIndex = placed && typeof placed.scheduledDay === "number" ? DISPLAY_WEEKDAY_ORDER.indexOf(placed.scheduledDay) : -1

    return {
      date: cell.date,
      durationLabel: getDurationLabel(placed, null),
      isCatchUp: Boolean(placed) && todayIndex >= 0 && schedIndex < todayIndex,
      isCompleted: false,
      isMissed: false,
      isRolledOver: false,
      isToday: dayIsToday,
      log: null,
      source: placed?.isPersonal ? "self" : "coach",
      weekday: cell.weekday,
      workout: placed,
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
  showCoachUpdateDot = true,
  onRestDayClick,
  onPreviewWorkout,
  onReviewLog,
}: {
  entry: ScheduleEntry
  showCoachUpdateDot?: boolean
  onRestDayClick: (date: Date) => void
  onPreviewWorkout?: (workout: Workout, date: Date) => void
  onReviewLog: (log: WorkoutLog) => void
}) {
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
  const workout = entry.workout
  const badge = getStatusBadge(entry, messages)
  const hasCoachUpdate = showCoachUpdateDot && Boolean(workout?.hasCoachUpdate)
  const tag = getRoutineTag(workout)

  return (
    <div
      className={cn(
        "relative flex min-h-[130px] flex-col gap-2.5 rounded-[10px] border bg-card p-4 transition-colors duration-150",
        entry.isToday ? "border-primary" : workout ? "border-border hover:border-input" : "border-border",
        entry.isCompleted && "bg-muted/60",
      )}
    >
      {hasCoachUpdate ? (
        <span
          aria-hidden="true"
          className="absolute right-4 top-[18px] h-2 w-2 rounded-full bg-primary"
        />
      ) : null}
      <div className={cn("flex items-start justify-between gap-2", hasCoachUpdate && "pr-5")}>
        <div>
          <div className={cn("label-micro", entry.isToday ? "text-primary" : "text-muted-foreground")}>
            {format(entry.date, "EEE", { locale: dateLocale })}
          </div>
          <div className={cn("mt-0.5 font-mono text-lg font-semibold leading-none tnum", entry.isToday ? "text-primary" : "text-foreground")}>
            {format(entry.date, "d")}
          </div>
        </div>
        {badge ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]", badge.className)}>
              {badge.label}
            </span>
          </div>
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

          {entry.isCompleted && entry.log ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-auto justify-start px-0 text-primary hover:bg-transparent hover:text-primary"
              onClick={() => onReviewLog(entry.log as WorkoutLog)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {messages.schedule.review}
            </Button>
          ) : entry.isToday ? (
            <Button asChild size="sm" className="mt-auto">
              <Link href={`/workout/${workout.id}/start`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                {entry.log && !entry.log.completedAt ? messages.schedule.resume : messages.workoutPage.start}
              </Link>
            </Button>
          ) : onPreviewWorkout ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-auto justify-start px-0 text-primary hover:bg-transparent hover:text-primary"
              onClick={() => onPreviewWorkout(workout, entry.date)}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Preview
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="mt-auto justify-start px-0 text-primary hover:bg-transparent hover:text-primary">
              <Link href={`/workout/${workout.id}/start`}>
                <Play className="h-3.5 w-3.5 fill-current" />
                {messages.schedule.open}
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

function RoutineFieldNum({
  allowDecimals,
  label,
  onChange,
  placeholder,
  value,
}: {
  allowDecimals?: boolean
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <input
        type={allowDecimals ? "number" : "text"}
        inputMode={allowDecimals ? "decimal" : "numeric"}
        min="0"
        step={allowDecimals ? "0.5" : "1"}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 w-full rounded border border-border bg-background px-2 text-center font-mono text-sm text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      />
    </div>
  )
}

function getRoutineExerciseTitle(exercise: RoutineExercise) {
  if (!exercise.fallbackExerciseName) {
    return exercise.variationId
  }

  if (exercise.fallbackVariationName && !exercise.fallbackIsDefault) {
    return `${exercise.fallbackExerciseName} - ${exercise.fallbackVariationName}`
  }

  return exercise.fallbackExerciseName
}

function getRoutineExerciseMeta(exercise: RoutineExercise) {
  return [exercise.fallbackMuscleGroup, exercise.fallbackEquipment].filter(Boolean).join(" · ")
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
  const [pickerTarget, setPickerTarget] = useState<string | "add" | null>(null)

  useEffect(() => {
    if (!open) {
      setName("")
      setTag("push")
      setExercises([])
      setPickerTarget(null)
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

  const pickExercise = (option: ExerciseVariationOption) => {
    if (pickerTarget === "add") {
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
    } else if (pickerTarget) {
      updateExercise(pickerTarget, {
        fallbackEquipment: option.equipment,
        fallbackExerciseName: option.exerciseName,
        fallbackIsDefault: option.isDefault,
        fallbackMuscleGroup: option.muscleGroup,
        fallbackVariationName: option.variationName,
        variationId: option.id,
      })
    }

    setPickerTarget(null)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[90] flex h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-[14px] border-border p-0 sm:h-[90svh] sm:max-w-[680px]">
        <DialogHeader className="shrink-0 gap-0 border-b border-border px-4 pb-[18px] pr-12 pt-5 text-left sm:px-7 sm:pr-12 sm:pt-6">
          <p className="label-micro mb-1.5 text-muted-foreground">
            {messages.schedule.newRoutineForDate(date ? format(date, "EEE, MMM d", { locale: dateLocale }) : messages.schedule.restDayTitle)}
          </p>
          <DialogTitle className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {name.trim() || messages.workoutPage.untitledRoutine}
          </DialogTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {messages.workoutPage.exerciseCount(exercises.length)} · {messages.workoutPage.setCount(totalSets)}
          </p>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={messages.workoutPage.routineNamePlaceholder}
              className="flex-1 text-[15px]"
              autoFocus
            />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ROUTINE_TAGS.map((tagOption) => (
                <button
                  key={tagOption}
                  type="button"
                  onClick={() => setTag(tagOption)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    tag === tagOption
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/30",
                  )}
                >
                  <RoutineDot tag={tagOption} />
                  {getRoutineTagLabel(tagOption, messages)}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7">
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {exercises.length === 0 ? (
            <div className="mb-4 rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              {messages.workoutPage.noExercisesYet}
            </div>
          ) : null}

          <div className="space-y-2.5">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="rounded-[10px] border border-border bg-background p-3.5 sm:px-[18px]">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="min-w-[18px] text-right font-mono text-xs font-semibold text-muted-foreground tnum">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    title={messages.workoutPage.swapExercise}
                    onClick={() => setPickerTarget(exercise.id)}
                    disabled={isLoadingExercises || isSaving || exerciseOptions.length === 0}
                    className="min-w-0 flex-1 rounded-lg border border-border/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {getRoutineExerciseTitle(exercise) || messages.workoutPage.chooseExercise}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {getRoutineExerciseMeta(exercise) || messages.workoutPage.chooseExercise}
                      <span className="ml-1.5 text-primary/70">{messages.workoutPage.tapToSwap}</span>
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveExercise(index, -1)}
                      disabled={index === 0 || isSaving}
                      aria-label={messages.schedule.moveExerciseUp}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(index, 1)}
                      disabled={index === exercises.length - 1 || isSaving}
                      aria-label={messages.schedule.moveExerciseDown}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))}
                      aria-label={messages.workoutPage.removeExercise}
                      disabled={isSaving}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <RoutineFieldNum
                    label={messages.workoutPage.set}
                    value={String(exercise.sets)}
                    onChange={(value) => updateExercise(exercise.id, { sets: Math.max(1, Number(value) || 1) })}
                  />
                  <RoutineFieldNum
                    label={messages.workoutPage.reps}
                    value={exercise.reps}
                    onChange={(value) => updateExercise(exercise.id, { reps: value })}
                    placeholder="8-12"
                  />
                  <RoutineFieldNum
                    label="kg"
                    value={exercise.weight}
                    onChange={(value) => updateExercise(exercise.id, { weight: value })}
                    allowDecimals
                  />
                  <RoutineFieldNum
                    label="RIR"
                    value={exercise.rir ?? ""}
                    onChange={(value) => updateExercise(exercise.id, { rir: value })}
                    placeholder="0-4"
                  />
                  <RoutineFieldNum
                    label="REST"
                    value={exercise.restTime ?? ""}
                    onChange={(value) => updateExercise(exercise.id, { restTime: value })}
                    placeholder="90"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border py-3.5 text-sm font-medium text-primary transition-colors hover:bg-muted/50",
              (isLoadingExercises || isSaving || exerciseOptions.length === 0) && "cursor-not-allowed opacity-60",
            )}
            onClick={() => setPickerTarget("add")}
            disabled={isLoadingExercises || isSaving || exerciseOptions.length === 0}
          >
            {isLoadingExercises ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {messages.workoutPage.addExercise}
          </button>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2.5 border-t border-border bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button
            type="button"
            className="bg-foreground text-background hover:bg-foreground/90"
            disabled={!canSave}
            onClick={() => onSave({ exercises, id: createDraftId(), name: name.trim(), tag })}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {messages.schedule.saveRoutine}
          </Button>
        </DialogFooter>

        {pickerTarget ? (
          <AddExerciseModal
            existingVariationIds={exercises.map((exercise) => exercise.variationId).filter(Boolean)}
            exercises={exerciseOptions}
            onClose={() => setPickerTarget(null)}
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
            onPick={pickExercise}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CoachProgramCard({
  coachWorkouts,
  completedCount,
  plannedCount,
}: {
  coachWorkouts: Workout[]
  completedCount: number
  plannedCount: number
}) {
  const { messages } = useLocale()

  if (coachWorkouts.length === 0) {
    return null
  }

  const daysPerWeek = new Set(coachWorkouts.map((workout) => workout.scheduledDay).filter((day) => day != null)).size || coachWorkouts.length
  const progressPct = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0

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
          <span className="label-micro text-background/55">{messages.schedule.thisWeek}</span>
          <span className="font-mono text-[11px] text-background tnum">
            {completedCount}/{plannedCount}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-background/10">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between">
          <span className="label-micro text-background/40">{messages.schedule.completion}</span>
          <span className="font-mono text-[11px] text-background/60 tnum">{progressPct}%</span>
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
  onPreviewWorkout,
  onRestDayClick,
  onReviewLog,
  showCoachUpdateDots = true,
}: {
  entries: ScheduleEntry[]
  onPreviewWorkout?: (workout: Workout, date: Date) => void
  onRestDayClick: (date: Date) => void
  onReviewLog: (log: WorkoutLog) => void
  showCoachUpdateDots?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
      {entries.map((entry) => (
        <DayCard
          key={getDateKey(entry.date)}
          entry={entry}
          showCoachUpdateDot={showCoachUpdateDots}
          onPreviewWorkout={onPreviewWorkout}
          onRestDayClick={onRestDayClick}
          onReviewLog={onReviewLog}
        />
      ))}
    </div>
  )
})

const NextWeekPreview = memo(function NextWeekPreview({
  entries,
  nextWeekStart,
  onPreviewWorkout,
  onRestDayClick,
  onReviewLog,
}: {
  entries: ScheduleEntry[]
  nextWeekStart: Date
  onPreviewWorkout: (workout: Workout, date: Date) => void
  onRestDayClick: (date: Date) => void
  onReviewLog: (log: WorkoutLog) => void
}) {
  const { messages } = useLocale()

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="label-micro">{messages.schedule.nextWeekRange(formatWeekRangeLabel(nextWeekStart))}</p>
        <span className="label-micro text-muted-foreground">{messages.schedule.previewWorkout}</span>
      </div>
      <div className="opacity-70">
        <CalendarGrid
          entries={entries}
          onPreviewWorkout={onPreviewWorkout}
          onRestDayClick={onRestDayClick}
          onReviewLog={onReviewLog}
        />
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

export function WeeklyCalendar({ historyLogs = [], recentLogs, schedule, scheduleEntries = [], weekLogs, workouts }: WeeklyCalendarProps) {
  const { session } = useAuth()
  const { locale, messages } = useLocale()
  const [showSource, setShowSource] = useState<SourceFilter>("all")
  const [showNextWeekPreview, setShowNextWeekPreview] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [optimisticScheduleByDate, setOptimisticScheduleByDate] = useState<Record<string, Workout | null>>({})
  const [visibleWorkouts, setVisibleWorkouts] = useState(workouts)
  const [visibleRecentLogs, setVisibleRecentLogs] = useState(recentLogs)
  const [visibleWeekLogs, setVisibleWeekLogs] = useState(weekLogs ?? [])
  const [extraRoutineLibrary, setExtraRoutineLibrary] = useState<Routine[]>([])
  const [selectedRestDate, setSelectedRestDate] = useState<Date | null>(null)
  const [selectedPreviewWorkout, setSelectedPreviewWorkout] = useState<{ date: Date; workout: Workout } | null>(null)
  const [selectedReviewLog, setSelectedReviewLog] = useState<WorkoutLog | null>(null)
  const [isLoadingPreviewWorkout, setIsLoadingPreviewWorkout] = useState(false)
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

  const weekStart = useMemo(() => startOfUtcWeekAsLocal(new Date()), [])
  const nextWeekStart = useMemo(() => addDays(weekStart, 7), [weekStart])
  const displayWeekStart = useMemo(() => addDays(weekStart, weekOffset * 7), [weekStart, weekOffset])
  const logsForDisplay = visibleWeekLogs.length > 0 ? visibleWeekLogs : visibleRecentLogs
  const hasOptimisticSchedule = Object.keys(optimisticScheduleByDate).length > 0

  // All available logs deduplicated — used to build past/future week entries.
  const allLogs = useMemo(() => {
    const seen = new Set<string>()
    const combined: WorkoutLog[] = []
    for (const log of [...historyLogs, ...visibleRecentLogs, ...visibleWeekLogs]) {
      if (!seen.has(log.id)) {
        seen.add(log.id)
        combined.push(log)
      }
    }
    return combined
  }, [historyLogs, visibleRecentLogs, visibleWeekLogs])

  const displayWeekEntries = useMemo(() => {
    if (weekOffset === 0) {
      if (!hasOptimisticSchedule && scheduleEntries.length > 0) {
        return scheduleEntries
      }
      return buildWeekEntries({
        logs: logsForDisplay,
        optimisticScheduleByDate,
        weekStart,
        workouts: visibleWorkouts,
      })
    }
    return buildWeekEntries({
      logs: allLogs,
      optimisticScheduleByDate: {},
      weekStart: displayWeekStart,
      workouts: visibleWorkouts,
    })
  }, [weekOffset, hasOptimisticSchedule, scheduleEntries, logsForDisplay, allLogs, optimisticScheduleByDate, weekStart, displayWeekStart, visibleWorkouts])

  const nextWeekEntries = useMemo(() => {
    if (!showNextWeekPreview || weekOffset !== 0) {
      return []
    }

    return buildWeekEntries({
      logs: visibleRecentLogs,
      optimisticScheduleByDate,
      weekStart: nextWeekStart,
      workouts: visibleWorkouts,
    })
  }, [nextWeekStart, optimisticScheduleByDate, showNextWeekPreview, weekOffset, visibleRecentLogs, visibleWorkouts])

  const routineLibrary = useMemo(() => [
    ...extraRoutineLibrary,
    ...visibleWorkouts
      .filter((workout) => !workout.scheduledDate)
      .slice()
      .sort((left, right) => Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal)))
      .map((workout, index) => mapWorkoutToRoutine(workout, index)),
  ], [extraRoutineLibrary, visibleWorkouts])

  const coachWorkouts = useMemo(() => visibleWorkouts.filter((workout) => !workout.isPersonal), [visibleWorkouts])
  const closeReviewLabel = locale === "vi" ? "Đóng" : "Close"
  const plannedCount = useMemo(() => displayWeekEntries.filter((entry) => entry.workout && !entry.isRolledOver).length, [displayWeekEntries])
  const completedCount = useMemo(() => displayWeekEntries.filter((entry) => entry.isCompleted).length, [displayWeekEntries])
  const filteredDisplayWeek = useMemo(
    () => displayWeekEntries.filter((entry) => showSource === "all" || !entry.workout || entry.source === showSource),
    [showSource, displayWeekEntries],
  )
  const filteredNextWeek = useMemo(
    () => nextWeekEntries.filter((entry) => showSource === "all" || !entry.workout || entry.source === showSource),
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

  const openWorkoutPreview = async (workout: Workout, date: Date) => {
    setSelectedPreviewWorkout({ date, workout })

    if (!session?.access_token) {
      return
    }

    setIsLoadingPreviewWorkout(true)

    try {
      const workoutDetail = await fetchWorkoutDetail(session.access_token, workout.id)
      setSelectedPreviewWorkout({
        date,
        workout: {
          ...workoutDetail,
          hasCoachUpdate: workout.hasCoachUpdate,
        },
      })
    } catch {
      setSelectedPreviewWorkout({ date, workout })
    } finally {
      setIsLoadingPreviewWorkout(false)
    }
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
          const parsedRir = Number(exercise.rir)
          const parsedWeight = Number(exercise.weight)
          const parsedRest = Number(exercise.restTime)

          return {
            reps: repTarget.reps,
            repsMin: repTarget.repsMin,
            rir: exercise.rir?.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
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
      rir?: number
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
        const parsedRir = Number(exercise.rir)
        const parsedRest = Number(exercise.restTime)

        return {
          reps: repTarget.reps,
          repsMin: repTarget.repsMin,
          rir: exercise.rir?.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
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

  const weekRangeLabel = (() => {
    const range = formatWeekRangeLabel(displayWeekStart)
    if (weekOffset === 0) return messages.schedule.thisWeekRange(range)
    if (weekOffset === -1) return messages.schedule.lastWeekRange(range)
    if (weekOffset === 1) return messages.schedule.nextWeekRange(range)
    return range
  })()

  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <p className="label-micro">{weekRangeLabel}</p>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekOffset((o) => o + 1)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-primary transition-colors hover:underline"
              >
                {messages.schedule.todayLabel}
              </button>
            ) : null}
          </div>
          <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em] sm:text-[36px]">{messages.schedule.plannedSessions(plannedCount)}</h1>
          <p className="mt-2 font-mono text-[13px] text-muted-foreground tnum">
            {messages.schedule.doneToGo(completedCount, plannedCount, Math.max(0, plannedCount - completedCount))}
          </p>
        </div>
        <SourceFilters showSource={showSource} onChange={setShowSource} />
      </div>

      {weekOffset === 0 ? (
        <CoachProgramCard coachWorkouts={coachWorkouts} completedCount={completedCount} plannedCount={plannedCount} />
      ) : null}

      <p className="label-micro mb-3">{weekOffset === 0 ? messages.schedule.thisWeek : formatWeekRangeLabel(displayWeekStart)}</p>
      <div className="mb-8">
        <CalendarGrid
          entries={filteredDisplayWeek}
          onPreviewWorkout={(workout, date) => void openWorkoutPreview(workout, date)}
          onRestDayClick={(date) => {
            setSelectedRestDate(date)
            setRoutineError(null)
          }}
          onReviewLog={setSelectedReviewLog}
        />
      </div>

      {weekOffset === 0 && showNextWeekPreview ? (
        <NextWeekPreview
          entries={filteredNextWeek}
          nextWeekStart={nextWeekStart}
          onPreviewWorkout={(workout, date) => void openWorkoutPreview(workout, date)}
          onRestDayClick={(date) => {
            setSelectedRestDate(date)
            setRoutineError(null)
          }}
          onReviewLog={setSelectedReviewLog}
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

      <Dialog open={Boolean(selectedReviewLog)} onOpenChange={(open) => (!open ? setSelectedReviewLog(null) : undefined)}>
        <DialogContent className="z-[95] flex h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-[14px] border-border p-0 sm:h-[86svh] sm:max-w-[820px]">
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pr-12 pt-5 text-left sm:px-6 sm:pr-12">
            <DialogTitle className="text-xl font-semibold leading-tight tracking-[0] text-foreground">
              {selectedReviewLog?.workout.name ?? messages.workoutPage.workout}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.08em]">
              {selectedReviewLog ? format(selectedReviewLog.startedAt, "EEE, MMM d · HH:mm") : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedReviewLog ? <WorkoutLogReview log={selectedReviewLog} /> : null}
          <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" onClick={() => setSelectedReviewLog(null)}>
              {closeReviewLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedPreviewWorkout)} onOpenChange={(open) => (!open ? setSelectedPreviewWorkout(null) : undefined)}>
        <DialogContent className="z-[95] flex h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-[14px] border-border p-0 sm:h-[86svh] sm:max-w-[820px]">
          <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pr-12 pt-5 text-left sm:px-6 sm:pr-12">
            <DialogTitle className="text-xl font-semibold leading-tight tracking-[0] text-foreground">
              {selectedPreviewWorkout?.workout.name ?? messages.workoutPage.workout}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.08em]">
              {selectedPreviewWorkout ? format(selectedPreviewWorkout.date, "EEE, MMM d") : ""}
            </DialogDescription>
          </DialogHeader>
          {isLoadingPreviewWorkout ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {messages.common.loading}
            </div>
          ) : selectedPreviewWorkout ? (
            <WorkoutPlanPreview workout={selectedPreviewWorkout.workout} />
          ) : null}
          <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
            <Button type="button" variant="ghost" onClick={() => setSelectedPreviewWorkout(null)}>
              {closeReviewLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
