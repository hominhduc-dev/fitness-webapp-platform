import { describe, expect, it } from "vitest"

import type { Workout } from "@/lib/types"
import { summarizeWorkoutSession } from "./share-summary"

function exercise(name: string, sets: Array<{ completed: boolean; reps?: number; weight?: number }>) {
  return {
    exercise: { id: name, muscleGroup: "Chest", name },
    id: name,
    sets: sets.map((set, index) => ({
      actualReps: set.reps,
      completed: set.completed,
      id: `${name}-${index}`,
      setNumber: index + 1,
      targetReps: 10,
      weight: set.weight,
    })),
    variation: { id: `${name}-v`, isDefault: true, name: "Default", sortOrder: 0 },
  }
}

describe("summarizeWorkoutSession", () => {
  const exercises = [
    exercise("Bench Press", [
      { completed: true, reps: 8, weight: 100 },
      { completed: true, reps: 6, weight: 100 },
    ]),
    exercise("Push Up", [{ completed: true, reps: 20 }, { completed: false }]),
    exercise("Fly", [{ completed: false, weight: 20 }]),
  ] as Workout["exercises"]

  it("counts only completed sets", () => {
    const summary = summarizeWorkoutSession(exercises, { durationMins: 48, workoutName: "Chest Day" })

    expect(summary).toMatchObject({
      completedExercises: 1,
      completedSets: 3,
      durationMins: 48,
      totalExercises: 3,
      totalReps: 34,
      totalSets: 5,
      totalVolume: 1400,
      workoutName: "Chest Day",
    })
  })

  it("picks the heaviest set, breaking ties on reps, and skips bodyweight sets", () => {
    const summary = summarizeWorkoutSession(exercises, { durationMins: 48, workoutName: "Chest Day" })

    expect(summary.topSet).toEqual({ exerciseName: "Bench Press", reps: 8, weight: 100 })
  })

  it("has no top set when nothing was loaded", () => {
    const summary = summarizeWorkoutSession(
      [exercise("Push Up", [{ completed: true, reps: 20 }])] as Workout["exercises"],
      { durationMins: 10, workoutName: "Home" },
    )

    expect(summary.topSet).toBeNull()
  })
})
