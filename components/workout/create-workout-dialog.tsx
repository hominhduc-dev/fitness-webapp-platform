"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { ExercisePicker } from "@/components/exercises/exercise-picker"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { createWorkout, fetchExercises, updateWorkout } from "@/lib/fitness/api"
import type { Exercise, Workout } from "@/lib/types"
import { cn } from "@/lib/utils"

type WorkoutExerciseDraft = {
  exerciseId: string
  id: string
  reps: string
  restTime: string
  sets: string
}

type DialogMode = "create" | "template"

type CreateWorkoutDialogProps = {
  defaultScheduledDay?: number
  trigger?: React.ReactNode
  workoutTemplates?: Workout[]
  workoutToEdit?: Workout
}

const DAY_OPTIONS = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
]

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createExerciseDraft(defaultExerciseId = ""): WorkoutExerciseDraft {
  return {
    exerciseId: defaultExerciseId,
    id: createDraftId(),
    reps: "10",
    restTime: "90",
    sets: "3",
  }
}

function createExerciseDraftFromWorkout(exercise: Workout["exercises"][number]): WorkoutExerciseDraft {
  return {
    exerciseId: exercise.exercise.id,
    id: createDraftId(),
    reps: String(Math.max(1, exercise.sets[0]?.targetReps ?? 1)),
    restTime: exercise.restTime != null ? String(exercise.restTime) : "",
    sets: String(Math.max(1, exercise.sets.length)),
  }
}

function getExerciseGroups(workout: Workout) {
  return Array.from(new Set(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))).slice(0, 3)
}

function getExercisePreview(workout: Workout) {
  return workout.exercises
    .slice(0, 3)
    .map((exercise) => exercise.exercise.name)
    .join(", ")
}

function sortWorkoutTemplates(workouts: Workout[]) {
  return workouts
    .filter((workout) => workout.exercises.length > 0)
    .slice()
    .sort((left, right) => {
      const personalDelta = Number(Boolean(right.isPersonal)) - Number(Boolean(left.isPersonal))

      if (personalDelta !== 0) {
        return personalDelta
      }

      return left.name.localeCompare(right.name)
    })
}

function getDayLabel(dayValue: string) {
  return DAY_OPTIONS.find((option) => option.value === dayValue)?.label ?? "Selected Day"
}

export function CreateWorkoutDialog({
  defaultScheduledDay,
  trigger,
  workoutTemplates = [],
  workoutToEdit,
}: CreateWorkoutDialogProps) {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
  const isEditing = Boolean(workoutToEdit)
  const [isMounted, setIsMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([])
  const [mode, setMode] = useState<DialogMode>("create")
  const [name, setName] = useState("")
  const [scheduledDay, setScheduledDay] = useState(String(defaultScheduledDay ?? new Date().getDay()))
  const [duration, setDuration] = useState("45")
  const [notes, setNotes] = useState("")
  const [exerciseRows, setExerciseRows] = useState<WorkoutExerciseDraft[]>([createExerciseDraft()])
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [showExerciseListFade, setShowExerciseListFade] = useState(false)
  const exerciseListRef = useRef<HTMLDivElement | null>(null)

  const templateOptions = useMemo(
    () => (isEditing ? [] : sortWorkoutTemplates(workoutTemplates)),
    [isEditing, workoutTemplates],
  )
  const hasTemplateOptions = templateOptions.length > 0
  const shouldLockExerciseListHeight = isMobileViewport ? exerciseRows.length >= 2 : exerciseRows.length >= 3
  const isScheduledDayLocked = !isEditing && typeof defaultScheduledDay === "number"
  const selectedDayLabel = getDayLabel(scheduledDay)
  const triggerContent = trigger ?? (
    <Button className="gap-2 bg-primary hover:bg-primary/90" disabled={authLoading}>
      <Plus className="h-4 w-4" />
      Create workout
    </Button>
  )

  const getDefaultMode = () => {
    if (hasTemplateOptions && isScheduledDayLocked) {
      return "template" as const
    }

    return "create" as const
  }

  const createInitialFormState = (defaultExerciseId = "") => {
    if (workoutToEdit) {
      return {
        duration: workoutToEdit.duration ? String(workoutToEdit.duration) : "45",
        exerciseRows:
          workoutToEdit.exercises.length > 0
            ? workoutToEdit.exercises.map(createExerciseDraftFromWorkout)
            : [createExerciseDraft(defaultExerciseId)],
        name: workoutToEdit.name,
        notes: workoutToEdit.notes ?? "",
        scheduledDay: String(workoutToEdit.scheduledDay ?? defaultScheduledDay ?? new Date().getDay()),
      }
    }

    return {
      duration: "45",
      exerciseRows: [createExerciseDraft(defaultExerciseId)],
      name: "",
      notes: "",
      scheduledDay: String(defaultScheduledDay ?? new Date().getDay()),
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches)
    }

    syncViewport()
    mediaQuery.addEventListener("change", syncViewport)

    return () => {
      mediaQuery.removeEventListener("change", syncViewport)
    }
  }, [])

  const resetForm = () => {
    const initialState = createInitialFormState(exerciseOptions[0]?.id ?? "")

    setName(initialState.name)
    setScheduledDay(initialState.scheduledDay)
    setDuration(initialState.duration)
    setNotes(initialState.notes)
    setExerciseRows(initialState.exerciseRows)
    setMode(getDefaultMode())
    setActiveTemplateId(null)
    setError(null)
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [defaultScheduledDay, exerciseOptions.length, open, workoutToEdit])

  useEffect(() => {
    if (!open) {
      return
    }

    setMode(getDefaultMode())
  }, [defaultScheduledDay, hasTemplateOptions, isScheduledDayLocked, open])

  useEffect(() => {
    if (!open || !session?.access_token || exerciseOptions.length > 0 || (!isEditing && mode !== "create")) {
      return
    }

    let cancelled = false

    const loadExercises = async () => {
      setIsLoadingExercises(true)
      setError(null)

      try {
        const exercises = await fetchExercises(session.access_token)

        if (cancelled) {
          return
        }

        setExerciseOptions(exercises)
        setExerciseRows((current) =>
          current.map((row, index) =>
            index === 0 && !row.exerciseId && exercises[0]
              ? {
                  ...row,
                  exerciseId: exercises[0].id,
                }
              : row,
          ),
        )
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load exercise library.")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExercises(false)
        }
      }
    }

    void loadExercises()

    return () => {
      cancelled = true
    }
  }, [exerciseOptions.length, isEditing, mode, open, session?.access_token])

  const syncExerciseListFade = () => {
    const node = exerciseListRef.current

    if (!node) {
      setShowExerciseListFade(false)
      return
    }

    const hasOverflow = node.scrollHeight - node.clientHeight > 8
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 8

    setShowExerciseListFade(hasOverflow && !isAtBottom)
  }

  useEffect(() => {
    if (!open) {
      setShowExerciseListFade(false)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      syncExerciseListFade()
    })

    const handleResize = () => {
      syncExerciseListFade()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", handleResize)
    }
  }, [exerciseRows.length, mode, open])

  const addExerciseRow = () => {
    setExerciseRows((current) => [...current, createExerciseDraft(exerciseOptions[0]?.id ?? "")])
  }

  const updateExerciseRow = (rowId: string, patch: Partial<WorkoutExerciseDraft>) => {
    setExerciseRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  const removeExerciseRow = (rowId: string) => {
    setExerciseRows((current) => {
      if (current.length === 1) {
        return current
      }

      return current.filter((row) => row.id !== rowId)
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      resetForm()
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!session?.access_token) {
      setError("You need to be signed in to save a workout.")
      return
    }

    const normalizedExercises = exerciseRows
      .filter((row) => row.exerciseId)
      .map((row) => ({
        exerciseId: row.exerciseId,
        reps: Math.max(1, Number(row.reps) || 1),
        restTime: row.restTime ? Math.max(0, Number(row.restTime) || 0) : undefined,
        sets: Math.max(1, Number(row.sets) || 1),
      }))

    if (!name.trim()) {
      setError("Workout name is required.")
      return
    }

    if (normalizedExercises.length === 0) {
      setError("Add at least one exercise to save this workout.")
      return
    }

    setIsSaving(true)
    setActiveTemplateId(null)
    setError(null)

    try {
      const payload = {
        duration: duration ? Math.max(1, Number(duration) || 1) : undefined,
        exercises: normalizedExercises,
        name: name.trim(),
        notes: notes.trim() || undefined,
        scheduledDay: Number(scheduledDay),
      }

      if (isEditing && workoutToEdit) {
        await updateWorkout(session.access_token, workoutToEdit.id, payload)
      } else {
        await createWorkout(session.access_token, payload)
      }

      handleOpenChange(false)
      router.refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : isEditing
            ? "Unable to update workout."
            : "Unable to create workout.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleTemplateSelect = async (template: Workout) => {
    if (!session?.access_token || isSaving) {
      return
    }

    if (template.exercises.length === 0) {
      setError("This template has no exercises yet.")
      return
    }

    setIsSaving(true)
    setActiveTemplateId(template.id)
    setError(null)

    try {
      await createWorkout(session.access_token, {
        duration: template.duration,
        exercises: template.exercises.map((exercise) => ({
          exerciseId: exercise.exercise.id,
          reps: Math.max(1, exercise.sets[0]?.targetReps ?? 1),
          restTime: exercise.restTime,
          sets: Math.max(1, exercise.sets.length),
        })),
        name: template.name,
        notes: template.notes,
        scheduledDay: Number(scheduledDay),
      })

      handleOpenChange(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add this template.")
    } finally {
      setIsSaving(false)
      setActiveTemplateId(null)
    }
  }

  const dialogTitle = isEditing ? "Edit Workout" : isScheduledDayLocked ? `Add Workout to ${selectedDayLabel}` : "Add Workout"
  const dialogDescription = isEditing
    ? "Update the workout details and keep this session aligned with your schedule."
    : hasTemplateOptions
      ? "Create a fresh workout or drop in one of your saved templates."
      : "Build a personal workout and add it straight to your schedule without waiting for a coach assignment."
  const saveButtonLabel = isSaving ? (isEditing ? "Saving..." : "Creating...") : isEditing ? "Save changes" : "Save workout"

  const createTab = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="workout-name">Workout name</Label>
          <Input
            id="workout-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Saturday Push Session"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workout-duration">Estimated duration (minutes)</Label>
          <Input
            id="workout-duration"
            type="number"
            min={1}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="45"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="workout-notes">Notes</Label>
          <Textarea
            id="workout-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional cues, focus points, or equipment notes."
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,255,0.98)_0%,rgba(255,255,255,0.92)_100%)] px-4 py-3 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Exercises</h3>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {exerciseRows.length} {exerciseRows.length === 1 ? "move" : "moves"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Choose the movements and target set structure.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-primary/20 bg-background/90 px-4"
            onClick={addExerciseRow}
            disabled={isLoadingExercises || exerciseOptions.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
        </div>

        <div className="relative">
          <div
            ref={exerciseListRef}
            onScroll={syncExerciseListFade}
            className={cn(
              "space-y-3 pr-1 pb-2",
              shouldLockExerciseListHeight &&
                "max-h-[12rem] overflow-y-auto overscroll-contain [scrollbar-color:rgba(148,163,184,0.45)_transparent] [scrollbar-width:thin] [touch-action:pan-y] [-webkit-overflow-scrolling:touch] md:max-h-[15rem] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent",
            )}
          >
            {exerciseRows.map((row) => (
              <div
                key={row.id}
                className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.92)_100%)] p-3 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <Label className="sr-only">Exercise</Label>
                    <ExercisePicker
                      selectedExerciseId={row.exerciseId}
                      exercises={exerciseOptions}
                      disabled={isLoadingExercises}
                      onSelect={(exerciseId) => updateExerciseRow(row.id, { exerciseId })}
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <div className="flex h-10 w-[3.25rem] flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:w-[3.75rem] sm:px-2">
                      <Label htmlFor={`${row.id}-sets`} className="sr-only">
                        Sets
                      </Label>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
                        Sets
                      </span>
                      <Input
                        id={`${row.id}-sets`}
                        type="number"
                        min={1}
                        value={row.sets}
                        onChange={(event) => updateExerciseRow(row.id, { sets: event.target.value })}
                        className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
                      />
                    </div>

                    <div className="flex h-10 w-[3.25rem] flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:w-[3.75rem] sm:px-2">
                      <Label htmlFor={`${row.id}-reps`} className="sr-only">
                        Reps
                      </Label>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
                        Reps
                      </span>
                      <Input
                        id={`${row.id}-reps`}
                        type="number"
                        min={1}
                        value={row.reps}
                        onChange={(event) => updateExerciseRow(row.id, { reps: event.target.value })}
                        className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
                      />
                    </div>

                    <div className="flex h-10 w-[3.5rem] flex-col items-center justify-center rounded-xl border border-border/70 bg-background/90 px-1.5 sm:h-11 sm:w-[4.25rem] sm:px-2">
                      <Label htmlFor={`${row.id}-rest`} className="sr-only">
                        Rest time in seconds
                      </Label>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
                        Rest
                      </span>
                      <Input
                        id={`${row.id}-rest`}
                        type="number"
                        min={0}
                        value={row.restTime}
                        onChange={(event) => updateExerciseRow(row.id, { restTime: event.target.value })}
                        placeholder="90"
                        className="h-5 w-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-10 w-10 shrink-0 rounded-xl border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/5 hover:text-destructive sm:h-11 sm:w-11"
                      onClick={() => removeExerciseRow(row.id)}
                      disabled={exerciseRows.length === 1}
                      aria-label="Remove exercise"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-[24px] bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-200",
              showExerciseListFade ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className="bg-transparent" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="gap-2 bg-primary hover:bg-primary/90" disabled={isSaving || isLoadingExercises}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : !isEditing ? <Plus className="h-4 w-4" /> : null}
          {saveButtonLabel}
        </Button>
      </DialogFooter>
    </form>
  )

  const templateTab = (
    <div className="space-y-4">
      {hasTemplateOptions ? (
        <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
          {templateOptions.map((template) => {
            const isActive = activeTemplateId === template.id
            const exercisePreview = getExercisePreview(template)
            const exerciseGroups = getExerciseGroups(template)

            return (
              <div key={template.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-foreground">{template.name}</h3>
                      {template.isPersonal ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Personal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {template.exercises.length} exercises · {template.duration ?? 45} min
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="bg-transparent"
                    onClick={() => void handleTemplateSelect(template)}
                    disabled={isSaving}
                  >
                    {isActive ? "Adding..." : "Select"}
                  </Button>
                </div>

                {exerciseGroups.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exerciseGroups.map((group) => (
                      <span key={group} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {group}
                      </span>
                    ))}
                  </div>
                ) : null}

                {exercisePreview ? <p className="mt-3 text-sm text-muted-foreground">{exercisePreview}</p> : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No workout templates yet. Switch to Create New to build your first one.</p>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" className="bg-transparent" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
      </DialogFooter>
    </div>
  )

  if (!isMounted) {
    return <>{triggerContent}</>
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerContent}
      </DialogTrigger>

      <DialogContent className="max-h-[92svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[28px] sm:max-h-[90vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto pr-1 pb-1 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!isScheduledDayLocked ? (
            <div className="space-y-2">
              <Label htmlFor="workout-day">Scheduled day</Label>
              <Select value={scheduledDay} onValueChange={setScheduledDay}>
                <SelectTrigger id="workout-day" className="w-full">
                  <SelectValue placeholder="Choose a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {hasTemplateOptions ? (
            <Tabs value={mode} onValueChange={(value) => setMode(value as DialogMode)} className="gap-4">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl p-1">
                <TabsTrigger value="create" className="rounded-xl py-2.5">
                  Create New
                </TabsTrigger>
                <TabsTrigger value="template" className="rounded-xl py-2.5">
                  From Template
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create">{createTab}</TabsContent>
              <TabsContent value="template">{templateTab}</TabsContent>
            </Tabs>
          ) : (
            createTab
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
