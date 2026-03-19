"use client"

import Link from "next/link"
import { useState } from "react"
import { addDays, differenceInMinutes, format, isSameDay, isToday, startOfWeek } from "date-fns"
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, PencilLine, Play, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreateWorkoutDialog } from "@/components/workout/create-workout-dialog"
import { DeleteWorkoutButton } from "@/components/workout/delete-workout-button"
import { cn } from "@/lib/utils"
import type { Workout, WorkoutLog, WeeklySchedule } from "@/lib/types"

type WeeklyCalendarProps = {
  recentLogs: WorkoutLog[]
  schedule: WeeklySchedule
  showHero?: boolean
  workouts: Workout[]
}

type ScheduleEntry = {
  date: Date
  displayIndex: number
  durationLabel: string
  exerciseGroups: string[]
  isCompleted: boolean
  isToday: boolean
  log: WorkoutLog | null
  weekday: number
  workout: Workout | null
}

const DISPLAY_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function getExerciseGroups(workout: Workout | null) {
  if (!workout) {
    return []
  }

  return Array.from(new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))).slice(0, 3)
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
    return `${Math.max(1, differenceInMinutes(log.completedAt, log.startedAt))} min`
  }

  if (workout?.duration) {
    return `${workout.duration} min`
  }

  return "45 min"
}

function formatWeekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6)
  const startLabel = format(weekStart, "MMM d")
  const endLabel = format(weekEnd, weekStart.getMonth() === weekEnd.getMonth() ? "d" : "MMM d")
  return `${startLabel} - ${endLabel}`
}

function getEntrySummary(workout: Workout, durationLabel: string) {
  return `${workout.exercises.length} exercises · ${durationLabel}`
}

function getTemplateSubcopy(workout: Workout) {
  return `${workout.exercises.length} exercises · ${workout.duration ?? 45} min`
}

function getMobileEntrySubcopy(entry: ScheduleEntry) {
  if (!entry.workout) {
    return "Rest Day"
  }

  const exerciseCount = entry.workout.exercises.length
  return `${entry.workout.name} · ${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`
}

export function WeeklyCalendar({ recentLogs, schedule, showHero = true, workouts }: WeeklyCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [copied, setCopied] = useState(false)

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 })
  const entries: ScheduleEntry[] = DISPLAY_WEEKDAY_ORDER.map((weekday, displayIndex) => {
    const date = addDays(weekStart, displayIndex)
    const workout = schedule[weekday] ?? null
    const log = getLogForDate(recentLogs, date, workout)

    return {
      date,
      displayIndex,
      durationLabel: getDurationLabel(workout, log),
      exerciseGroups: getExerciseGroups(workout),
      isCompleted: Boolean(log),
      isToday: isToday(date),
      log,
      weekday,
      workout,
    }
  })

  const templateWorkouts = workouts
    .slice()
    .sort((left, right) => Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal)))
  const scheduledCount = entries.filter((entry) => entry.workout).length
  const completedCount = entries.filter((entry) => entry.isCompleted).length

  const handleCopyWeek = async () => {
    const summary = entries
      .map((entry) =>
        `${format(entry.date, "EEE, MMM d")}: ${
          entry.workout ? `${entry.workout.name} (${getEntrySummary(entry.workout, entry.durationLabel)})` : "Rest day"
        }`,
      )
      .join("\n")

    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.alert("Unable to copy this week right now.")
    }
  }

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="gap-2 bg-transparent"
        onClick={() => void handleCopyWeek()}
      >
        <Copy className="h-4 w-4" />
        {copied ? "Copied" : "Copy Week"}
      </Button>
      <CreateWorkoutDialog
        workoutTemplates={workouts}
        trigger={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Workout
          </Button>
        }
      />
    </div>
  )

  return (
    <section className="space-y-8">
      <header
        className={cn(
          "flex flex-col gap-4",
          showHero ? "lg:flex-row lg:items-start lg:justify-between" : "sm:flex-row sm:items-center sm:justify-end",
        )}
      >
        {showHero ? (
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">Weekly Schedule</h1>
            <p className="max-w-2xl text-base text-muted-foreground">Plan and organize your training week</p>
          </div>
        ) : null}

        {actionButtons}
      </header>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">This Week</h2>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-transparent"
                onClick={() => setWeekOffset((current) => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[118px] text-center text-sm font-medium text-muted-foreground sm:min-w-[124px]">
                {formatWeekRangeLabel(weekStart)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-transparent"
                onClick={() => setWeekOffset((current) => current + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {scheduledCount} planned session{scheduledCount === 1 ? "" : "s"} · {completedCount} completed
          </p>
        </div>

        <div className="space-y-3 lg:hidden">
          {entries.map((entry) => (
            <div
              key={`${entry.weekday}-${entry.displayIndex}`}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all",
                entry.isToday ? "border-primary/40" : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black tracking-tight",
                  entry.isToday ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
                )}
              >
                {format(entry.date, "d")}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-lg font-semibold", entry.isToday ? "text-primary" : "text-foreground")}>
                    {format(entry.date, "EEEE")}
                  </p>
                  {entry.isToday ? <span className="shrink-0 text-xs font-medium text-primary">(Today)</span> : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{getMobileEntrySubcopy(entry)}</p>
              </div>

              {entry.workout ? (
                <Link
                  href={`/workout/${entry.workout.id}/start`}
                  className={cn(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background transition-all hover:border-primary/30",
                    entry.isCompleted ? "border-primary/30 text-primary" : "border-border text-foreground",
                  )}
                  aria-label={entry.isCompleted ? `Review ${entry.workout.name}` : `Open ${entry.workout.name}`}
                >
                  {entry.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                </Link>
              ) : (
                <CreateWorkoutDialog
                  defaultScheduledDay={entry.weekday}
                  workoutTemplates={workouts}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground transition-all hover:border-primary/30"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  }
                />
              )}
            </div>
          ))}
        </div>

        <div className="hidden gap-3 lg:grid lg:grid-cols-7 xl:gap-4">
          {entries.map((entry) => (
            <div
              key={`${entry.weekday}-${entry.displayIndex}`}
              className={cn(
                "group relative flex h-[230px] flex-col rounded-[24px] border p-4 shadow-sm transition-all",
                entry.isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-medium", entry.isToday ? "text-primary" : "text-muted-foreground")}>
                    {format(entry.date, "EEE")}
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{format(entry.date, "d")}</p>
                </div>

                {entry.isToday ? <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </div>

              {entry.workout ? (
                <div className="mt-5 flex flex-1 flex-col">
                  <Link
                    href={`/workout/${entry.workout.id}/start`}
                    className={cn(
                      "block h-[78px] w-full overflow-hidden rounded-[18px] px-4 py-3 transition-all hover:border-primary/30",
                      entry.isCompleted ? "border-primary/20 bg-primary/10" : "border-transparent bg-primary/10",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[1.05rem] font-semibold leading-6 text-foreground">{entry.workout.name}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {getEntrySummary(entry.workout, entry.durationLabel)}
                      </p>
                    </div>
                  </Link>

                  <div className="mt-auto flex h-8 items-center gap-1.5 px-0.5 pt-4 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                    {entry.workout.isPersonal ? (
                      <>
                        <CreateWorkoutDialog
                          workoutToEdit={entry.workout}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
                              aria-label={`Edit ${entry.workout.name}`}
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DeleteWorkoutButton
                          workoutId={entry.workout.id}
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 rounded-full px-0 text-destructive hover:bg-destructive/10"
                          confirmTitle="Delete this workout?"
                          confirmDescription="This will remove the personal workout from your schedule for this day."
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex flex-1 flex-col">
                  <CreateWorkoutDialog
                    defaultScheduledDay={entry.weekday}
                    workoutTemplates={workouts}
                    trigger={
                      <button
                        type="button"
                        className="flex h-[78px] w-full flex-col items-center justify-center rounded-[18px] border border-dashed border-border bg-background/40 px-4 text-center transition-all hover:border-primary/30 hover:bg-background/70"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Plus className="h-5 w-5" />
                        </span>
                        <span className="mt-2 text-sm font-medium text-foreground">Add Workout</span>
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Your Workout Templates</h2>
            <p className="text-sm text-muted-foreground">Reuse saved workouts and jump back into the sessions you already know.</p>
          </div>
          <Link href="/workout" className="text-sm font-medium text-primary transition-opacity hover:opacity-80">
            Open all workouts
          </Link>
        </div>

        {templateWorkouts.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {templateWorkouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/workout/${workout.id}/start`}
                className="group flex min-h-[152px] flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-xl font-semibold text-foreground">{workout.name}</h3>
                      {workout.isPersonal ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Personal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{getTemplateSubcopy(workout)}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:text-primary">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {getExerciseGroups(workout).map((group) => (
                    <span key={group} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {group}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No workout templates yet. Create one and it will appear here.</p>
          </div>
        )}
      </div>
    </section>
  )
}
