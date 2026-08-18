"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, Play, User } from "lucide-react"
import { useMemo, useState } from "react"

import { RoutineBuilderDialog } from "@/components/workout/routine-builder-dialog"
import { DeleteWorkoutButton } from "@/components/workout/delete-workout-button"
import { RoutineDot } from "@/components/workout/routine-dot"
import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { AppMessages } from "@/lib/i18n/messages"
import { buildMuscleProfileHighlights, muscleProfilesFromWorkout } from "@/lib/fitness/muscle-map"
import { getTotalSets, inferRoutineTag } from "@/lib/fitness/routine-tag"
import type { Workout, WorkoutLog } from "@/lib/types"
import { formatRepTarget } from "@/lib/workout-reps"

function formatRelativeCompact(date: Date, messages: AppMessages) {
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000))

  if (diffDays === 0) return messages.workoutPage.today
  if (diffDays === 1) return messages.workoutPage.yesterday
  if (diffDays < 7) return messages.workoutPage.daysAgo(diffDays)
  if (diffDays < 14) return messages.workoutPage.lastWeek
  if (diffDays < 30) return messages.workoutPage.weeksAgo(Math.floor(diffDays / 7))
  return messages.workoutPage.monthsAgo(Math.floor(diffDays / 30))
}

function getLastUsed(workout: Workout, historyLogs: WorkoutLog[], messages: AppMessages) {
  const latestLog = historyLogs.find((log) => log.workout.id === workout.id)

  if (!latestLog) {
    return messages.workoutPage.never
  }

  return formatRelativeCompact(latestLog.completedAt ?? latestLog.startedAt, messages)
}

function formatScheduledDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/**
 * One saved routine. Edit and delete only appear for personal routines —
 * coach-assigned sessions carry `isPersonal === false`, so the same card is
 * safe to reuse inside a program view.
 */
export function RoutineCard({ historyLogs, workout }: { historyLogs: WorkoutLog[]; workout: Workout }) {
  const { messages } = useLocale()
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const tag = inferRoutineTag(workout)
  const totalSets = getTotalSets(workout)
  const muscleHighlights = useMemo(
    () => buildMuscleProfileHighlights(
      muscleProfilesFromWorkout(workout),
      "var(--primary)",
      "color-mix(in oklab, var(--primary) 45%, var(--body-fill))",
    ),
    [workout],
  )
  const lastUsed = getLastUsed(workout, historyLogs, messages)
  const cardMeta = workout.scheduledDate
    ? messages.workoutPage.scheduledFor(formatScheduledDate(workout.scheduledDate))
    : messages.workoutPage.lastUsed(lastUsed)

  return (
    <article className="group flex min-w-0 flex-col gap-3.5 overflow-hidden rounded-[10px] border border-border bg-card p-5 transition-colors duration-150 hover:border-foreground/20 sm:min-h-[286px]">
      <div className="flex min-w-0 items-start gap-2">
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
                {messages.workoutPage.fromCoach}
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {workout.name}
          </h2>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs leading-snug text-muted-foreground tnum">
            <span>{messages.workoutPage.exerciseCount(workout.exercises.length)}</span>
            <span>{messages.workoutPage.setCount(totalSets)}</span>
            <span>{cardMeta}</span>
          </div>
        </div>

        {workout.isPersonal ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={messages.workoutPage.editRoutine}
            onClick={() => setIsEditorOpen(true)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-3.5">
        {/* The written tag stays: it comes from workout.kind as the coach set it,
            while the figure reflects the exercises actually in the routine. When
            the two disagree that is worth seeing, and the filter row still runs
            off the tag. */}
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`${messages.workoutPage.muscleMapLabel}: ${workout.name}`}
              className="shrink-0 rounded-[10px] p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MuscleMapPair
                size="card"
                highlights={muscleHighlights}
                label={messages.workoutPage.muscleMapLabel}
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(92vw,440px)] gap-5 rounded-[20px] p-5 sm:p-6">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle>{workout.name}</DialogTitle>
              <DialogDescription>
                {messages.workoutPage.muscleMapLabel} · {messages.workoutPage.exerciseCount(workout.exercises.length)}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-[16px] border border-border bg-card px-4 py-5">
              <MuscleMapPair
                size="md"
                highlights={muscleHighlights}
                label={`${messages.workoutPage.muscleMapLabel}: ${workout.name}`}
                className="mx-auto"
              />
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-[8px] bg-muted/45 px-3 py-2.5 font-mono text-xs leading-tight">
          {workout.exercises.slice(0, 4).map((exercise) => {
            const firstSet = exercise.sets[0]
            const reps = formatRepTarget({
              reps: firstSet?.targetReps,
              repsMin: firstSet?.targetRepsMin,
            })

            return (
              <div key={exercise.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span className="min-w-0 truncate text-foreground">{exercise.exercise.name}</span>
                <span className="shrink-0 text-muted-foreground tnum">
                  {exercise.sets.length} × {reps}
                </span>
              </div>
            )
          })}
          {workout.exercises.length > 4 ? (
            <p className="text-[11px] text-muted-foreground">{messages.workoutPage.more(workout.exercises.length - 4)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex min-w-0 flex-col gap-2 sm:flex-row">
        <Link href={`/workout/${workout.id}/start`} className="min-w-0 flex-1">
          <Button className="h-10 w-full justify-center gap-2 rounded-[8px] bg-foreground text-sm font-semibold text-background hover:bg-foreground/90" size="sm">
            <Play className="h-4 w-4" />
            {messages.workoutPage.start}
          </Button>
        </Link>
        {workout.isPersonal ? (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full justify-center gap-2 rounded-[8px] bg-transparent px-3 text-sm font-medium sm:w-auto"
              onClick={() => setIsEditorOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              {messages.workoutPage.edit}
            </Button>
            <DeleteWorkoutButton
              workoutId={workout.id}
              size="sm"
              variant="outline"
              className="h-10 rounded-[8px] bg-transparent"
              confirmTitle={messages.workoutPage.deleteRoutineTitle}
              confirmDescription={messages.workoutPage.deleteRoutineDescription}
            />
          </div>
        ) : null}
      </div>

      {workout.isPersonal ? (
        <RoutineBuilderDialog
          workoutToEdit={workout}
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
        />
      ) : null}
    </article>
  )
}
