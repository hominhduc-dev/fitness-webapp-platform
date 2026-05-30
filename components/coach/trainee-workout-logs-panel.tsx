"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Clock3, Download, FileSpreadsheet, Loader2, MessageSquare, Pencil, Save, Trash2 } from "lucide-react"

import { formatDateInputValue, startOfLocalWeek } from "@/components/coach/trainee-workout-log-dates"
import type { CoachWorkoutLogsWorkbookPreview } from "@/components/coach/trainee-workout-logs-excel"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  createCoachWorkoutLogComment,
  deleteCoachWorkoutLogComment,
  fetchCoachWorkoutLogs,
  updateCoachWorkoutLogComment,
} from "@/lib/fitness/api"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { WorkoutLog } from "@/lib/types"
import { formatRepTarget } from "@/lib/workout-reps"

type TraineeWorkoutLogsPanelProps = {
  initialLogs?: WorkoutLog[]
  traineeId: string
  traineeName?: string
}

type WorkoutDaySection = {
  completedSets: number
  key: string
  label: string
  logs: WorkoutLog[]
  totalSets: number
  totalVolume: number
}

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDateInputAsLocalDate(value: string) {
  const match = DATE_INPUT_PATTERN.exec(value.trim())

  if (!match) {
    return undefined
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return parsedDate
}

function isLogInSelectedWeek(log: WorkoutLog, weekStart: string) {
  const start = parseDateInputAsLocalDate(weekStart)

  if (!start) {
    return false
  }

  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return log.startedAt >= start && log.startedAt < end
}

function formatDaySectionLabel(date: Date) {
  const label = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    weekday: "long",
  }).format(date)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function buildWeekDaySections(logs: WorkoutLog[], weekStart: string): WorkoutDaySection[] {
  const logsByDay = new Map<string, WorkoutLog[]>()

  logs.forEach((log) => {
    const key = formatDateInputValue(log.startedAt)
    const dayLogs = logsByDay.get(key) ?? []
    dayLogs.push(log)
    logsByDay.set(key, dayLogs)
  })

  const startDate = parseDateInputAsLocalDate(weekStart)

  if (!startDate) {
    return []
  }

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)

    const key = formatDateInputValue(date)
    const dayLogs = (logsByDay.get(key) ?? []).slice().sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
    const completedSets = dayLogs.reduce((sum, log) => sum + countCompletedSets(log), 0)
    const totalSets = dayLogs.reduce((sum, log) => sum + countTotalSets(log), 0)
    const totalVolume = dayLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)

    return {
      completedSets,
      key,
      label: formatDaySectionLabel(date),
      logs: dayLogs,
      totalSets,
      totalVolume: Number(totalVolume.toFixed(1)),
    }
  })
}

function formatSessionLength(log: WorkoutLog) {
  const endTime = log.completedAt ?? log.startedAt
  return Math.max(1, Math.round((endTime.getTime() - log.startedAt.getTime()) / 60_000))
}

function calculateSetVolume(set: WorkoutLog["exercises"][number]["sets"][number]) {
  if (!set.completed || set.weight == null) {
    return undefined
  }

  const reps = set.actualReps ?? set.targetReps
  return Number.isFinite(reps) ? Number((set.weight * reps).toFixed(1)) : undefined
}

function calculateExerciseVolume(exercise: WorkoutLog["exercises"][number]) {
  const total = exercise.sets.reduce((sum, set) => sum + (calculateSetVolume(set) ?? 0), 0)
  return total > 0 ? Number(total.toFixed(1)) : undefined
}

function countTotalSets(log: WorkoutLog) {
  return log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
}

function countCompletedSets(log: WorkoutLog) {
  return log.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
    0,
  )
}

function countCompletedExerciseSets(exercise: WorkoutLog["exercises"][number]) {
  return exercise.sets.filter((set) => set.completed).length
}

function formatMetricValue(
  value: number | string | undefined,
  options?: { suffix?: string; zeroAsValid?: boolean },
) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "--"
    }

    if (value === 0 && !options?.zeroAsValid) {
      return "--"
    }

    return `${value}${options?.suffix ?? ""}`
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? `${trimmed}${options?.suffix ?? ""}` : "--"
  }

  return "--"
}

function formatPreviousPerformance(
  set: WorkoutLog["exercises"][number]["sets"][number],
) {
  if (!set.previousPerformance) {
    return null
  }

  const sourceLabel =
    set.previousPerformance.source === "same_weekday_last_week"
      ? "same weekday last week"
      : "most recent"

  const repsLabel = formatMetricValue(set.previousPerformance.reps, { zeroAsValid: true })
  const weightLabel = formatMetricValue(set.previousPerformance.weight, { suffix: " kg", zeroAsValid: true })

  return `${sourceLabel}: ${weightLabel} x ${repsLabel}`
}

async function loadAllCoachWorkoutLogsForExport(accessToken: string, traineeId: string, weekStart: string) {
  const allLogs: WorkoutLog[] = []
  let cursor: string | undefined

  do {
    const response = await fetchCoachWorkoutLogs(accessToken, traineeId, {
      cursor,
      limit: 50,
      weekStart,
    })

    allLogs.push(...response.logs)
    cursor = response.nextCursor
  } while (cursor)

  return allLogs
}

export function TraineeWorkoutLogsPanel({
  initialLogs = [],
  traineeId,
  traineeName,
}: TraineeWorkoutLogsPanelProps) {
  const { profile, session } = useAuth()
  const defaultWeekStart = formatDateInputValue(startOfLocalWeek(new Date()))
  const initialWeekLogs = initialLogs.filter((log) => isLogInSelectedWeek(log, defaultWeekStart))
  const [logs, setLogs] = useState<WorkoutLog[]>(initialWeekLogs)
  const [expandedDayKeys, setExpandedDayKeys] = useState<string[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewWorkbook, setPreviewWorkbook] = useState<CoachWorkoutLogsWorkbookPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftByLogId, setDraftByLogId] = useState<Record<string, string>>({})
  const [savingLogId, setSavingLogId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const daySections = buildWeekDaySections(logs, weekStart)
  const allDayKeys = daySections.map((section) => section.key)

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    let cancelled = false

    const loadLogs = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchCoachWorkoutLogs(session.access_token, traineeId, {
          limit: 20,
          weekStart,
        })

        if (cancelled) {
          return
        }

        setLogs(response.logs)
        setNextCursor(response.nextCursor)
        setExpandedDayKeys([])
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải workout logs.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadLogs()

    return () => {
      cancelled = true
    }
  }, [session?.access_token, traineeId, weekStart])

  const updateLogComments = (logId: string, updater: (comments: WorkoutLog["comments"]) => WorkoutLog["comments"]) => {
    setLogs((current) =>
      current.map((log) => (log.id === logId ? { ...log, comments: updater(log.comments ?? []) } : log)),
    )
  }

  const toggleDaySection = (dayKey: string) => {
    setExpandedDayKeys((current) =>
      current.includes(dayKey) ? current.filter((key) => key !== dayKey) : [...current, dayKey],
    )
  }

  const expandAllDays = () => {
    setExpandedDayKeys(allDayKeys)
  }

  const collapseAllDays = () => {
    setExpandedDayKeys([])
  }

  const handleLoadMore = async () => {
    if (!session?.access_token || !nextCursor || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setError(null)

    try {
      const response = await fetchCoachWorkoutLogs(session.access_token, traineeId, {
        cursor: nextCursor,
        limit: 20,
        weekStart,
      })

      setLogs((current) => [...current, ...response.logs])
      setNextCursor(response.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thêm workout logs.")
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleExportExcel = async () => {
    if (!session?.access_token || isExporting) {
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const exportLogs = await loadAllCoachWorkoutLogsForExport(session.access_token, traineeId, weekStart)

      if (exportLogs.length === 0) {
        throw new Error("Không có workout log nào để xuất.")
      }

      const { downloadCoachWorkoutLogsWorkbook } = await import("@/components/coach/trainee-workout-logs-excel")
      await downloadCoachWorkoutLogsWorkbook(exportLogs, {
        traineeId,
        traineeName,
        weekStart,
      })
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Không thể xuất Excel.")
    } finally {
      setIsExporting(false)
    }
  }

  const handlePreviewExcel = async () => {
    if (!session?.access_token || isPreviewLoading) {
      return
    }

    setIsPreviewOpen(true)
    setIsPreviewLoading(true)
    setPreviewWorkbook(null)
    setError(null)

    try {
      const exportLogs = await loadAllCoachWorkoutLogsForExport(session.access_token, traineeId, weekStart)

      if (exportLogs.length === 0) {
        throw new Error("Không có workout log nào để preview.")
      }

      const { createCoachWorkoutLogsWorkbookPreview } = await import("@/components/coach/trainee-workout-logs-excel")
      const preview = await createCoachWorkoutLogsWorkbookPreview(exportLogs, {
        traineeId,
        traineeName,
        weekStart,
      })

      setPreviewWorkbook(preview)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Không thể preview Excel.")
      setIsPreviewOpen(false)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const handleCreateComment = async (logId: string) => {
    if (!session?.access_token || !draftByLogId[logId]?.trim()) {
      return
    }

    setSavingLogId(logId)
    setError(null)

    try {
      const comment = await createCoachWorkoutLogComment(session.access_token, logId, draftByLogId[logId])
      updateLogComments(logId, (comments) => [...comments, comment])
      setDraftByLogId((current) => ({ ...current, [logId]: "" }))
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Không thể lưu feedback.")
    } finally {
      setSavingLogId(null)
    }
  }

  const handleSaveEdit = async (logId: string, commentId: string) => {
    if (!session?.access_token || !editingContent.trim()) {
      return
    }

    setSavingLogId(logId)
    setError(null)

    try {
      const updatedComment = await updateCoachWorkoutLogComment(session.access_token, commentId, editingContent)
      updateLogComments(logId, (comments) =>
        comments.map((comment) => (comment.id === updatedComment.id ? updatedComment : comment)),
      )
      setEditingCommentId(null)
      setEditingContent("")
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Không thể cập nhật feedback.")
    } finally {
      setSavingLogId(null)
    }
  }

  const handleDeleteComment = async (logId: string, commentId: string) => {
    if (!session?.access_token || deletingCommentId) {
      return
    }

    setDeletingCommentId(commentId)
    setError(null)

    try {
      await deleteCoachWorkoutLogComment(session.access_token, commentId)
      updateLogComments(logId, (comments) => comments.filter((comment) => comment.id !== commentId))
      if (editingCommentId === commentId) {
        setEditingCommentId(null)
        setEditingContent("")
      }
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Không thể xóa feedback.")
    } finally {
      setDeletingCommentId(null)
    }
  }

  const renderLogCard = (log: WorkoutLog) => (
    <div key={log.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-lg font-semibold">{log.workout.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {log.startedAt.toLocaleString()} • {formatSessionLength(log)} min
            {log.totalVolume ? ` • ${Math.round(log.totalVolume).toLocaleString()} kg volume` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {log.completedAt ? "Completed" : "In progress"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {log.exercises.length} exercises
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {countCompletedSets(log)}/{countTotalSets(log)} sets done
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {log.comments.length} feedback
          </span>
        </div>
      </div>

      {log.notes ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {log.notes}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {log.exercises.map((exercise) => {
          const exerciseVolume = calculateExerciseVolume(exercise)

          return (
            <div key={exercise.id} className="rounded-xl border border-border bg-muted/15 px-4 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-medium">
                    {formatExerciseVariationLabel({
                      exerciseName: exercise.exercise.name,
                      isDefault: exercise.variation.isDefault,
                      variationName: exercise.variation.name,
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {exercise.exercise.muscleGroup}
                    {exercise.restTime ? ` • Rest ${exercise.restTime}s` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    {countCompletedExerciseSets(exercise)}/{exercise.sets.length} sets done
                  </span>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    {formatRepTarget({
                      reps: exercise.sets[0]?.targetReps,
                      repsMin: exercise.sets[0]?.targetRepsMin,
                    })} target
                  </span>
                  {exerciseVolume != null ? (
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                      {exerciseVolume.toLocaleString()} kg
                    </span>
                  ) : null}
                </div>
              </div>

              {exercise.notes ? (
                <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  {exercise.notes}
                </div>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="border-b border-border px-3 py-2">Set</th>
                      <th className="border-b border-border px-3 py-2">Target</th>
                      <th className="border-b border-border px-3 py-2">Actual</th>
                      <th className="border-b border-border px-3 py-2">Weight</th>
                      <th className="border-b border-border px-3 py-2">RIR</th>
                      <th className="border-b border-border px-3 py-2">Volume</th>
                      <th className="border-b border-border px-3 py-2">Status</th>
                      <th className="border-b border-border px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set) => {
                      const previousPerformance = formatPreviousPerformance(set)
                      const setVolume = calculateSetVolume(set)

                      return (
                        <tr key={set.id} className="align-top">
                          <td className="border-b border-border/60 px-3 py-3 font-medium">{set.setNumber}</td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            {formatRepTarget({
                              reps: set.targetReps,
                              repsMin: set.targetRepsMin,
                            })}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            {formatMetricValue(set.actualReps, { zeroAsValid: true })}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            {formatMetricValue(set.weight, { suffix: " kg", zeroAsValid: true })}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            {formatMetricValue(set.rir, { zeroAsValid: true })}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            {formatMetricValue(setVolume, { suffix: " kg", zeroAsValid: true })}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                set.completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {set.completed ? "Done" : "Pending"}
                            </span>
                          </td>
                          <td className="border-b border-border/60 px-3 py-3 text-muted-foreground">
                            <div className="space-y-1">
                              {set.notes ? <p>{set.notes}</p> : null}
                              {previousPerformance ? <p className="text-xs">Prev {previousPerformance}</p> : null}
                              {!set.notes && !previousPerformance ? <span>--</span> : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-muted/10 p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Coach feedback</h3>
        </div>

        <div className="mt-4 space-y-3">
          {log.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có feedback nào cho buổi tập này.</p>
          ) : (
            log.comments.map((comment) => {
              const isOwner = profile?.id === comment.authorId
              const isEditing = editingCommentId === comment.id

              return (
                <div key={comment.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{comment.authorName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{comment.createdAt.toLocaleString()}</p>
                    </div>

                    {isOwner ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingCommentId(comment.id)
                            setEditingContent(comment.content)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => void handleDeleteComment(log.id, comment.id)}
                          disabled={deletingCommentId === comment.id}
                        >
                          {deletingCommentId === comment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-3 space-y-3">
                      <Textarea
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        className="min-h-[100px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => void handleSaveEdit(log.id, comment.id)}
                          disabled={savingLogId === log.id}
                        >
                          {savingLogId === log.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-transparent"
                          onClick={() => {
                            setEditingCommentId(null)
                            setEditingContent("")
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">{comment.content}</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="mt-4 space-y-3">
          <Textarea
            value={draftByLogId[log.id] ?? ""}
            onChange={(event) => setDraftByLogId((current) => ({ ...current, [log.id]: event.target.value }))}
            placeholder="Write coaching feedback for this session..."
            className="min-h-[100px]"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Feedback is visible to the trainee in workout history.
            </p>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90"
              onClick={() => void handleCreateComment(log.id)}
              disabled={savingLogId === log.id || !(draftByLogId[log.id] ?? "").trim()}
            >
              {savingLogId === log.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Workout log details</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {logs.length > 0
              ? `Loaded ${logs.length} sessions for the selected week. Export uses the weekly template report and adds a raw set sheet.`
              : "Chọn tuần để xem full set detail và xuất weekly report theo template."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Week start</p>
            <Input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
              className="w-full min-w-[190px] bg-background sm:w-[220px]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => void handlePreviewExcel()}
            disabled={isPreviewLoading || isLoading || logs.length === 0}
          >
            {isPreviewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Preview report
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={() => void handleExportExcel()}
            disabled={isExporting || isLoading || logs.length === 0}
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export weekly report
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải workout history...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Chưa có workout log nào trong tuần đã chọn.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={expandAllDays}>
              Expand all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={collapseAllDays}>
              Collapse all
            </Button>
          </div>

          <div className="space-y-4">
            {daySections.map((section) => {
              const isExpanded = expandedDayKeys.includes(section.key)

              return (
                <div key={section.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => toggleDaySection(section.key)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-muted/20"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{section.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {section.logs.length > 0
                          ? `${section.logs.length} buổi tập • ${section.completedSets}/${section.totalSets} sets hoàn thành${
                              section.totalVolume > 0 ? ` • ${Math.round(section.totalVolume).toLocaleString()} kg volume` : ""
                            }`
                          : "Không có workout log trong ngày này."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        {section.logs.length} sessions
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-border bg-muted/10 px-4 py-4">
                      {section.logs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          Không có workout log trong ngày này.
                        </div>
                      ) : (
                        <div className="space-y-4">{section.logs.map(renderLogCard)}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}

      {nextCursor && logs.length > 0 ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="bg-transparent"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,1200px)] overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Preview weekly report</DialogTitle>
            <DialogDescription>
              Preview nhanh file Excel trước khi tải. Bản xem trong app có thể không giống Excel 100% về style.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
            {isPreviewLoading ? (
              <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo preview workbook...
              </div>
            ) : previewWorkbook ? (
              <Tabs defaultValue={previewWorkbook.sheets[0]?.name} className="h-full">
                <TabsList className="max-w-full flex-wrap justify-start">
                  {previewWorkbook.sheets.map((sheet) => (
                    <TabsTrigger key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {previewWorkbook.sheets.map((sheet) => (
                  <TabsContent key={sheet.name} value={sheet.name} className="mt-4">
                    <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-white p-4 text-black">
                      <div
                        className="min-w-max [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1"
                        dangerouslySetInnerHTML={{ __html: sheet.html }}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
                Không có dữ liệu preview.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="bg-transparent"
              onClick={() => setIsPreviewOpen(false)}
            >
              Đóng
            </Button>
            <Button
              type="button"
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                if (previewWorkbook) {
                  void import("@/components/coach/trainee-workout-logs-excel").then(({ downloadCoachWorkoutLogsWorkbookFile }) => {
                    downloadCoachWorkoutLogsWorkbookFile(previewWorkbook)
                  })
                }
              }}
              disabled={!previewWorkbook}
            >
              <Download className="mr-2 h-4 w-4" />
              Tải file Excel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
