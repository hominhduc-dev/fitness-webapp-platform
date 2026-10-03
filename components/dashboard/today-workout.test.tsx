import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getMessages } from "@/lib/i18n/messages"
import type { TrainingRecommendation } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"

import { TodayWorkout } from "./today-workout"

const state = vi.hoisted(() => ({ recommendation: undefined as unknown }))

vi.mock("@/lib/queries/progress", () => ({
  useTrainingRecommendation: () => ({ data: state.recommendation, isPending: false }),
}))
vi.mock("@/lib/workout/use-active-workout-sessions", () => ({
  useActiveWorkoutSessionList: () => ({ sessions: [] }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ messages: getMessages("vi") }),
}))

function exercise(id: string, name: string, sets = 3) {
  return {
    exercise: { id: `e-${id}`, muscleGroup: "chest", name },
    id,
    sets: Array.from({ length: sets }, (_, index) => ({ completed: false, id: `${id}-${index}`, setNumber: index + 1, targetReps: 10, targetRepsMin: 8 })),
    variation: { displayName: name, id: `v-${id}`, isDefault: true, name: "Default" },
  }
}

const workout = {
  exercises: [exercise("we-bench", "Bench Press"), exercise("we-fly", "Cable Fly")],
  id: "workout-1",
  name: "Upper A",
} as unknown as Workout

const recommendation: TrainingRecommendation = {
  day: { action: "proceed", focusMuscles: [], reasons: [], setAdjustmentPct: 0 },
  intensity: { phase: "accumulation", targetRir: 2 },
  muscles: [{ action: "decrease", currentSets: 18, muscleSlug: "chest", recommendedSets: 15.5 }],
  workout: {
    exercises: [{
      action: "maintain", engineAction: "add_load", heldBy: "muscle", muscleAction: "decrease", muscleSlug: "chest",
      name: "Bench Press", reasons: ["top_of_range_reached", "muscle_decrease"], setDelta: -1,
      sets: [{ previousReps: 10, previousWeight: 80, reps: 10, setNumber: 1, weight: 80 }],
      workoutExerciseId: "we-bench",
    }],
    id: "workout-1",
    isCompleted: false,
    name: "Upper A",
  },
}

afterEach(cleanup)

describe("TodayWorkout", () => {
  it("shows the coach's plan with today's adjustments folded in", () => {
    state.recommendation = recommendation
    render(<TodayWorkout workout={workout} />)

    expect(screen.getByText("Tập theo kế hoạch")).toBeInTheDocument()
    expect(screen.getByText("Tích lũy · RIR 2")).toBeInTheDocument()
    // Bench carries the reconciled target, set change and why.
    expect(screen.getByText("80×10")).toBeInTheDocument()
    expect(screen.getByText("-1 set")).toBeInTheDocument()
    expect(screen.getByText("Giữ nguyên · theo volume ngực")).toBeInTheDocument()
    // An exercise without an adjustment keeps the programmed sets × reps.
    expect(screen.getByText("3×8-10")).toBeInTheDocument()
  })

  it("keeps the programmed plan when the recommendation is for another workout", () => {
    state.recommendation = { ...recommendation, workout: { ...recommendation.workout!, id: "other" } }
    render(<TodayWorkout workout={workout} />)

    expect(screen.queryByText("80×10")).not.toBeInTheDocument()
    expect(screen.getAllByText("3×8-10")).toHaveLength(2)
  })
})
