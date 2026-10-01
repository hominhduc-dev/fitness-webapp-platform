import { describe, expect, it } from "vitest"

import { normalizeTrainingGoal, policyForTrainingGoal } from "./training-goal-policy"

describe("training goal policy", () => {
  it("normalizes legacy and localized goal names", () => {
    expect(normalizeTrainingGoal("build_muscle")).toBe("hypertrophy")
    expect(normalizeTrainingGoal("lose-weight")).toBe("fat_loss")
    expect(normalizeTrainingGoal("tăng sức mạnh")).toBe("strength")
    expect(normalizeTrainingGoal("phục hồi")).toBe("rehab_corrective")
  })

  it("uses week one as baseline and deloads the last week of a long hypertrophy cycle", () => {
    expect(policyForTrainingGoal("hypertrophy", 0, 5)).toMatchObject({
      baselineWeek: true,
      phase: "baseline",
      targetRir: 4,
      targetRpe: 6,
    })
    expect(policyForTrainingGoal("hypertrophy", 4, 5)).toMatchObject({
      baselineWeek: false,
      phase: "deload",
      targetRir: 5,
      targetRpe: 5,
    })
  })

  it("specializes target intensity by goal", () => {
    expect(policyForTrainingGoal("strength", 2, 5)).toMatchObject({
      analysisFocus: expect.arrayContaining(["e1rm_trend", "top_sets"]),
      phase: "intensification",
      targetRir: 2,
    })
    expect(policyForTrainingGoal("fat_loss", 2, 5)).toMatchObject({
      analysisFocus: expect.arrayContaining(["strength_retention", "nutrition_adherence"]),
      targetRir: 2,
    })
    expect(policyForTrainingGoal("rehab_corrective", 2, 5)).toMatchObject({
      analysisFocus: expect.arrayContaining(["pain_response", "high_rir_compliance"]),
      targetRir: 4,
    })
  })
})
