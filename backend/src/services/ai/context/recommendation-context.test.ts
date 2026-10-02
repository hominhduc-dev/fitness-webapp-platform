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
          { action: "add_load", heldByDay: false, name: "Bench Press", reasons: [], sets: [{ reps: 8, setNumber: 1, weight: 82.5 }] },
          { action: "maintain", heldByDay: true, name: "Squat", reasons: [], sets: [] },
        ],
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
      "- Volume tuần upper-back: giảm 20,0 → 17,0 set hiệu quả.",
    ]))
  })
})
