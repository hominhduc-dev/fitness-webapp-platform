"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { addDays, addWeeks, differenceInMinutes, format, isSameDay, isToday, startOfWeek } from "date-fns"
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  MoonStar,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Workout, WorkoutExercise, WorkoutLog, WeeklySchedule } from "@/lib/types"

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type ScheduleEntryStatus = "active" | "completed" | "missed" | "rest" | "upcoming"

type WeeklyCalendarProps = {
  recentLogs: WorkoutLog[]
  schedule: WeeklySchedule
}

type ScheduleEntry = {
  actionHref?: string
  ctaLabel?: string
  date: Date
  durationLabel: string
  exerciseGroups: string[]
  isSelected: boolean
  isToday: boolean
  log: WorkoutLog | null
  progress: number
  status: ScheduleEntryStatus
  volumeLabel?: string
  weekday: number
  workout: Workout | null
}

function getExerciseGroups(workout: Workout | null) {
  if (!workout) {
    return []
  }

  return Array.from(new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))).slice(0, 3)
}

function getWorkoutSetProgress(workout: Workout | null) {
  if (!workout) {
    return 0
  }

  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const completedSets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  )

  if (totalSets === 0) {
    return 0
  }

  return Math.round((completedSets / totalSets) * 100)
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
    const minutes = Math.max(1, differenceInMinutes(log.completedAt, log.startedAt))
    return `${minutes} min`
  }

  if (workout?.duration) {
    return `${workout.duration} min`
  }

  return "45 min"
}

function getVolumeLabel(log: WorkoutLog | null) {
  if (!log?.totalVolume) {
    return undefined
  }

  return `${Math.round(log.totalVolume).toLocaleString()} volume`
}

function getEntryStatus(date: Date, workout: Workout | null, log: WorkoutLog | null): ScheduleEntryStatus {
  if (!workout) {
    return "rest"
  }

  if (log) {
    return "completed"
  }

  if (isToday(date)) {
    return "active"
  }

  return date < new Date() ? "missed" : "upcoming"
}

function getEntryCta(status: ScheduleEntryStatus, workout: Workout | null, progress: number) {
  if (!workout) {
    return {}
  }

  if (status === "active") {
    return {
      actionHref: `/workout/${workout.id}/start`,
      ctaLabel: progress > 0 ? "Resume Session" : "Start Session",
    }
  }

  if (status === "upcoming") {
    return {
      actionHref: `/workout/${workout.id}/start`,
      ctaLabel: "Preview Workout",
    }
  }

  return {}
}

function getStatusBadge(entry: ScheduleEntry) {
  switch (entry.status) {
    case "completed":
      return <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">COMPLETED</Badge>
    case "active":
      return <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">ACTIVE NOW</Badge>
    case "missed":
      return <Badge variant="outline" className="rounded-full border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-700">MISSED</Badge>
    case "upcoming":
      return <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground">UPCOMING</Badge>
    default:
      return <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground">REST DAY</Badge>
  }
}

function getStatusIcon(entry: ScheduleEntry) {
  switch (entry.status) {
    case "completed":
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
      )
    case "active":
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Dumbbell className="h-7 w-7" />
        </div>
      )
    case "rest":
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <MoonStar className="h-7 w-7" />
        </div>
      )
    case "missed":
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Clock3 className="h-7 w-7" />
        </div>
      )
    default:
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Target className="h-7 w-7" />
        </div>
      )
  }
}

function formatHeaderMonth(weekStart: Date) {
  return format(weekStart, "MMMM yyyy")
}

function formatWeekRange(weekStart: Date) {
  return `${format(weekStart, "MMMM d")} - ${format(addDays(weekStart, 6), "d, yyyy")}`
}

function getFocusCopy(entry: ScheduleEntry) {
  if (!entry.workout) {
    return "Use today to recover, stretch, and prepare for the next hard session."
  }

  const [primaryGroup, secondaryGroup, tertiaryGroup] = entry.exerciseGroups

  if (entry.status === "completed") {
    return `Session completed with ${entry.volumeLabel ?? "solid effort"}. Review technique notes and recover well before the next lift.`
  }

  return `Focus on controlled reps for ${primaryGroup ?? "your main lift"}${secondaryGroup ? `, stay sharp through ${secondaryGroup.toLowerCase()}` : ""}${tertiaryGroup ? `, and finish strong on ${tertiaryGroup.toLowerCase()}` : ""}.`
}

function getExerciseLine(exercise: WorkoutExercise) {
  const targetSet = exercise.sets[0]
  return `${exercise.sets.length} sets x ${targetSet?.targetReps ?? 0} reps`
}

function renderDesktopSummaryCard(entry: ScheduleEntry, onSelect: () => void) {
  const summaryTitle = entry.workout ? `${format(entry.date, "EEE, MMM d")} - ${entry.workout.name}` : `${format(entry.date, "EEE, MMM d")} - Rest Day`

  return (
    <button
      key={entry.weekday}
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[28px] border bg-card p-6 text-left transition-all",
        entry.status === "completed" && "border-emerald-100 shadow-[0_16px_40px_rgba(16,185,129,0.07)]",
        entry.status === "rest" && "border-dashed border-border/80 bg-muted/10",
        entry.status === "missed" && "border-amber-200 bg-amber-50/40",
        entry.status === "upcoming" && "border-border/70 hover:border-primary/20 hover:shadow-[0_18px_40px_rgba(37,99,235,0.08)]",
      )}
    >
      <div className="flex items-center gap-5">
        {getStatusIcon(entry)}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {getStatusBadge(entry)}
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">{summaryTitle}</h3>
          {entry.workout ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.exerciseGroups.map((group) => (
                <span key={group} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-base text-muted-foreground">Recovery focused. Mobility, light walking, and hydration.</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {entry.durationLabel}
            </span>
            {entry.volumeLabel ? (
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {entry.volumeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </button>
  )
}

function renderDesktopDetailCard(entry: ScheduleEntry) {
  if (!entry.workout) {
    return (
      <div className="rounded-[32px] border border-dashed border-border bg-card/70 p-7">
        <div className="mb-4 flex items-center justify-between">
          {getStatusBadge(entry)}
          <span className="text-sm font-medium text-muted-foreground">{format(entry.date, "EEEE, MMM d")}</span>
        </div>
        <div className="flex items-start gap-5">
          {getStatusIcon(entry)}
          <div>
            <h3 className="text-4xl font-bold tracking-tight text-foreground">Recovery Day</h3>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-muted-foreground">
              Stretch, walk, and keep intensity low today. This slot stays intentionally open so the rest of the week can stay sharp.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-[32px] border bg-card p-7 shadow-[0_30px_60px_rgba(15,23,42,0.05)]",
        entry.status === "active" && "border-primary shadow-[0_24px_60px_rgba(37,99,235,0.14)]",
        entry.status === "completed" && "border-emerald-200",
        entry.status === "missed" && "border-amber-200",
        entry.status === "upcoming" && "border-border/80",
      )}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-3">
            {getStatusBadge(entry)}
          </div>
          <h3 className="text-5xl font-bold tracking-tight text-foreground">{`${format(entry.date, "EEEE, MMM d")} - ${entry.workout.name}`}</h3>
          <p className="mt-2 text-2xl text-slate-500">Target: {entry.exerciseGroups.join(", ") || "Full body"}</p>
        </div>

        <div className="min-w-28 text-right">
          <p className="text-5xl font-bold tracking-tight text-primary">{entry.progress}%</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            {entry.status === "completed" ? "DONE" : "PROGRESS"}
          </p>
        </div>
      </div>

      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between text-sm font-medium text-slate-500">
          <span>{entry.status === "completed" ? "Session completed" : "Session progress"}</span>
          <span>{entry.progress}%</span>
        </div>
        <Progress value={entry.progress} className="h-3 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-primary" />
      </div>

      <div>
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Current Exercises</p>
        <div className="space-y-3">
          {entry.workout.exercises.slice(0, 4).map((exercise, index) => {
            const state =
              entry.status === "completed" ? "done" : entry.status === "active" && index === 0 ? "active" : "queued"

            return (
              <div
                key={exercise.id}
                className={cn(
                  "flex items-center justify-between rounded-[26px] border px-5 py-4 transition-all",
                  state === "done" && "border-emerald-100 bg-emerald-50",
                  state === "active" && "border-primary bg-primary/5 shadow-[inset_4px_0_0_0_var(--primary)]",
                  state === "queued" && "border-transparent bg-slate-50 text-slate-400",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold",
                      state === "done" && "border-emerald-200 bg-emerald-500 text-white",
                      state === "active" && "border-primary bg-white text-primary",
                      state === "queued" && "border-slate-200 bg-white text-slate-300",
                    )}
                  >
                    {state === "done" ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div>
                    <p className={cn("text-2xl font-semibold", state === "queued" && "text-slate-400")}>{exercise.exercise.name}</p>
                    <p className={cn("text-base", state === "queued" ? "text-slate-300" : "text-slate-500")}>{getExerciseLine(exercise)}</p>
                  </div>
                </div>

                {state === "active" && entry.ctaLabel && entry.actionHref ? (
                  <Button asChild className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                    <Link href={entry.actionHref}>{entry.ctaLabel === "Preview Workout" ? "Open" : "Resume"}</Link>
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {entry.ctaLabel && entry.actionHref ? (
        <div className="mt-6 flex justify-end">
          <Button asChild className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
            <Link href={entry.actionHref}>
              {entry.status === "active" ? <Play className="mr-2 h-4 w-4" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              {entry.ctaLabel}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function renderMobileCard(entry: ScheduleEntry, onSelect: () => void) {
  return (
    <button
      key={entry.weekday}
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[28px] border bg-card p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all",
        entry.status === "completed" && "border-emerald-100",
        entry.status === "rest" && "border-dashed border-border/70 bg-muted/5 shadow-none",
        entry.status === "active" && "border-primary shadow-[0_18px_34px_rgba(37,99,235,0.16)]",
        entry.status === "upcoming" && "border-border/70 opacity-80",
        entry.status === "missed" && "border-amber-200 bg-amber-50/40",
      )}
    >
      <div className="flex items-start gap-4">
        {getStatusIcon(entry)}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              {entry.isToday ? "Today" : format(entry.date, "EEE, MMM d")}
            </p>
            {getStatusBadge(entry)}
          </div>

          <h3 className={cn("text-2xl font-bold tracking-tight", !entry.workout && "text-slate-500")}>
            {entry.workout ? entry.workout.name : "Rest Day"}
          </h3>

          {entry.workout ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.exerciseGroups.map((group) => (
                <span key={group} className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {group}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-base leading-7 text-muted-foreground">Status: Recovery focused. Stretching, easy cardio, and mobility.</p>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {entry.durationLabel}
            </span>
            {entry.volumeLabel ? <span className="font-semibold text-emerald-600">{entry.volumeLabel}</span> : null}
          </div>

          {entry.workout && (entry.status === "active" || entry.status === "completed") ? (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span className="text-slate-500">{entry.status === "completed" ? "Completed" : "Session Progress"}</span>
                <span className={cn(entry.status === "completed" ? "text-emerald-600" : "text-primary")}>{entry.progress}%</span>
              </div>
              <Progress value={entry.progress} className="h-2.5 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-primary" />
            </div>
          ) : null}

          {entry.ctaLabel && entry.actionHref ? (
            <Button asChild className="mt-5 h-12 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-[0_14px_28px_rgba(37,99,235,0.25)] hover:bg-primary/90">
              <Link href={entry.actionHref}>{entry.ctaLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function WeeklyCalendar({ recentLogs, schedule }: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedWeekday, setSelectedWeekday] = useState(new Date().getDay())

  const weekStart = useMemo(() => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }), [weekOffset])

  const entries = useMemo(() => {
    return DISPLAY_ORDER.map((weekdayOffset) => {
      const date = addDays(weekStart, DISPLAY_ORDER.indexOf(weekdayOffset))
      const workout = schedule[date.getDay()] ?? null
      const log = getLogForDate(recentLogs, date, workout)
      const status = getEntryStatus(date, workout, log)
      const progress = log ? 100 : status === "active" ? getWorkoutSetProgress(workout) : 0
      const entryBase = {
        date,
        durationLabel: getDurationLabel(workout, log),
        exerciseGroups: getExerciseGroups(workout),
        isSelected: date.getDay() === selectedWeekday,
        isToday: isToday(date),
        log,
        progress,
        status,
        volumeLabel: getVolumeLabel(log),
        weekday: date.getDay(),
        workout,
      }

      return {
        ...entryBase,
        ...getEntryCta(status, workout, progress),
      } satisfies ScheduleEntry
    })
  }, [recentLogs, schedule, selectedWeekday, weekStart])

  const selectedEntry = entries.find((entry) => entry.weekday === selectedWeekday) ?? entries[0]
  const completedCount = entries.filter((entry) => entry.status === "completed").length
  const scheduledCount = entries.filter((entry) => entry.workout).length
  const restCount = entries.filter((entry) => entry.status === "rest").length
  const totalWeekVolume = entries.reduce((sum, entry) => sum + (entry.log?.totalVolume ?? 0), 0)
  const volumeBars = entries.map((entry) => Math.max(entry.log?.totalVolume ?? 0, 0))
  const maxVolume = Math.max(...volumeBars, 1)

  return (
    <section className="space-y-6">
      <div className="rounded-[32px] border border-border/70 bg-card/70 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.05)] md:p-8">
        <div className="flex items-start justify-between gap-4 md:hidden">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/10 bg-primary/10 text-primary">
              <CalendarDays className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Schedule</h1>
              <p className="mt-1 text-lg text-slate-500">{formatHeaderMonth(weekStart)}</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl bg-white shadow-sm">
            <CalendarDays className="h-5 w-5" />
          </Button>
        </div>

        <div className="hidden items-end justify-between gap-6 md:flex">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-foreground">Weekly Schedule</h1>
            <p className="mt-2 text-3xl text-slate-500">{formatWeekRange(weekStart)}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
            <Button
              variant="ghost"
              className="rounded-xl px-5 text-base"
              onClick={() => setWeekOffset((current) => current - 1)}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl bg-slate-100 px-5 text-base hover:bg-slate-200"
              onClick={() => {
                setWeekOffset(0)
                setSelectedWeekday(new Date().getDay())
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl px-5 text-base"
              onClick={() => setWeekOffset((current) => current + 1)}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-7">
            {entries.map((entry) => (
              <button
                key={entry.weekday}
                type="button"
                onClick={() => setSelectedWeekday(entry.weekday)}
                className={cn(
                  "min-w-[92px] rounded-[26px] border px-4 py-5 text-center shadow-sm transition-all md:min-w-0",
                  entry.isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_18px_38px_rgba(37,99,235,0.25)]"
                    : "border-border/70 bg-white text-foreground hover:border-primary/20",
                )}
              >
                <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", entry.isSelected ? "text-primary-foreground/80" : "text-slate-400")}>
                  {format(entry.date, "EEE")}
                </p>
                <p className="mt-2 text-4xl font-bold leading-none">{format(entry.date, "d")}</p>
                <span
                  className={cn(
                    "mx-auto mt-3 block h-2.5 w-2.5 rounded-full",
                    entry.isSelected ? "bg-white" : entry.isToday ? "bg-primary" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <h2 className="mb-4 text-4xl font-bold tracking-tight text-foreground">Activity Overview</h2>
        <div className="space-y-4">
          {entries.map((entry) => renderMobileCard(entry, () => setSelectedWeekday(entry.weekday)))}
        </div>
      </div>

      <div className="hidden gap-6 xl:grid xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-4">
          {entries.map((entry) =>
            entry.isSelected
              ? (
                <div key={entry.weekday}>
                  {renderDesktopDetailCard(entry)}
                </div>
              )
              : (
                <div key={entry.weekday}>
                  {renderDesktopSummaryCard(entry, () => setSelectedWeekday(entry.weekday))}
                </div>
              ),
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[32px] bg-primary p-7 text-primary-foreground shadow-[0_24px_60px_rgba(37,99,235,0.24)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight">Today&apos;s Focus</p>
                <p className="text-sm uppercase tracking-[0.22em] text-primary-foreground/65">
                  {selectedEntry.workout ? selectedEntry.workout.name : "Recovery"}
                </p>
              </div>
            </div>
            <p className="text-lg leading-8 text-primary-foreground/90">{getFocusCopy(selectedEntry)}</p>
            <div className="mt-6 rounded-[24px] bg-white/12 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground/75">Daily Tip</p>
                <Zap className="h-4 w-4" />
              </div>
              <p className="text-sm leading-7 text-primary-foreground/85">
                Keep the bar path smooth and make every rep look the same from start to finish.
              </p>
            </div>
          </div>

          <div className="rounded-[30px] border border-border/70 bg-card p-7 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-3xl font-bold tracking-tight text-foreground">Recovery Status</h3>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">This week</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <span>Completion</span>
                  <span className="text-emerald-600">{scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0}%</span>
                </div>
                <Progress
                  value={scheduledCount > 0 ? (completedCount / scheduledCount) * 100 : 0}
                  className="h-2.5 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-emerald-500"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <span>Rest balance</span>
                  <span className="text-amber-500">{restCount} day{restCount === 1 ? "" : "s"}</span>
                </div>
                <Progress
                  value={Math.min(100, (restCount / 2) * 100)}
                  className="h-2.5 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-amber-400"
                />
              </div>
              <div className="rounded-[22px] border border-border/70 bg-slate-50 px-5 py-4 text-base italic text-slate-500">
                &quot;Recovery is where the gains happen.&quot;
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-border/70 bg-card p-7 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-bold tracking-tight text-foreground">Weekly Volume</h3>
                <p className="text-sm uppercase tracking-[0.16em] text-slate-400">Completed work</p>
              </div>
              <span className="text-sm font-semibold text-primary">{Math.round(totalWeekVolume).toLocaleString()} total</span>
            </div>
            <div className="mt-6 flex h-36 items-end gap-3">
              {volumeBars.map((value, index) => (
                <div key={`${entries[index]?.weekday}-${value}`} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-28 w-full items-end rounded-2xl bg-slate-100 p-2">
                    <div
                      className={cn(
                        "w-full rounded-xl transition-all",
                        entries[index]?.isSelected ? "bg-primary" : "bg-slate-300",
                      )}
                      style={{ height: `${Math.max(18, (value / maxVolume) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {format(entries[index].date, "EEE")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
