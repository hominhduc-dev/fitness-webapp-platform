"use client"

import { useEffect, useState } from "react"
import { Clock3, Loader2, MessageSquare, Pencil, Save, Trash2 } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  createCoachWorkoutLogComment,
  deleteCoachWorkoutLogComment,
  fetchCoachWorkoutLogs,
  updateCoachWorkoutLogComment,
} from "@/lib/fitness/api"
import type { WorkoutLog } from "@/lib/types"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import { formatRepTarget } from "@/lib/workout-reps"

type TraineeWorkoutLogsPanelProps = {
  initialLogs?: WorkoutLog[]
  traineeId: string
}

function formatSessionLength(log: WorkoutLog) {
  const endTime = log.completedAt ?? log.startedAt
  return Math.max(1, Math.round((endTime.getTime() - log.startedAt.getTime()) / 60_000))
}

export function TraineeWorkoutLogsPanel({ initialLogs = [], traineeId }: TraineeWorkoutLogsPanelProps) {
  const { profile, session } = useAuth()
  const [logs, setLogs] = useState<WorkoutLog[]>(initialLogs)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftByLogId, setDraftByLogId] = useState<Record<string, string>>({})
  const [savingLogId, setSavingLogId] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    let cancelled = false

    const loadLogs = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetchCoachWorkoutLogs(session.access_token, traineeId, { limit: 20 })

        if (cancelled) {
          return
        }

        setLogs(response.logs)
        setNextCursor(response.nextCursor)
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
  }, [session?.access_token, traineeId])

  const updateLogComments = (logId: string, updater: (comments: WorkoutLog["comments"]) => WorkoutLog["comments"]) => {
    setLogs((current) =>
      current.map((log) => (log.id === logId ? { ...log, comments: updater(log.comments ?? []) } : log)),
    )
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
      })

      setLogs((current) => [...current, ...response.logs])
      setNextCursor(response.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải thêm workout logs.")
    } finally {
      setIsLoadingMore(false)
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

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workout history...
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Chua co workout log nao cho trainee nay.
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-lg font-semibold">{log.workout.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {log.startedAt.toLocaleString()} • {formatSessionLength(log)} min
                    {log.totalVolume ? ` • ${Math.round(log.totalVolume).toLocaleString()} kg volume` : ""}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {log.exercises.length} exercises
                </div>
              </div>

              {log.notes ? (
                <div className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  {log.notes}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {log.exercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-xl border border-border bg-muted/15 px-4 py-3">
                    <p className="font-medium">
                      {formatExerciseVariationLabel({
                        exerciseName: exercise.exercise.name,
                        isDefault: exercise.variation.isDefault,
                        variationName: exercise.variation.name,
                      })}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {exercise.sets.length} sets •{" "}
                      {formatRepTarget({
                        reps: exercise.sets[0]?.targetReps,
                        repsMin: exercise.sets[0]?.targetRepsMin,
                      })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-muted/10 p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Coach feedback</h3>
                </div>

                <div className="mt-4 space-y-3">
                  {log.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chua co feedback nao cho buoi tap nay.</p>
                  ) : (
                    log.comments.map((comment) => {
                      const isOwner = profile?.id === comment.authorId
                      const isEditing = editingCommentId === comment.id

                      return (
                        <div key={comment.id} className="rounded-xl border border-border bg-card px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{comment.authorName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {comment.createdAt.toLocaleString()}
                              </p>
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
                                  {deletingCommentId === comment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                                  {savingLogId === log.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
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
          ))}
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" className="bg-transparent" onClick={() => void handleLoadMore()} disabled={isLoadingMore}>
            {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  )
}
