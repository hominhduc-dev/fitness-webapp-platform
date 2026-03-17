"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createWorkout, fetchExercises } from "@/lib/fitness/api"
import type { Exercise } from "@/lib/types"

type WorkoutExerciseDraft = {
  exerciseId: string
  id: string
  reps: string
  restTime: string
  sets: string
}

type CreateWorkoutDialogProps = {
  trigger?: React.ReactNode
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

export function CreateWorkoutDialog({ trigger }: CreateWorkoutDialogProps) {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [scheduledDay, setScheduledDay] = useState(String(new Date().getDay()))
  const [duration, setDuration] = useState("45")
  const [notes, setNotes] = useState("")
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([])
  const [exerciseRows, setExerciseRows] = useState<WorkoutExerciseDraft[]>([createExerciseDraft()])
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setName("")
    setScheduledDay(String(new Date().getDay()))
    setDuration("45")
    setNotes("")
    setExerciseRows([createExerciseDraft(exerciseOptions[0]?.id ?? "")])
    setError(null)
  }

  useEffect(() => {
    if (!open || !session?.access_token || exerciseOptions.length > 0) {
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
  }, [exerciseOptions.length, open, session?.access_token])

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
      setError("You need to be signed in to create a workout.")
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
    setError(null)

    try {
      await createWorkout(session.access_token, {
        duration: duration ? Math.max(1, Number(duration) || 1) : undefined,
        exercises: normalizedExercises,
        name: name.trim(),
        notes: notes.trim() || undefined,
        scheduledDay: Number(scheduledDay),
      })

      handleOpenChange(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create workout.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 bg-primary hover:bg-primary/90" disabled={authLoading}>
            <Plus className="h-4 w-4" />
            Create workout
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create your own workout</DialogTitle>
          <DialogDescription>
            Build a personal workout and add it straight to your schedule without waiting for a coach assignment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Exercises</h3>
                <p className="text-sm text-muted-foreground">Choose the movements and target set structure.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={addExerciseRow}
                disabled={isLoadingExercises || exerciseOptions.length === 0}
              >
                <Plus className="h-4 w-4" />
                Add exercise
              </Button>
            </div>

            <div className="space-y-3">
              {exerciseRows.map((row, index) => (
                <div key={row.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Exercise {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Sets, reps, and rest can be adjusted per movement.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExerciseRow(row.id)}
                      disabled={exerciseRows.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_120px_120px_140px]">
                    <div className="space-y-2">
                      <Label>Exercise</Label>
                      <Select
                        value={row.exerciseId}
                        onValueChange={(value) => updateExerciseRow(row.id, { exerciseId: value })}
                        disabled={isLoadingExercises}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={isLoadingExercises ? "Loading exercises..." : "Choose an exercise"} />
                        </SelectTrigger>
                        <SelectContent>
                          {exerciseOptions.map((exercise) => (
                            <SelectItem key={exercise.id} value={exercise.id}>
                              {exercise.name} · {exercise.muscleGroup}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Sets</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.sets}
                        onChange={(event) => updateExerciseRow(row.id, { sets: event.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Reps</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.reps}
                        onChange={(event) => updateExerciseRow(row.id, { reps: event.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rest (sec)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={row.restTime}
                        onChange={(event) => updateExerciseRow(row.id, { restTime: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2 bg-primary hover:bg-primary/90" disabled={isSaving || isLoadingExercises}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isSaving ? "Creating..." : "Save workout"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
