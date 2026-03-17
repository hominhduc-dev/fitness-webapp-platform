"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { addDays, differenceInMinutes, format, isSameDay, isToday, startOfWeek } from "date-fns"
import {
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Dumbbell,
  History,
  MoonStar,
  Play,
  Target,
  User,
  Zap,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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

function getStatusBadge(entry: ScheduleEntry) {
  switch (entry.status) {
    case "completed":
      return (
        <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
          COMPLETED
        </Badge>
      )
    case "active":
      return (
        <Badge className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
          ACTIVE NOW
        </Badge>
      )
    case "missed":
      return (
        <Badge variant="outline" className="rounded-full border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-700">
          MISSED
        </Badge>
      )
    case "upcoming":
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          UPCOMING
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground">
          REST DAY
        </Badge>
      )
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

function getInitials(name?: string | null) {
  if (!name) {
    return "YB"
  }

  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
}

function getExerciseLine(exercise: WorkoutExercise) {
  const targetSet = exercise.sets[0]
  return `${exercise.sets.length} sets x ${targetSet?.targetReps ?? 0} reps`
}

function getMobileDateLabel(entry: ScheduleEntry) {
  const prefix = entry.isToday ? `Today, ${format(entry.date, "MMM d")}` : format(entry.date, "EEE, MMM d")
  return prefix.toUpperCase()
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

function renderMobileRestCard(entry: ScheduleEntry) {
  return (
    <div className="w-full max-w-full overflow-hidden rounded-[30px] border border-dashed border-[#d7deeb] bg-[#fafbfd] px-5 py-5 sm:px-6">
      <div className="flex w-full max-w-full gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-[#e9eef7] text-slate-500">
          <MoonStar className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">{getMobileDateLabel(entry)}</p>
          <h3 className="mt-1 break-words text-[clamp(1.5rem,9vw,1.95rem)] font-black tracking-tight text-slate-950">
            Rest Day
          </h3>
          <p className="mt-2 break-words text-[17px] leading-7 text-slate-500">
            Status: Recovery focused • Stretching & Mobility
          </p>
        </div>
      </div>
    </div>
  )
}

function renderMobileActiveCard(entry: ScheduleEntry) {
  if (!entry.workout) {
    return null
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[30px] border-2 border-primary bg-white px-5 py-5 shadow-[0_18px_34px_rgba(19,73,236,0.12)] ring-1 ring-primary/5 sm:px-6">
      <div className="flex w-full max-w-full gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-primary/8 text-primary">
          <Dumbbell className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex w-full max-w-full flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-words text-[13px] font-bold uppercase tracking-[0.14em] text-primary">
              {getMobileDateLabel(entry)}
            </p>
            <span className="inline-flex shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              ACTIVE NOW
            </span>
          </div>

          <h3 className="mt-2 break-words text-[clamp(1.6rem,8.2vw,2rem)] font-black leading-tight tracking-tight text-slate-950">
            {entry.workout.name}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            {entry.exerciseGroups.map((group) => (
              <span
                key={group}
                className="rounded-xl bg-primary/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary sm:text-[11px]"
              >
                {group}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-[15px] font-bold text-slate-950">
          <span className="min-w-0 pr-3">Session Progress</span>
          <span className="shrink-0 text-primary">{entry.progress}%</span>
        </div>
        <Progress value={entry.progress} className="h-2.5 rounded-full bg-slate-200 [&_[data-slot=progress-indicator]]:bg-primary" />
      </div>

      <div className="mt-5 w-full max-w-full border-t border-slate-100 pt-5">
        <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-400">Exercise List</p>

        <div className="mt-4 space-y-3">
          {entry.workout.exercises.slice(0, 5).map((exercise) => (
            <div
              key={exercise.id}
              className="flex w-full max-w-full items-center justify-between gap-3 rounded-[18px] bg-[#f7f9fc] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate text-[16px] font-medium text-slate-950 sm:text-[17px]">
                  {exercise.exercise.name}
                </span>
              </div>
              <span className="shrink-0 text-[15px] font-semibold text-slate-400 sm:text-[16px]">
                {getMobileExerciseValue(exercise)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {entry.ctaLabel && entry.actionHref ? (
        <Button
          asChild
          className="mt-6 h-14 w-full rounded-[18px] bg-primary text-[1.05rem] font-bold text-primary-foreground shadow-[0_14px_24px_rgba(19,73,236,0.22)] hover:bg-primary/90"
        >
          <Link href={entry.actionHref}>Resume Session</Link>
        </Button>
      ) : null}
    </div>
  )
}

function renderMobileUpcomingCard(entry: ScheduleEntry, icon: "clock" | "zap") {
  return (
    <div className="w-full max-w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <div className="flex w-full max-w-full gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] bg-slate-100 text-slate-400">
          {icon === "clock" ? <Clock3 className="h-8 w-8" /> : <Zap className="h-8 w-8" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {format(entry.date, "EEE, MMM d").toUpperCase()}
          </p>
          <h3 className="mt-1 break-words text-[clamp(1.45rem,8vw,1.9rem)] font-black leading-tight tracking-tight text-slate-400">
            {entry.workout?.name ?? "Workout"}
          </h3>
          <div className="mt-3 flex w-full max-w-full items-center justify-between gap-3 text-[17px] text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {entry.durationLabel}
            </span>
            <span className="shrink-0">Upcoming</span>
          </div>
        </div>
      </div>
    </div>
  )
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
  const loadBars = entries.map(getDesktopLoadValue)
  const maxLoad = Math.max(...loadBars, 1)
  const upcomingEntries = [
    ...entries.filter((entry) => entry.date > selectedEntry.date),
    ...entries.filter((entry) => entry.date < selectedEntry.date),
  ]
    .filter((entry) => entry.workout || entry.status === "rest")
    .slice(0, 3)
  const selectedPrimaryGroups = selectedEntry.exerciseGroups.slice(0, 2).join(", ")
  const mobileActiveEntry =
    (selectedEntry.status === "active" && selectedEntry.workout
      ? selectedEntry
      : entries.find((entry) => entry.status === "active" && entry.workout) ??
        entries.find((entry) => entry.status === "upcoming" && entry.workout) ??
        entries.find((entry) => entry.workout)) ?? selectedEntry
  const mobileActiveIndex = entries.findIndex((entry) => entry.weekday === mobileActiveEntry.weekday)
  const mobileRestEntry =
    [...entries.slice(0, mobileActiveIndex).reverse(), ...entries.slice(mobileActiveIndex + 1)].find(
      (entry) => entry.status === "rest",
    ) ?? null
  const mobileUpcomingEntries = [...entries.slice(mobileActiveIndex + 1), ...entries.slice(0, mobileActiveIndex)]
    .filter((entry) => entry.status === "upcoming" && entry.workout)
    .slice(0, 2)

  return (
    <section className="w-full max-w-full overflow-x-hidden md:space-y-6">
      <div className="relative flex min-h-[100dvh] w-full max-w-full flex-col overflow-x-hidden bg-[#f6f6f8] md:hidden">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-[#f6f6f8] px-4 pb-4 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-[#cbd8f7] bg-[#f4d2bf]/40">
                <AvatarImage src={profile?.avatar || "/placeholder.svg"} alt={profile?.name ?? "User"} />
                <AvatarFallback className="bg-[#f4d2bf]/20 text-primary">{getInitials(profile?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-[clamp(1.7rem,8.8vw,2rem)] font-black tracking-tight text-slate-950">
                  Weekly Schedule
                </h1>
                <p className="mt-1 text-[1.1rem] font-medium text-slate-500">{formatHeaderMonth(weekStart)}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-white"
              onClick={() => setSelectedWeekday(new Date().getDay())}
            >
              <CalendarDays className="h-5 w-5 text-slate-600" />
            </Button>
          </div>
        </div>

        <div className="w-full max-w-full overflow-x-auto px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-4 pr-4">
            {entries.map((entry) => (
              <button
                key={entry.weekday}
                type="button"
                onClick={() => setSelectedWeekday(entry.weekday)}
                className={cn(
                  "flex h-[106px] min-w-[84px] shrink-0 flex-col items-center justify-center rounded-[26px] border bg-white px-3 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all sm:h-28 sm:min-w-[84px] sm:rounded-[28px]",
                  entry.isSelected
                    ? "border-primary bg-primary text-white shadow-[0_18px_34px_rgba(19,73,236,0.24)]"
                    : "border-slate-200 text-slate-950",
                )}
              >
                <span
                  className={cn(
                    "text-[13px] font-semibold uppercase tracking-[0.16em]",
                    entry.isSelected ? "text-white/85" : "text-slate-400",
                  )}
                >
                  {format(entry.date, "EEE")}
                </span>
                <span className="mt-1 text-[1.85rem] font-black leading-none sm:text-[2rem]">{format(entry.date, "d")}</span>
                <span
                  className={cn(
                    "mt-3 h-2.5 w-2.5 rounded-full",
                    entry.isSelected ? "bg-white" : entry.isToday ? "bg-primary" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-full space-y-5 px-4 pb-28">
          <h2 className="px-1 pt-1 text-[clamp(1.65rem,8vw,1.9rem)] font-black tracking-tight text-slate-950">
            Activity Overview
          </h2>
          {mobileRestEntry ? renderMobileRestCard(mobileRestEntry) : null}
          {renderMobileActiveCard(mobileActiveEntry)}
          {mobileUpcomingEntries.map((entry, index) => renderMobileUpcomingCard(entry, index === 0 ? "clock" : "zap"))}
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex w-full max-w-full items-center justify-between border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
          <Link href="/schedule" className="flex min-w-0 flex-1 flex-col items-center gap-1 text-primary">
            <Dumbbell className="h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Workout</span>
          </Link>
          <Link href="/dashboard" className="flex min-w-0 flex-1 flex-col items-center gap-1 text-slate-400">
            <History className="h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">History</span>
          </Link>
          <Link href="/progress" className="flex min-w-0 flex-1 flex-col items-center gap-1 text-slate-400">
            <BarChart3 className="h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Stats</span>
          </Link>
          <Link href="/profile" className="flex min-w-0 flex-1 flex-col items-center gap-1 text-slate-400">
            <User className="h-6 w-6" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Profile</span>
          </Link>
        </nav>
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
