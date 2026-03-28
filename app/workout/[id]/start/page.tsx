"use client"

import { ArrowLeft, Check, Clock, X } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ExerciseCard } from "@/components/workout/exercise-card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createWorkoutLog, fetchWorkoutDetail, fetchWorkouts } from "@/lib/fitness/api"
import type { ExerciseSet, Workout } from "@/lib/types"

const WORKOUT_SESSION_STORAGE_PREFIX = "workout-session"

type StoredWorkoutSession = {
  currentExerciseIndex: number
  exercises: Array<{
    id: string
    sets: Array<{
      actualReps?: number
      completed: boolean
      id: string
      notes?: string
      rir?: number
      weight?: number
    }>
  }>
  startedAt: string
}

function getWorkoutSessionStorageKey(workoutId: string) {
  return `${WORKOUT_SESSION_STORAGE_PREFIX}:${workoutId}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function hasSessionProgress(exercises: Workout["exercises"]) {
  return exercises.some((exercise) => exercise.sets.some((set) => set.completed))
}

function sanitizeStoredWorkoutExercises(rawExercises: unknown): StoredWorkoutSession["exercises"] {
  if (!Array.isArray(rawExercises)) {
    return []
  }

  return rawExercises.flatMap((exercise: unknown) => {
    if (typeof exercise !== "object" || exercise === null) {
      return []
    }

    const exerciseRecord = exercise as { id?: unknown; sets?: unknown }

    if (typeof exerciseRecord.id !== "string") {
      return []
    }

    const rawSets = Array.isArray(exerciseRecord.sets) ? exerciseRecord.sets : []

    return [
      {
        id: exerciseRecord.id,
        sets: rawSets.flatMap((set: unknown) => {
          if (typeof set !== "object" || set === null) {
            return []
          }

          const setRecord = set as {
            actualReps?: unknown
            completed?: unknown
            id?: unknown
            notes?: unknown
            rir?: unknown
            weight?: unknown
          }

          if (typeof setRecord.id !== "string") {
            return []
          }

          return [
            {
              actualReps: isFiniteNumber(setRecord.actualReps) ? setRecord.actualReps : undefined,
              completed: Boolean(setRecord.completed),
              id: setRecord.id,
              notes: typeof setRecord.notes === "string" ? setRecord.notes : undefined,
              rir: isFiniteNumber(setRecord.rir) ? setRecord.rir : undefined,
              weight: isFiniteNumber(setRecord.weight) ? setRecord.weight : undefined,
            },
          ]
        }),
      },
    ]
  })
}

function readStoredWorkoutSession(workoutId: string) {
  const rawValue = window.localStorage.getItem(getWorkoutSessionStorageKey(workoutId))

  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (typeof parsed !== "object" || parsed === null) {
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
      return null
    }

    const currentExerciseIndex = isFiniteNumber(parsed.currentExerciseIndex) ? parsed.currentExerciseIndex : 0
    const startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString()
    const exercises = sanitizeStoredWorkoutExercises(parsed.exercises)

    return {
      currentExerciseIndex,
      exercises,
      startedAt,
    } satisfies StoredWorkoutSession
  } catch {
    window.localStorage.removeItem(getWorkoutSessionStorageKey(workoutId))
    return null
  }
}

function createStoredWorkoutSession(
  exercises: Workout["exercises"],
  startedAt: Date,
  currentExerciseIndex: number,
): StoredWorkoutSession {
  return {
    currentExerciseIndex,
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      sets: exercise.sets.map((set) => ({
        actualReps: set.actualReps,
        completed: set.completed,
        id: set.id,
        notes: set.notes,
        rir: set.rir,
        weight: set.weight,
      })),
    })),
    startedAt: startedAt.toISOString(),
  }
}

function restoreWorkoutSessionExercises(baseExercises: Workout["exercises"], storedExercises: StoredWorkoutSession["exercises"]) {
  const storedExercisesById = new Map(storedExercises.map((exercise) => [exercise.id, exercise]))

  return baseExercises.map((exercise) => {
    const storedExercise = storedExercisesById.get(exercise.id)

    if (!storedExercise) {
      return exercise
    }

    const storedSetsById = new Map(storedExercise.sets.map((set) => [set.id, set]))

    return {
      ...exercise,
      sets: exercise.sets.map((set) => {
        const storedSet = storedSetsById.get(set.id)

        if (!storedSet) {
          return set
        }

        return {
          ...set,
          actualReps: isFiniteNumber(storedSet.actualReps) ? storedSet.actualReps : undefined,
          completed: Boolean(storedSet.completed),
          notes: typeof storedSet.notes === "string" ? storedSet.notes : set.notes,
          rir: isFiniteNumber(storedSet.rir) ? storedSet.rir : undefined,
          weight: isFiniteNumber(storedSet.weight) ? storedSet.weight : undefined,
        }
      }),
    }
  })
}

function restoreWorkoutSessionStartTime(startedAt: string) {
  const parsedTime = new Date(startedAt)

  return Number.isNaN(parsedTime.getTime()) ? new Date() : parsedTime
}

export default function WorkoutStartPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, profile, session } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Workout["exercises"]>([])
  const [startTime, setStartTime] = useState(new Date())
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoggedToday, setHasLoggedToday] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id
  const weightUnit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  useEffect(() => {
    if (!session?.access_token || !workoutId) {
      if (!authLoading) {
        setIsLoading(false)
      }

      return
    }

    let cancelled = false

    const loadWorkout = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [nextWorkout, workoutCollection] = await Promise.all([
          fetchWorkoutDetail(session.access_token, workoutId),
          fetchWorkouts(session.access_token),
        ])

        if (cancelled) {
          return
        }

        const today = new Date()
        const alreadyLoggedToday = workoutCollection.recentLogs.some((log) => {
          const logDate = log.startedAt
          return (
            log.workout.id === workoutId &&
            logDate.getFullYear() === today.getFullYear() &&
            logDate.getMonth() === today.getMonth() &&
            logDate.getDate() === today.getDate()
          )
        })

        const storedSession = readStoredWorkoutSession(workoutId)

        setWorkout(nextWorkout)
        setHasLoggedToday(alreadyLoggedToday)
        setExercises(
          storedSession ? restoreWorkoutSessionExercises(nextWorkout.exercises, storedSession.exercises) : nextWorkout.exercises,
        )
        setCurrentExerciseIndex(
          storedSession
            ? Math.min(Math.max(0, storedSession.currentExerciseIndex), Math.max(0, nextWorkout.exercises.length - 1))
            : 0,
        )
        setStartTime(storedSession ? restoreWorkoutSessionStartTime(storedSession.startedAt) : new Date())
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Không thể tải workout.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadWorkout()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token, workoutId])

  useEffect(() => {
    if (!workout || !workoutId) {
      return
    }

    const storageKey = getWorkoutSessionStorageKey(workoutId)

    if (!hasSessionProgress(exercises)) {
      window.localStorage.removeItem(storageKey)
      return
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(createStoredWorkoutSession(exercises, startTime, currentExerciseIndex)),
    )
  }, [currentExerciseIndex, exercises, startTime, workout, workoutId])

  const totalSets = exercises.reduce((accumulator, exercise) => accumulator + exercise.sets.length, 0)
  const completedSets = exercises.reduce(
    (accumulator, exercise) => accumulator + exercise.sets.filter((set) => set.completed).length,
    0,
  )
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0

  const handleSetComplete = (exerciseId: string, setId: string, data: Partial<ExerciseSet>) => {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise
        }

        return {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...data } : set)),
        }
      }),
    )
  }

  const performSave = async () => {
    if (!session?.access_token || !workout) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await createWorkoutLog(session.access_token, workout.id, {
        completedAt: new Date().toISOString(),
        exercises,
        startedAt: startTime.toISOString(),
      })
      window.localStorage.removeItem(getWorkoutSessionStorageKey(workout.id))
      router.push("/dashboard")
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu workout log.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleFinishWorkout = () => {
    if (hasLoggedToday) {
      setShowDuplicateDialog(true)
      return
    }

    void performSave()
  }

  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTime.getTime()) / 60000))

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading workout...</div>
  }

  if (!workout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Workout not found</p>
          <p className="mt-2 text-sm text-muted-foreground">{error || "This workout is unavailable or not assigned to you."}</p>
          <Button className="mt-4" onClick={() => router.push("/workout")}>
            Back to workouts
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-lg">
        <div className="flex h-16 items-center justify-between px-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="font-semibold">{workout.name}</p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{elapsedMinutes} min</span>
            </div>
          </div>
          <Button variant="destructive" size="icon" onClick={() => router.back()}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedSets}/{totalSets} sets
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-32">
        <div className="space-y-4">
          {exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              exerciseIndex={index}
              isActive={index === currentExerciseIndex}
              weightUnit={weightUnit}
              onSetComplete={(setId, data) => handleSetComplete(exercise.id, setId, data)}
            />
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur-lg p-4">
        <div className="mx-auto flex max-w-2xl items-center">
          <Button
            size="lg"
            className="flex-1 bg-success hover:bg-success/90 text-white font-semibold gap-2"
            onClick={handleFinishWorkout}
            disabled={completedSets === 0 || isSaving}
          >
            <Check className="h-5 w-5" />
            {isSaving ? "Saving..." : "Finish Workout"}
          </Button>
        </div>
      </div>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Workout đã được log hôm nay</DialogTitle>
            <DialogDescription>
              Bạn đã log workout này hôm nay rồi. Bạn có muốn lưu thêm một lần nữa với số liệu mới không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setShowDuplicateDialog(false)
                void performSave()
              }}
              disabled={isSaving}
            >
              {isSaving ? "Đang lưu..." : "Lưu thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
