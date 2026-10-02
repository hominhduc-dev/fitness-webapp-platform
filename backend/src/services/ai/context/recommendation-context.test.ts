import { describe, expect, it, vi } from "vitest"

// The formatter is pure; the service behind the section needs a database.
vi.mock("../../training-recommendation.service", () => ({ getTrainingRecommendationForTrainee: vi.fn() }))

import { formatRecommendationLines } from "./recommendation-context"

describe("recommendation context", () => {
  it("states the engine's numbers and tells the model not to override them", () => {
    const lines = formatRecommendationLines({
      day: { action: "reduce_volume", focusMuscles: ["upper-back"], reasons: ["readiness_low"], setAdjustmentPct: -15 },
      intensity: { phase: "intensification", targetRir: 1 },
      muscles: [{ action: "decrease", currentSets: 20, muscleSlug: "upper-back", recommendedSets: 17 }],
      workout: {
        exercises: [
          {
            action: "add_load", engineAction: "add_load", heldBy: null, muscleAction: null, muscleSlug: null, name: "Bench Press",
            reasons: [], setDelta: 0, sets: [{ previousReps: 10, previousWeight: 80, reps: 8, setNumber: 1, weight: 82.5 }],
          },
          { action: "maintain", engineAction: "add_reps", heldBy: "day", muscleAction: null, muscleSlug: null, name: "Squat", reasons: [], setDelta: 0, sets: [] },
          {
            action: "maintain", engineAction: "add_load", heldBy: "muscle", muscleAction: "decrease", muscleSlug: "upper-back", name: "Row",
            reasons: [], setDelta: -1, sets: [],
          },
        ],
        id: "w1",
        isCompleted: false,
        name: "Upper A",
      },
    })

    expect(lines[0]).toContain("KHÔNG tự đề xuất")
    expect(lines).toEqual(expect.arrayContaining([
      "- Hôm nay: giảm volume (-15% số set), cẩn thận nhóm cơ: upper-back.",
      "- Giai đoạn program: intensification, RIR mục tiêu 1.",
      "  • Bench Press: tăng tạ → 82,5kg×8.",
      "  • Squat: giữ như buổi trước (giữ lại vì readiness hôm nay).",
      "  • Row: giữ như buổi trước, -1 set (theo volume tuần của upper-back: giảm).",
      "- Volume tuần upper-back: giảm 20,0 → 17,0 set hiệu quả.",
    ]))
  })
})
