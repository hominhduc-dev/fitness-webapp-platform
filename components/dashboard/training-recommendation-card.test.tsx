import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getMessages } from "@/lib/i18n/messages"
import type { TrainingRecommendation } from "@/lib/fitness/types"

import { TrainingRecommendationCard } from "./training-recommendation-card"

const state = vi.hoisted(() => ({ data: undefined as unknown, isPending: false }))

vi.mock("@/lib/queries/progress", () => ({
  useTrainingRecommendation: () => ({ data: state.data, isPending: state.isPending }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ messages: getMessages("vi") }),
}))

const recommendation: TrainingRecommendation = {
  day: { action: "proceed", focusMuscles: [], reasons: ["readiness_good"], setAdjustmentPct: 0 },
  intensity: { phase: "accumulation", targetRir: 2 },
  muscles: [{ action: "decrease", currentSets: 18, muscleSlug: "chest", recommendedSets: 15.5 }],
  workout: {
    exercises: [
      {
        action: "maintain", engineAction: "add_load", heldBy: "muscle", muscleAction: "decrease", muscleSlug: "chest",
        name: "Bench Press", reasons: ["top_of_range_reached", "muscle_decrease"], setDelta: -1,
        sets: [{ previousReps: 10, previousWeight: 80, reps: 10, setNumber: 1, weight: 80 }],
      },
      {
        action: "add_load", engineAction: "add_load", heldBy: null, muscleAction: null, muscleSlug: null,
        name: "Squat", reasons: ["top_of_range_reached"], setDelta: 0,
        sets: [{ previousReps: 8, previousWeight: 100, reps: 6, setNumber: 1, weight: 105 }],
      },
    ],
    id: "workout-1",
    isCompleted: false,
    name: "Upper A",
  },
}

afterEach(cleanup)

describe("TrainingRecommendationCard", () => {
  it("shows the reconciled plan: held bench with a dropped set, squat pushed, chest volume down", () => {
    state.data = recommendation
    render(<TrainingRecommendationCard />)

    expect(screen.getByText("Tập theo kế hoạch")).toBeInTheDocument()
    expect(screen.getByText("Tích lũy · RIR 2")).toBeInTheDocument()
    expect(screen.getByText("Giữ nguyên · theo volume ngực")).toBeInTheDocument()
    expect(screen.getByText("80×10")).toBeInTheDocument()
    expect(screen.getByText("-1 set")).toBeInTheDocument()
    expect(screen.getByText("105×6")).toBeInTheDocument()
    expect(screen.getByText(/Ngực Giảm 18→15.5/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Bắt đầu/ })).toHaveAttribute("href", "/workout/workout-1/start")
  })

  it("says so when no session is scheduled", () => {
    state.data = { ...recommendation, muscles: [], workout: null }
    render(<TrainingRecommendationCard />)

    expect(screen.getByText("Hôm nay không có buổi tập theo lịch.")).toBeInTheDocument()
  })
})
