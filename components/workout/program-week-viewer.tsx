"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Copy, Loader2, Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { FilterChip } from "@/components/workout/filter-chip"
import { RoutineCard } from "@/components/workout/routine-card"
import { RoutineBuilderDialog, buildRoutineWorkoutPayload, type RoutineDraftData } from "@/components/workout/routine-builder-dialog"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { addWorkoutToProgram, copyProgramWeek, updateTraineeProgram } from "@/lib/fitness/api"
import { clampWeeks, resolveCurrentWeekProgress } from "@/lib/fitness/program-week"
import type { CoachProgram } from "@/lib/fitness/types"
import type { AppLocale } from "@/lib/i18n/config"
import type { Workout, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProgramWeekViewerProps = {
  assignedAt?: Date
  canEdit?: boolean
  historyLogs: WorkoutLog[]
  program: CoachProgram
}

/** Monday-first, matching the coach editor's day strip. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function getDayLabels(locale: AppLocale) {
  const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { weekday: "short" })
  // 2024-01-01 was a Monday, so this walks Mon → Sun in DAY_ORDER order.
  return DAY_ORDER.map((_day, index) => formatter.format(new Date(2024, 0, 1 + index)))
}

/**
 * Week browser for a program the trainee is assigned to. Read-only for
 * coach-assigned plans; for programs the trainee authored (AI-generated or
 * their own) it also edits sessions, adds them, and copies a week forward.
 *
 * The coach editor covers the same ground but is an authoring tool bound to
 * coach-only endpoints, so this stays a separate, much smaller view.
 */
export function ProgramWeekViewer({ assignedAt, canEdit = false, historyLogs, program }: ProgramWeekViewerProps) {
  const { locale, messages } = useLocale()
  const { session } = useAuth()
  const router = useRouter()
  const totalWeeks = clampWeeks(program.duration)

  const progress = useMemo(() => resolveCurrentWeekProgress(assignedAt, totalWeeks), [assignedAt, totalWeeks])

  const currentWeekIndex =
    progress?.kind === "active" ? progress.weekIndex : progress?.kind === "completed" ? totalWeeks - 1 : 0

  // A missing weekIndex means "week 1" — that is how the AI generator stores a
  // program it expects to repeat, and it is also how older rows were written.
  const workoutsByWeek = useMemo(() => {
    const byWeek = new Map<number, Workout[]>()

    program.workouts.forEach((workout) => {
      const weekIndex = typeof workout.weekIndex === "number" ? workout.weekIndex : 0
      const bucket = byWeek.get(weekIndex)

      if (bucket) {
        bucket.push(workout)
        return
      }

      byWeek.set(weekIndex, [workout])
    })

    return byWeek
  }, [program.workouts])

  const [activeWeek, setActiveWeek] = useState(currentWeekIndex)
  const [addDay, setAddDay] = useState<number | null>(null)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [draftName, setDraftName] = useState(program.name)
  const [draftDescription, setDraftDescription] = useState(program.description ?? "")
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekWorkouts = workoutsByWeek.get(activeWeek) ?? []
  const isCompleted = progress?.kind === "completed"
  const percent = isCompleted ? 100 : Math.round(((currentWeekIndex + 1) / totalWeeks) * 100)
  const dayLabels = useMemo(() => getDayLabels(locale), [locale])
  const takenDays = new Set(weekWorkouts.map((workout) => workout.scheduledDay).filter((day) => day != null))
  const freeDays = DAY_ORDER.filter((day) => !takenDays.has(day))
  const remainingWeeks = totalWeeks - activeWeek - 1

  const run = async (action: (accessToken: string) => Promise<unknown>) => {
    const accessToken = session?.access_token

    if (!accessToken || isBusy) return

    setIsBusy(true)
    setError(null)

    try {
      await action(accessToken)
      router.refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : messages.workoutPage.programActionFailed)
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddSession = (draft: RoutineDraftData) => {
    const scheduledDay = addDay
    if (scheduledDay == null) return

    setAddDay(null)
    void run(async (accessToken) => {
      const payload = buildRoutineWorkoutPayload({ exercises: draft.exercises, name: draft.name, tag: draft.tag }, messages)
      await addWorkoutToProgram(accessToken, program.id, { ...payload, scheduledDay, weekIndex: activeWeek })
    })
  }

  return (
    <>
      <Link
        href="/workout"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {messages.workoutPage.backToRoutines}
      </Link>

      <div className="mb-5 sm:mb-7">
        <Badge variant="micro" className="mb-2">
          {messages.workoutPage.programBadge}
        </Badge>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[36px]">
            {program.name}
          </h1>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-8 gap-1.5 rounded-[8px] bg-transparent px-2.5 text-xs"
              onClick={() => {
                setDraftName(program.name)
                setDraftDescription(program.description ?? "")
                setIsInfoOpen(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              {messages.workoutPage.editProgramInfo}
            </Button>
          ) : null}
        </div>
        {program.description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
        ) : null}
        <div className="mt-2.5 max-w-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted-foreground tnum">
            <span className={cn(isCompleted && "text-foreground")}>
              {isCompleted
                ? messages.workoutPage.programCompleted
                : messages.workoutPage.weekProgress(currentWeekIndex + 1, totalWeeks)}
            </span>
            <span>{messages.workoutPage.sessionCount(program.workouts.length)}</span>
          </div>
          <Progress value={percent} />
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: totalWeeks }, (_value, weekIndex) => (
          <FilterChip
            key={weekIndex}
            active={activeWeek === weekIndex}
            onClick={() => setActiveWeek(weekIndex)}
            className={cn(
              weekIndex === currentWeekIndex && activeWeek !== weekIndex && "border-foreground/40",
              weekIndex < currentWeekIndex && activeWeek !== weekIndex && "text-muted-foreground",
            )}
          >
            {messages.workoutPage.weekShort(weekIndex + 1)}
            {weekIndex === currentWeekIndex ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            ) : null}
          </FilterChip>
        ))}
      </div>

      {canEdit ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 sm:mb-6">
          {freeDays.length > 0 ? (
            freeDays.map((day) => (
              <Button
                key={day}
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                className="h-8 gap-1.5 rounded-full bg-transparent px-3 text-xs font-medium"
                onClick={() => setAddDay(day)}
              >
                <Plus className="h-3.5 w-3.5" />
                {messages.workoutPage.addSessionOnDay(dayLabels[DAY_ORDER.indexOf(day)] ?? String(day))}
              </Button>
            ))
          ) : (
            <span className="label-micro">{messages.workoutPage.weekFullyBooked}</span>
          )}

          {remainingWeeks > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy || weekWorkouts.length === 0}
              title={weekWorkouts.length === 0 ? messages.workoutPage.copyWeekEmpty : undefined}
              className="h-8 gap-1.5 rounded-full bg-transparent px-3 text-xs font-medium"
              onClick={() => setIsCopyOpen(true)}
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              {messages.workoutPage.copyWeek(activeWeek + 1)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {weekWorkouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {weekWorkouts.map((workout) => (
            <RoutineCard key={workout.id} historyLogs={historyLogs} workout={workout} />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">{messages.workoutPage.emptyWeekTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit ? messages.workoutPage.emptyWeekOwnCopy : messages.workoutPage.emptyWeekCopy}
          </p>
        </div>
      )}

      {addDay != null ? (
        <RoutineBuilderDialog open onOpenChange={(open) => !open && setAddDay(null)} onSaveDraft={handleAddSession} />
      ) : null}

      <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
        <DialogContent className="max-w-[min(92vw,420px)]">
          <DialogHeader className="text-left">
            <DialogTitle>{messages.workoutPage.copyWeekConfirmTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {messages.workoutPage.copyWeekConfirmBody(activeWeek + 1, remainingWeeks)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyOpen(false)}>
              {messages.workoutPage.cancel}
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => {
                setIsCopyOpen(false)
                void run((accessToken) => copyProgramWeek(accessToken, program.id, activeWeek))
              }}
            >
              {messages.workoutPage.copyWeek(activeWeek + 1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent className="max-w-[min(92vw,440px)]">
          <DialogHeader className="text-left">
            <DialogTitle>{messages.workoutPage.editProgramInfo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="label-micro block" htmlFor="program-name">
                {messages.workoutPage.programNameLabel}
              </label>
              <Input id="program-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="label-micro block" htmlFor="program-description">
                {messages.workoutPage.programDescriptionLabel}
              </label>
              <textarea
                id="program-description"
                rows={3}
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                className="w-full rounded-[8px] border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInfoOpen(false)}>
              {messages.workoutPage.cancel}
            </Button>
            <Button
              disabled={isBusy || !draftName.trim()}
              onClick={() => {
                setIsInfoOpen(false)
                void run((accessToken) =>
                  updateTraineeProgram(accessToken, program.id, {
                    description: draftDescription.trim() || null,
                    name: draftName.trim(),
                  }),
                )
              }}
            >
              {messages.workoutPage.saveChanges}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
