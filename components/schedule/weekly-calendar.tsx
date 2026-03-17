"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, isSameDay, isToday, startOfWeek } from "date-fns"
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Dumbbell,
  MoonStar,
  Play,
  Target,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Workout, WorkoutExercise, WorkoutLog, WeeklySchedule } from "@/lib/types"

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type ScheduleEntryStatus = "active" | "completed" | "missed" | "rest" | "upcoming"
type DesktopExerciseState = "completed" | "active" | "upcoming"

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

  if (status === "upcoming" || status === "missed") {
    return {
      actionHref: `/workout/${workout.id}/start`,
      ctaLabel: "View Workout",
    }
  }

  if (status === "completed") {
    return {
      actionHref: `/workout/${workout.id}/start`,
      ctaLabel: "Review Session",
    }
  }

  return {}
}

function getMobileTone(status: ScheduleEntryStatus) {
  switch (status) {
    case "active":
      return {
        accentTextClass: "text-primary",
        badge: "ACTIVE NOW",
        badgeClass: "bg-primary text-white shadow-[0_16px_30px_-18px_rgba(19,73,236,0.9)]",
        chipClass: "bg-primary/10 text-primary",
        focusSurfaceClass:
          "border-primary/25 bg-white shadow-[0_28px_58px_-38px_rgba(19,73,236,0.26)]",
        icon: Dumbbell,
        iconWrapClass: "bg-primary text-white shadow-[0_18px_36px_-20px_rgba(19,73,236,0.9)]",
        progressClass: "[&_[data-slot=progress-indicator]]:bg-primary",
        shortBadge: "LIVE",
        surfaceClass:
          "border-primary/20 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7ff_100%)] shadow-[0_28px_58px_-38px_rgba(19,73,236,0.48)]",
      }
    case "completed":
      return {
        accentTextClass: "text-emerald-600",
        badge: "COMPLETED",
        badgeClass: "bg-emerald-500 text-white shadow-[0_16px_30px_-18px_rgba(16,185,129,0.7)]",
        chipClass: "bg-emerald-50 text-emerald-700",
        focusSurfaceClass:
          "border-emerald-200/80 bg-white shadow-[0_28px_58px_-38px_rgba(16,185,129,0.18)]",
        icon: CheckCircle2,
        iconWrapClass: "bg-emerald-500 text-white shadow-[0_18px_36px_-20px_rgba(16,185,129,0.75)]",
        progressClass: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
        shortBadge: "DONE",
        surfaceClass:
          "border-emerald-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f4fcf8_100%)] shadow-[0_28px_58px_-38px_rgba(16,185,129,0.28)]",
      }
    case "missed":
      return {
        accentTextClass: "text-amber-600",
        badge: "MISSED",
        badgeClass: "bg-amber-500 text-white shadow-[0_16px_30px_-18px_rgba(245,158,11,0.75)]",
        chipClass: "bg-amber-50 text-amber-700",
        focusSurfaceClass:
          "border-amber-200/80 bg-white shadow-[0_28px_58px_-38px_rgba(245,158,11,0.18)]",
        icon: Clock3,
        iconWrapClass: "bg-amber-500 text-white shadow-[0_18px_36px_-20px_rgba(245,158,11,0.72)]",
        progressClass: "[&_[data-slot=progress-indicator]]:bg-amber-500",
        shortBadge: "LATE",
        surfaceClass:
          "border-amber-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fff9f1_100%)] shadow-[0_28px_58px_-38px_rgba(245,158,11,0.26)]",
      }
    case "upcoming":
      return {
        accentTextClass: "text-slate-700",
        badge: "UPCOMING",
        badgeClass: "bg-slate-900 text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.7)]",
        chipClass: "bg-slate-100 text-slate-600",
        focusSurfaceClass:
          "border-slate-200/80 bg-white shadow-[0_28px_58px_-38px_rgba(15,23,42,0.16)]",
        icon: Target,
        iconWrapClass: "bg-slate-900 text-white shadow-[0_18px_36px_-20px_rgba(15,23,42,0.7)]",
        progressClass: "[&_[data-slot=progress-indicator]]:bg-slate-900",
        shortBadge: "NEXT",
        surfaceClass:
          "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_28px_58px_-38px_rgba(15,23,42,0.22)]",
      }
    default:
      return {
        accentTextClass: "text-slate-500",
        badge: "RECOVERY",
        badgeClass: "bg-slate-200 text-slate-700",
        chipClass: "bg-slate-100 text-slate-500",
        focusSurfaceClass:
          "border-slate-200/80 bg-white shadow-[0_28px_58px_-38px_rgba(15,23,42,0.14)]",
        icon: MoonStar,
        iconWrapClass: "bg-slate-200 text-slate-700",
        progressClass: "[&_[data-slot=progress-indicator]]:bg-slate-400",
        shortBadge: "REST",
        surfaceClass:
          "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-[0_28px_58px_-38px_rgba(15,23,42,0.2)]",
      }
  }
}

function formatMobileFocusDate(entry: ScheduleEntry) {
  return entry.isToday ? `Today • ${format(entry.date, "MMM d")}` : format(entry.date, "EEEE • MMM d")
}

function getMobileFocusCopy(entry: ScheduleEntry) {
  const [primary, secondary, tertiary] = entry.exerciseGroups

  switch (entry.status) {
    case "active":
      return `The session is live. Stay crisp on ${primary ?? "the main lift"}${secondary ? `, keep tempo honest through ${secondary.toLowerCase()}` : ""}${tertiary ? `, and finish clean on ${tertiary.toLowerCase()}` : ""}.`
    case "completed":
      return `Session closed${entry.volumeLabel ? ` with ${entry.volumeLabel}` : ""}. Review the lifts, recover well, and keep the next workout straightforward.`
    case "missed":
      return "This slot slipped. Re-open it if you want to keep the split balanced and avoid stacking fatigue into the next sessions."
    case "upcoming":
      return "The plan is already set. Preview the lift order now so the warm-up and first working set are decided before you step in."
    default:
      return "Recovery is part of the plan. Keep movement light, bring fatigue down, and show up fresher for the next hard session."
  }
}

function getMobileAccentMetric(entry: ScheduleEntry) {
  switch (entry.status) {
    case "completed":
      return {
        label: "Volume",
        value: entry.volumeLabel ?? "Logged",
      }
    case "active":
      return {
        label: "Progress",
        value: `${entry.progress}%`,
      }
    case "missed":
      return {
        label: "Status",
        value: "Needs reset",
      }
    case "upcoming":
      return {
        label: "Focus",
        value: entry.exerciseGroups[0] ?? "Workout",
      }
    default:
      return {
        label: "Recovery",
        value: "Planned",
      }
  }
}

function formatHeaderMonth(weekStart: Date) {
  return format(weekStart, "MMMM yyyy")
}

function getExerciseLine(exercise: WorkoutExercise) {
  const targetSet = exercise.sets[0]
  return `${exercise.sets.length} sets x ${targetSet?.targetReps ?? 0} reps`
}

function getDesktopStatusLabel(entry: ScheduleEntry) {
  switch (entry.status) {
    case "completed":
      return "Completed Session"
    case "active":
      return "Active Session"
    case "missed":
      return "Missed Session"
    case "upcoming":
      return "Upcoming Session"
    default:
      return "Recovery Day"
  }
}

function getDesktopExerciseState(entry: ScheduleEntry, index: number): DesktopExerciseState {
  if (entry.status === "completed") {
    return "completed"
  }

  if (entry.status !== "active") {
    return "upcoming"
  }

  const completedExerciseCount = entry.progress >= 75 ? 2 : entry.progress >= 35 ? 1 : 0

  if (index < completedExerciseCount) {
    return "completed"
  }

  if (index === completedExerciseCount) {
    return "active"
  }

  return "upcoming"
}

function getDesktopExerciseStatusCopy(state: DesktopExerciseState) {
  switch (state) {
    case "completed":
      return "Completed"
    case "active":
      return "In Progress"
    default:
      return "Up Next"
  }
}

function getDesktopLoadValue(entry: ScheduleEntry) {
  if (entry.log?.totalVolume) {
    return entry.log.totalVolume
  }

  if (entry.workout) {
    return (entry.workout.duration ?? 45) * Math.max(entry.workout.exercises.length, 1) * 4
  }

  return 0
}

function getMobileExerciseValue(exercise: WorkoutExercise) {
  const reps = exercise.sets[0]?.targetReps ?? 0
  return `${exercise.sets.length} × ${reps}`
}

function renderMobileFocusCard(
  entry: ScheduleEntry,
  {
    completedSessions,
    nextWorkoutEntry,
    recoveryDays,
    scheduledSessions,
  }: {
    completedSessions: number
    nextWorkoutEntry: ScheduleEntry | null
    recoveryDays: number
    scheduledSessions: number
  },
) {
  const tone = getMobileTone(entry.status)
  const workout = entry.workout
  const accentMetric = getMobileAccentMetric(entry)
  const metrics = workout
    ? [
        { label: "Duration", value: entry.durationLabel },
        { label: "Exercises", value: `${workout.exercises.length}` },
        accentMetric,
      ]
    : [
        { label: "Planned", value: `${scheduledSessions}` },
        { label: "Done", value: `${completedSessions}` },
        { label: "Recovery", value: `${recoveryDays}` },
      ]

  return (
    <div className={cn("w-full max-w-full overflow-hidden rounded-[32px] border p-5 sm:px-6", tone.focusSurfaceClass)}>
      <div className="flex w-full max-w-full items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px]", tone.iconWrapClass)}>
            <tone.icon className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", tone.accentTextClass)}>
              {formatMobileFocusDate(entry)}
            </p>
            <h2 className="mt-2 break-words text-[clamp(1.8rem,9vw,2.35rem)] font-black leading-tight tracking-tight text-slate-950">
              {workout ? workout.name : "Recovery Day"}
            </h2>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]", tone.badgeClass)}>
          {tone.badge}
        </span>
      </div>
      <p className="mt-4 text-[15px] leading-7 text-slate-600">{getMobileFocusCopy(entry)}</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className={cn("rounded-[20px] px-3 py-3", tone.chipClass)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">{metric.label}</p>
            <p className="mt-2 break-words text-[1.05rem] font-black leading-tight">{metric.value}</p>
          </div>
        ))}
      </div>

      {workout ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.exerciseGroups.map((group) => (
              <span key={group} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]", tone.chipClass)}>
                {group}
              </span>
            ))}
          </div>

          {(entry.status === "active" || entry.status === "completed") && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3 text-[14px] font-bold text-slate-950">
                <span>{entry.status === "completed" ? "Session Completed" : "Session Progress"}</span>
                <span className={tone.accentTextClass}>{entry.progress}%</span>
              </div>
              <Progress value={entry.progress} className={cn("h-2.5 rounded-full bg-slate-200", tone.progressClass)} />
            </div>
          )}

          {(entry.status === "upcoming" || entry.status === "missed") && (
            <div className={cn("mt-6 rounded-[22px] px-4 py-4", tone.chipClass)}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] opacity-75">
                {entry.status === "missed" ? "Needs attention" : "Session note"}
              </p>
              <p className="mt-2 text-[14px] leading-6">
                {entry.status === "missed"
                  ? "Open the workout again if you want to catch up without guessing what comes next."
                  : "Preview the first movement and target reps now so the session starts with less friction."}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-slate-200/70 pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Exercise Preview</p>
              <p className="text-[12px] font-semibold text-slate-400">{workout.exercises.length} total</p>
            </div>

            <div className="mt-4 space-y-3">
              {workout.exercises.slice(0, 4).map((exercise, index) => {
                const state = getDesktopExerciseState(entry, index)

                return (
                  <div
                    key={exercise.id}
                    className="flex w-full max-w-full items-center justify-between gap-3 rounded-[18px] bg-white/80 px-4 py-3 shadow-[0_16px_36px_-34px_rgba(15,23,42,0.3)]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          state === "completed" && "bg-emerald-50 text-emerald-600",
                          state === "active" && tone.chipClass,
                          state === "upcoming" && "bg-slate-100 text-slate-400",
                        )}
                      >
                        {state === "completed" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className={cn("h-3.5 w-3.5", state === "active" && "fill-current")} />
                        )}
                      </div>
                      <span className="truncate text-[15px] font-semibold text-slate-950">{exercise.exercise.name}</span>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-slate-400">{getMobileExerciseValue(exercise)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {entry.ctaLabel && entry.actionHref ? (
            <Button
              asChild
              className={cn(
                "mt-6 h-14 w-full rounded-[18px] text-[1.02rem] font-bold text-white shadow-[0_18px_34px_-18px_rgba(15,23,42,0.35)]",
                entry.status === "completed" && "bg-emerald-500 hover:bg-emerald-500/90",
                entry.status === "active" && "bg-primary hover:bg-primary/90",
                entry.status === "missed" && "bg-amber-500 hover:bg-amber-500/90",
                entry.status === "upcoming" && "bg-slate-900 hover:bg-slate-900/90",
              )}
            >
              <Link href={entry.actionHref}>
                {entry.status === "active" || entry.status === "completed" ? <Play className="mr-2 h-4.5 w-4.5 fill-current" /> : null}
                {entry.ctaLabel}
              </Link>
            </Button>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.3)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Next session</p>
          {nextWorkoutEntry?.workout ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-slate-950">{nextWorkoutEntry.workout.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {format(nextWorkoutEntry.date, "EEE, MMM d")} • {nextWorkoutEntry.durationLabel}
                </p>
              </div>
              {nextWorkoutEntry.actionHref ? (
                <Link
                  href={nextWorkoutEntry.actionHref}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white"
                >
                  Open
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              No other training blocks are queued this week. Keep the day easy and reset for the next cycle.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function renderMobileQueueCard(entry: ScheduleEntry) {
  const tone = getMobileTone(entry.status)
  const cardContent = (
    <div className="w-full max-w-full overflow-hidden rounded-[26px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_22px_44px_-36px_rgba(15,23,42,0.32)]">
      <div className="flex w-full max-w-full items-start gap-3">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]", tone.iconWrapClass)}>
          <tone.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {format(entry.date, "EEE, MMM d")}
              </p>
              <p className="mt-1 truncate text-lg font-black tracking-tight text-slate-950">
                {entry.workout ? entry.workout.name : "Recovery Slot"}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", tone.chipClass)}>
              {tone.shortBadge}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {entry.workout
              ? `${entry.durationLabel} • ${entry.exerciseGroups.slice(0, 2).join(" • ") || "Full body"}`
              : "Mobility, walking, and lower fatigue output."}
          </p>
        </div>
        {entry.actionHref ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300" /> : null}
      </div>
    </div>
  )

  if (entry.actionHref) {
    return (
      <Link key={entry.weekday} href={entry.actionHref}>
        {cardContent}
      </Link>
    )
  }

  return <div key={entry.weekday}>{cardContent}</div>
}

export function WeeklyCalendar({ recentLogs, schedule }: WeeklyCalendarProps) {
  const { profile } = useAuth()
  const [selectedWeekday, setSelectedWeekday] = useState(() => {
    const today = new Date().getDay()
    return schedule[today] ? today : DISPLAY_ORDER.find((day) => Boolean(schedule[day])) ?? today
  })

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])

  const entries = useMemo(() => {
    return DISPLAY_ORDER.map((weekday, index) => {
      const date = addDays(weekStart, index)
      const workout = schedule[weekday] ?? null
      const log = getLogForDate(recentLogs, date, workout)
      const status = getEntryStatus(date, workout, log)
      const progress = log ? 100 : status === "active" ? getWorkoutSetProgress(workout) : 0
      const entryBase = {
        date,
        durationLabel: getDurationLabel(workout, log),
        exerciseGroups: getExerciseGroups(workout),
        isSelected: weekday === selectedWeekday,
        isToday: isToday(date),
        log,
        progress,
        status,
        volumeLabel: getVolumeLabel(log),
        weekday,
        workout,
      }

      return {
        ...entryBase,
        ...getEntryCta(status, workout, progress),
      } satisfies ScheduleEntry
    })
  }, [recentLogs, schedule, selectedWeekday, weekStart])

  const selectedEntry = entries.find((entry) => entry.weekday === selectedWeekday) ?? entries[0]
  const totalMinutes = entries.reduce((sum, entry) => {
    if (entry.log?.completedAt) {
      return sum + Math.max(1, differenceInMinutes(entry.log.completedAt, entry.log.startedAt))
    }

    return sum + (entry.workout?.duration ?? 0)
  }, 0)
  const estimatedCalories = Math.round(totalMinutes * 6.75)
  const scheduledSessions = entries.filter((entry) => entry.workout).length
  const completedSessions = entries.filter((entry) => entry.status === "completed").length
  const recoveryDays = entries.filter((entry) => entry.status === "rest").length
  const completionRate = scheduledSessions > 0 ? Math.round((completedSessions / scheduledSessions) * 100) : 0
  const loadBars = entries.map(getDesktopLoadValue)
  const maxLoad = Math.max(...loadBars, 1)
  const upcomingEntries = [
    ...entries.filter((entry) => entry.date > selectedEntry.date),
    ...entries.filter((entry) => entry.date < selectedEntry.date),
  ]
    .filter((entry) => entry.workout || entry.status === "rest")
    .slice(0, 3)
  const selectedPrimaryGroups = selectedEntry.exerciseGroups.slice(0, 2).join(", ")
  const mobileQueueEntries = [
    ...entries.filter((entry) => entry.weekday !== selectedEntry.weekday && entry.date > selectedEntry.date),
    ...entries.filter((entry) => entry.weekday !== selectedEntry.weekday && entry.date < selectedEntry.date),
  ]
    .filter((entry) => entry.workout || entry.status === "rest")
    .slice(0, 3)
  const nextWorkoutEntry =
    mobileQueueEntries.find((entry) => entry.workout) ??
    entries.find((entry) => entry.weekday !== selectedEntry.weekday && entry.workout) ??
    null
  const firstName = profile?.name?.split(" ")[0] ?? "Athlete"

  return (
    <section className="w-full max-w-full overflow-x-hidden md:space-y-6">
      <div className="relative flex min-h-[calc(100dvh-3.5rem)] w-full max-w-full flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(19,73,236,0.12),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#f3f6fb_48%,#ffffff_100%)] sm:min-h-[calc(100dvh-4rem)] md:hidden">
        <div className="px-4 pt-5">
          <div className="overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(244,248,255,0.98)_100%)] p-5 shadow-[0_30px_70px_-44px_rgba(15,23,42,0.34)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/75">Week Pulse</p>
                <h1 className="mt-2 text-[clamp(2rem,9vw,2.4rem)] font-black tracking-tight text-slate-950">
                  Weekly Schedule
                </h1>
                <p className="mt-2 text-[15px] leading-6 text-slate-600">
                  {formatHeaderMonth(weekStart)} • {firstName}, keep the next session obvious and the recovery honest.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-2xl border-white/80 bg-white shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)] hover:bg-white"
                onClick={() => setSelectedWeekday(new Date().getDay())}
              >
                <CalendarDays className="h-5 w-5 text-slate-700" />
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-[13px] font-semibold">
                <span className="text-slate-500">Completion</span>
                <span className="text-slate-950">
                  {completedSessions}/{scheduledSessions || 0} sessions
                </span>
              </div>
              <Progress
                value={completionRate}
                className="h-2.5 rounded-full bg-primary/10 [&_[data-slot=progress-indicator]]:bg-primary"
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-[20px] bg-white/80 px-3 py-3 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Planned</p>
                <p className="mt-2 text-[1.15rem] font-black tracking-tight text-slate-950">{scheduledSessions}</p>
              </div>
              <div className="rounded-[20px] bg-primary/8 px-3 py-3 shadow-[0_18px_36px_-30px_rgba(19,73,236,0.24)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/75">Done</p>
                <p className="mt-2 text-[1.15rem] font-black tracking-tight text-primary">{completedSessions}</p>
              </div>
              <div className="rounded-[20px] bg-white/80 px-3 py-3 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.24)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Minutes</p>
                <p className="mt-2 text-[1.15rem] font-black tracking-tight text-slate-950">{totalMinutes}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-14 z-10 mt-5 border-y border-slate-200/70 bg-[#f7f9fd]/92 backdrop-blur-xl sm:top-16">
          <div className="w-full max-w-full overflow-x-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-4 pr-4">
            {entries.map((entry) => {
              const tone = getMobileTone(entry.status)

              return (
                <button
                  key={entry.weekday}
                  type="button"
                  onClick={() => setSelectedWeekday(entry.weekday)}
                  className={cn(
                    "flex min-w-[96px] shrink-0 flex-col rounded-[26px] border px-4 py-4 text-left transition-all",
                    entry.isSelected
                      ? `${tone.surfaceClass} scale-[1.01]`
                      : "border-white/80 bg-white/88 text-slate-950 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)]",
                  )}
                >
                  <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", entry.isSelected ? tone.accentTextClass : "text-slate-400")}>
                    {format(entry.date, "EEE")}
                  </span>
                  <span className="mt-2 text-[1.95rem] font-black leading-none tracking-tight text-slate-950">
                    {format(entry.date, "d")}
                  </span>
                  <span
                    className={cn(
                      "mt-3 inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                      entry.isSelected ? tone.chipClass : entry.isToday ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400",
                    )}
                  >
                    {entry.isToday ? "Today" : tone.shortBadge}
                  </span>
                </button>
              )
            })}
          </div>
          </div>
        </div>

        <div className="w-full max-w-full space-y-5 px-4 py-5 pb-28">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected day</p>
              <h2 className="mt-1 text-[clamp(1.6rem,8vw,1.9rem)] font-black tracking-tight text-slate-950">
                Day Focus
              </h2>
            </div>
            <p className="text-sm font-medium text-slate-500">{selectedEntry.isToday ? "Today" : format(selectedEntry.date, "EEE d")}</p>
          </div>

          {renderMobileFocusCard(selectedEntry, {
            completedSessions,
            nextWorkoutEntry,
            recoveryDays,
            scheduledSessions,
          })}

          {mobileQueueEntries.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Week queue</p>
                  <h3 className="mt-1 text-[1.35rem] font-black tracking-tight text-slate-950">What comes next</h3>
                </div>
                <p className="text-sm font-medium text-slate-500">{mobileQueueEntries.length} items</p>
              </div>

              {mobileQueueEntries.map((entry) => renderMobileQueueCard(entry))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="border-b border-slate-200/80 pb-8">
          <h1 className="text-[3.35rem] font-black tracking-tight text-slate-950">
            Weekly Schedule - {formatHeaderMonth(weekStart)}
          </h1>

          <div className="mt-8 grid grid-cols-7">
            {entries.map((entry) => (
              <button
                key={entry.weekday}
                type="button"
                onClick={() => setSelectedWeekday(entry.weekday)}
                className={cn(
                  "border-b-2 px-4 py-6 text-center transition-colors",
                  entry.isSelected ? "border-primary bg-[#eef3ff]" : "border-transparent hover:bg-slate-50/80",
                )}
              >
                <p
                  className={cn(
                    "text-[1.02rem] font-semibold uppercase tracking-[0.18em]",
                    entry.isSelected ? "text-primary" : "text-slate-500",
                  )}
                >
                  {format(entry.date, "EEE")}
                </p>
                <p
                  className={cn(
                    "mt-2 text-[2.15rem] font-bold leading-none",
                    entry.isSelected ? "text-primary" : "text-slate-600",
                  )}
                >
                  {format(entry.date, "d")}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_372px]">
          <div>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-[2.15rem] font-black tracking-tight text-slate-950">Today&apos;s Focus</h2>
              <span className="inline-flex rounded-full bg-[#eff3ff] px-5 py-2 text-[1.05rem] font-semibold text-primary">
                {getDesktopStatusLabel(selectedEntry)}
              </span>
            </div>

            {selectedEntry.workout ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
                <div
                  className="relative h-[240px] bg-cover bg-center"
                  style={{
                    backgroundImage: "url('/asian-male-bodybuilding-coach.jpg')",
                  }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.18)_48%,rgba(15,23,42,0.78)_100%)]" />
                  <div className="absolute bottom-8 left-8">
                    <h3 className="text-[2.2rem] font-bold tracking-tight text-white">{selectedEntry.workout.name}</h3>
                    <p className="mt-2 text-[1.15rem] text-white/85">
                      {selectedPrimaryGroups || "Full body"} • {selectedEntry.workout.exercises.length} Exercises
                    </p>
                  </div>
                </div>

                <div className="p-8">
                  <div className="flex items-center justify-between">
                    <p className="text-[1.1rem] font-semibold text-slate-700">Current Progress</p>
                    <p className="text-[1.65rem] font-bold text-primary">{selectedEntry.progress}%</p>
                  </div>
                  <Progress
                    value={selectedEntry.progress}
                    className="mt-3 h-3 rounded-full bg-slate-100 [&_[data-slot=progress-indicator]]:bg-primary"
                  />

                  <div className="mt-8 space-y-4">
                    {selectedEntry.workout.exercises.slice(0, 4).map((exercise, index) => {
                      const state = getDesktopExerciseState(selectedEntry, index)

                      return (
                        <div
                          key={exercise.id}
                          className={cn(
                            "flex items-center justify-between rounded-[14px] border px-5 py-4",
                            state === "completed" && "border-slate-200 bg-white",
                            state === "active" && "border-primary/35 bg-[#f5f8ff]",
                            state === "upcoming" && "border-slate-200 bg-white",
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full",
                                state === "completed" && "bg-emerald-50 text-emerald-600",
                                state === "active" && "text-primary",
                                state === "upcoming" && "text-slate-300",
                              )}
                            >
                              {state === "completed" ? (
                                <Check className="h-4.5 w-4.5" />
                              ) : (
                                <Circle className={cn("h-3.5 w-3.5", state === "active" && "fill-primary/20")} />
                              )}
                            </div>

                            <div>
                              <p className="text-[1rem] font-semibold text-slate-950">{exercise.exercise.name}</p>
                              <p className="mt-1 text-[15px] text-slate-500">{getExerciseLine(exercise)}</p>
                            </div>
                          </div>

                          <span
                            className={cn(
                              "text-[15px] font-semibold",
                              state === "completed" && "text-slate-400",
                              state === "active" && "text-primary",
                              state === "upcoming" && "text-slate-400",
                            )}
                          >
                            {getDesktopExerciseStatusCopy(state)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {selectedEntry.ctaLabel && selectedEntry.actionHref ? (
                    <Button
                      asChild
                      className="mt-8 h-16 w-full rounded-[18px] bg-primary text-[1.1rem] font-semibold text-primary-foreground shadow-[0_14px_24px_rgba(19,73,236,0.22)] hover:bg-primary/90"
                    >
                      <Link href={selectedEntry.actionHref}>
                        <Play className="mr-2 h-5 w-5 fill-current" />
                        {selectedEntry.ctaLabel}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-white p-10 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
                <div className="flex items-start gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[22px] bg-slate-100 text-slate-500">
                    <MoonStar className="h-9 w-9" />
                  </div>
                  <div>
                    <h3 className="text-[2.2rem] font-bold tracking-tight text-slate-950">Rest Day</h3>
                    <p className="mt-3 max-w-2xl text-[1.05rem] leading-8 text-slate-500">
                      Active recovery, mobility work, and lighter movement will keep the rest of the week sharp.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-6 text-[2.15rem] font-black tracking-tight text-slate-950">Activity Overview</h2>

            <div className="rounded-[20px] border border-slate-200 bg-white p-7 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <p className="text-[1.05rem] font-medium text-slate-600">Weekly Load Volume</p>

              <div className="mt-6 flex h-40 items-end gap-3">
                {entries.map((entry, index) => (
                  <div key={entry.weekday} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-28 w-full items-end rounded-[12px] bg-transparent">
                      <div
                        className={cn(
                          "w-full rounded-t-[6px] transition-all",
                          entry.isSelected ? "bg-primary" : "bg-slate-200",
                        )}
                        style={{
                          height: `${Math.max(12, (loadBars[index] / maxLoad) * 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[13px] font-semibold uppercase tracking-[0.18em]",
                        entry.isSelected ? "text-primary" : "text-slate-400",
                      )}
                    >
                      {format(entry.date, "EEEEE")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                <div>
                  <p className="text-[15px] text-slate-500">Total Time</p>
                  <p className="mt-2 text-[2rem] font-bold tracking-tight text-slate-950">{totalMinutes} min</p>
                </div>
                <div>
                  <p className="text-[15px] text-slate-500">Calories</p>
                  <p className="mt-2 text-[2rem] font-bold tracking-tight text-[#ff6b00]">
                    {estimatedCalories.toLocaleString()} kcal
                  </p>
                </div>
              </div>
            </div>

            <h3 className="mb-5 mt-10 text-[2rem] font-black tracking-tight text-slate-950">Upcoming Workouts</h3>

            <div className="space-y-4">
              {upcomingEntries.map((entry) => {
                const cardContent = (
                  <div className="flex items-center gap-4 rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/20">
                    <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-slate-50 text-slate-700">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {format(entry.date, "EEE")}
                      </span>
                      <span className="mt-1 text-[2rem] font-bold leading-none">{format(entry.date, "d")}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[1.05rem] font-semibold text-slate-950">
                        {entry.workout ? entry.workout.name : "Rest Day"}
                      </p>
                      <p className="mt-1 text-[15px] text-slate-500">
                        {entry.workout
                          ? `${entry.exerciseGroups.slice(0, 2).join(", ") || "Full body"} • ${entry.durationLabel}`
                          : "Active recovery suggested"}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                )

                return entry.actionHref ? (
                  <Link key={entry.weekday} href={entry.actionHref}>
                    {cardContent}
                  </Link>
                ) : (
                  <div key={entry.weekday}>{cardContent}</div>
                )
              })}
            </div>

            <Button
              variant="outline"
              className="mt-5 h-12 w-full rounded-[14px] border-primary/25 bg-transparent text-[1.05rem] font-semibold text-primary hover:bg-primary/5"
            >
              View Full Month
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
