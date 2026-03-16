"use client"

import { ArrowLeft, Check, Clock, X } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ExerciseCard } from "@/components/workout/exercise-card"
import { RestTimer } from "@/components/workout/rest-timer"
import { createWorkoutLog, fetchWorkoutDetail } from "@/lib/fitness/api"
import type { ExerciseSet, Workout } from "@/lib/types"

export default function WorkoutStartPage() {
  const params = useParams()
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Workout["exercises"]>([])
  const [startTime, setStartTime] = useState(new Date())
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id

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
        const nextWorkout = await fetchWorkoutDetail(session.access_token, workoutId)

        if (cancelled) {
          return
        }

        setWorkout(nextWorkout)
        setExercises(nextWorkout.exercises)
        setCurrentExerciseIndex(0)
        setStartTime(new Date())
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

  const handleFinishWorkout = async () => {
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
      router.push("/dashboard")
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu workout log.")
    } finally {
      setIsSaving(false)
    }
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
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {exercises.map((exercise, index) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseIndex={index}
                isActive={index === currentExerciseIndex}
                onSetComplete={(setId, data) => handleSetComplete(exercise.id, setId, data)}
              />
            ))}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24">
              <RestTimer defaultTime={exercises[currentExerciseIndex]?.restTime || 90} />
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur-lg p-4">
        <div className="mx-auto max-w-2xl flex items-center gap-4">
          <div className="lg:hidden flex-1">
            <RestTimer defaultTime={exercises[currentExerciseIndex]?.restTime || 90} />
          </div>

          <Button
            size="lg"
            className="flex-1 bg-success hover:bg-success/90 text-white font-semibold gap-2"
            onClick={() => void handleFinishWorkout()}
            disabled={completedSets === 0 || isSaving}
          >
            <Check className="h-5 w-5" />
            {isSaving ? "Saving..." : "Finish Workout"}
          </Button>
        </div>
      </div>
    </div>
  )
}
