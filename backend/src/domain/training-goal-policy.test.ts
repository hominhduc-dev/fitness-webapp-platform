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

  it("holds only the last loading week before a deload at the goal's hardest RIR", () => {
    const weeks = Array.from({ length: 8 }, (_, week) => policyForTrainingGoal("hypertrophy", week, 8))

    expect(weeks.map((week) => week?.phase)).toEqual([
      "baseline",
      "accumulation",
      "accumulation",
      "accumulation",
      "intensification",
      "intensification",
      "overreaching",
      "deload",
    ])
    expect(weeks.filter((week) => week?.targetRir === 0)).toHaveLength(1)
  })

  it("splits a long program into blocks that each end on a deload", () => {
    const phases = Array.from({ length: 12 }, (_, week) => policyForTrainingGoal("strength", week, 12)?.phase)

    // Eleven weeks after the baseline: a five-week block, then a six-week one.
    expect(phases.flatMap((phase, week) => (phase === "deload" ? [week] : []))).toEqual([5, 11])
    expect(phases.flatMap((phase, week) => (phase === "overreaching" ? [week] : []))).toEqual([4, 10])
  })

  it("skips the deload and the overreaching week when a block is too short for one", () => {
    const phases = Array.from({ length: 4 }, (_, week) => policyForTrainingGoal("hypertrophy", week, 4)?.phase)

    expect(phases).toEqual(["baseline", "accumulation", "accumulation", "intensification"])
  })

  it("stops setting targets once the program is over", () => {
    expect(policyForTrainingGoal("hypertrophy", 7, 8)?.phase).toBe("deload")
    expect(policyForTrainingGoal("hypertrophy", 8, 8)).toBeNull()
    expect(policyForTrainingGoal("hypertrophy", 20, 8)).toBeNull()
  })
})
