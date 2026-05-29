"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, isBefore, isSameDay, isToday, startOfDay, startOfWeek } from "date-fns"
import { CalendarDays, CheckCircle2, Loader2, MessageSquare, Play, Plus, Search, Trash2, User } from "lucide-react"

import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWorkout, fetchExercises } from "@/lib/fitness/api"
import { parseRepTargetText } from "@/lib/workout-reps"
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

type RoutineExerciseDraft = {
  id: string
  reps: string
  sets: number
  variationId: string
  weight: string
}

type RoutineDraft = {
  exercises: RoutineExerciseDraft[]
  kind: RoutineKind
  name: string
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
const ROUTINE_KIND_OPTIONS: RoutineKind[] = ["push", "pull", "legs", "full_body", "cardio", "other"]

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createRoutineExerciseDraft(defaultVariationId = ""): RoutineExerciseDraft {
  return {
    id: createDraftId(),
    reps: "8-12",
    sets: 3,
    variationId: defaultVariationId,
    weight: "",
  }
}

function formatRoutineKind(kind?: string) {
  if (!kind || kind === "full_body") {
    return kind === "full_body" ? "full" : "other"
  }

  return kind
}

function normalizeRoutineKind(kind?: string): RoutineKind {
  if (kind === "push" || kind === "pull" || kind === "legs" || kind === "full_body" || kind === "cardio" || kind === "other") {
    return kind
  }

  return "other"
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
    return "rest"
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

function RoutineDot({ kind }: { kind?: string }) {
  return <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getTagColor(formatRoutineKind(kind)) }} />
}

function RoutinePickerDialog({
  date,
  error,
  isSaving,
  onClose,
  onCreateNew,
  onPickTemplate,
  open,
  templates,
}: {
  date: Date | null
  error: string | null
  isSaving: boolean
  onClose: () => void
  onCreateNew: () => void
  onPickTemplate: (template: Workout) => void
  open: boolean
  templates: Workout[]
}) {
  const [query, setQuery] = useState("")
  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return templates
      .filter((template) => template.exercises.length > 0)
      .filter((template) => {
        if (!normalized) {
          return true
        }

        return [template.name, template.kind ?? "", ...template.exercises.map((exercise) => exercise.exercise.name)]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      })
  }, [query, templates])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="z-[80] max-h-[72svh] overflow-hidden rounded-[14px] border-border p-0 sm:max-w-[400px]">
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-left">
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

        <div className="min-h-0 max-h-[42svh] overflow-y-auto">
          {error ? (
            <div className="border-b border-destructive/20 bg-destructive/5 px-5 py-3 text-sm text-destructive">{error}</div>
          ) : null}
          {visibleTemplates.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No saved routines yet. Create a new routine for this rest day.
            </div>
          ) : (
            visibleTemplates.map((template, index) => (
              <button
                key={template.id}
                type="button"
                disabled={isSaving}
                onClick={() => onPickTemplate(template)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
                  index < visibleTemplates.length - 1 && "border-b border-border",
                )}
              >
                <RoutineDot kind={template.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{template.name}</span>
                  <span className="label-micro mt-0.5 block">
                    {formatRoutineKind(template.kind)} · {template.exercises.length} exercise{template.exercises.length === 1 ? "" : "s"}
                  </span>
                </span>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </button>
            ))
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3 sm:justify-center">
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
  onSave: (routine: RoutineDraft) => void
  open: boolean
}) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<RoutineKind>("push")
  const [exercises, setExercises] = useState<RoutineExerciseDraft[]>([])

  useEffect(() => {
    if (!open) {
      setName("")
      setKind("push")
      setExercises([])
    }
  }, [open])

  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
  const canSave = name.trim().length > 0 && exercises.length > 0 && exercises.every((exercise) => exercise.variationId) && !isSaving

  const addExercise = () => {
    setExercises((current) => [...current, createRoutineExerciseDraft(exerciseOptions[0]?.id ?? "")])
  }

  const updateExercise = (exerciseId: string, patch: Partial<RoutineExerciseDraft>) => {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    )
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
              {ROUTINE_KIND_OPTIONS.map((kindOption) => (
                <button
                  key={kindOption}
                  type="button"
                  onClick={() => setKind(kindOption)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors",
                    kind === kindOption
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <RoutineDot kind={kindOption} />
                  {formatRoutineKind(kindOption)}
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
                      selectedVariationId={exercise.variationId}
                      disabled={isLoadingExercises || isSaving}
                      onSelect={(variationId) => updateExercise(exercise.id, { variationId })}
                    />
                  </div>
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
            onClick={addExercise}
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
          <Button type="button" disabled={!canSave} onClick={() => onSave({ exercises, kind, name: name.trim() })}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save routine
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

  const templateWorkouts = visibleWorkouts
    .filter((workout) => !workout.scheduledDate)
    .slice()
    .sort((left, right) => Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal)))

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
    setIsRoutineBuilderOpen(true)
    void ensureExerciseOptions()
  }

  const saveTemplateToRestDate = async (template: Workout) => {
    if (!selectedRestDate || !session?.access_token || isSavingRoutine) {
      return
    }

    if (template.exercises.length === 0) {
      setRoutineError("This routine has no exercises yet.")
      return
    }

    setIsSavingRoutine(true)
    setRoutineError(null)

    try {
      const createdWorkout = await createWorkout(session.access_token, {
        duration: template.duration,
        exercises: template.exercises.map((exercise) => ({
          reps: Math.max(1, exercise.sets[0]?.targetReps ?? 1),
          repsMin: exercise.sets[0]?.targetRepsMin,
          sets: Math.max(1, exercise.sets.length),
          variationId: exercise.variation.id,
          weight: exercise.sets[0]?.weight,
        })),
        kind: template.kind,
        name: template.name,
        notes: template.notes,
        scheduledDate: format(selectedRestDate, "yyyy-MM-dd"),
      })

      handleWorkoutSaved(createdWorkout, undefined, selectedRestDate)
      closeRoutineFlow()
    } catch (saveError) {
      setRoutineError(saveError instanceof Error ? saveError.message : "Unable to add this routine.")
    } finally {
      setIsSavingRoutine(false)
    }
  }

  const saveDraftToRestDate = async (routine: RoutineDraft) => {
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
        kind: routine.kind,
        name: routine.name,
        scheduledDate: format(selectedRestDate, "yyyy-MM-dd"),
      })

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
        open={Boolean(selectedRestDate) && !isRoutineBuilderOpen}
        templates={templateWorkouts}
        onClose={closeRoutineFlow}
        onCreateNew={openRoutineBuilder}
        onPickTemplate={(template) => void saveTemplateToRestDate(template)}
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
