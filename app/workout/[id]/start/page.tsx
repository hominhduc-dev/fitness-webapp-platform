"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ExerciseCard } from "@/components/workout/exercise-card"
import { RestTimer } from "@/components/workout/rest-timer"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Clock, Check, X } from "lucide-react"
import { sampleWorkouts } from "@/lib/mock-data"
import type { ExerciseSet } from "@/lib/types"

export default function WorkoutStartPage() {
  const params = useParams()
  const router = useRouter()
  const workout = sampleWorkouts.find((w) => w.id === params.id) || sampleWorkouts[0]

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [exercises, setExercises] = useState(workout.exercises)
  const [startTime] = useState(new Date())

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0)
  const progress = (completedSets / totalSets) * 100

  const handleSetComplete = (exerciseId: string, setId: string, data: Partial<ExerciseSet>) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex
        return {
          ...ex,
          sets: ex.sets.map((set) => (set.id === setId ? { ...set, ...data } : set)),
        }
      }),
    )
  }

  const handleFinishWorkout = () => {
    router.push("/dashboard")
  }

  const elapsedMinutes = Math.round((Date.now() - startTime.getTime()) / 60000)

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed header */}
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

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedSets}/{totalSets} sets
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </header>

      {/* Rest timer - mobile only, sticky under header */}
      <div className="lg:hidden">
        <RestTimer defaultTime={exercises[currentExerciseIndex]?.restTime || 90} />
      </div>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Exercises list */}
          <div className="lg:col-span-2 space-y-4">
            {exercises.map((exercise, idx) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseIndex={idx}
                isActive={idx === currentExerciseIndex}
                onSetComplete={(setId, data) => handleSetComplete(exercise.id, setId, data)}
              />
            ))}
          </div>

          {/* Rest timer - sidebar on desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <RestTimer defaultTime={exercises[currentExerciseIndex]?.restTime || 90} />
            </div>
          </div>
        </div>
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 backdrop-blur-lg p-4 md:p-6">
        <div className="mx-auto max-w-2xl">
          <Button
            size="lg"
            className="w-full bg-success hover:bg-success/90 text-white font-semibold gap-2 h-12"
            onClick={handleFinishWorkout}
            disabled={completedSets === 0}
          >
            <Check className="h-5 w-5" />
            Finish Workout
          </Button>
        </div>
      </div>
    </div>
  )
}
