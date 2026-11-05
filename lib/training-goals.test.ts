import { describe, expect, it } from "vitest"

import { TRAINING_GOAL_OPTIONS, normalizeTrainingGoal } from "./training-goals"

describe("normalizeTrainingGoal", () => {
  it("reads a cutting block as fat loss, in either language", () => {
    for (const goal of ["cutting", "Cutting", "cut", "mini cut", "Mini-Cut", "cắt mỡ", "cat mo"]) {
      expect(normalizeTrainingGoal(goal)).toBe("fat_loss")
    }
  })

  it("still reads the goals it always has", () => {
    expect(normalizeTrainingGoal("build_muscle")).toBe("hypertrophy")
    expect(normalizeTrainingGoal("lose-weight")).toBe("fat_loss")
    expect(normalizeTrainingGoal("giảm mỡ")).toBe("fat_loss")
    expect(normalizeTrainingGoal("phục hồi")).toBe("rehab_corrective")
    expect(normalizeTrainingGoal("không phải goal")).toBeNull()
    expect(normalizeTrainingGoal(null)).toBeNull()
  })

  it("offers every option under a value it can read back", () => {
    // A picker that writes a value the normalizer drops would silently store no
    // goal at all, which is how a cutting program ends up on hypertrophy targets.
    for (const option of TRAINING_GOAL_OPTIONS) {
      expect(normalizeTrainingGoal(option.value)).toBe(option.value)
    }
    expect(new Set(TRAINING_GOAL_OPTIONS.map((option) => option.value)).size).toBe(TRAINING_GOAL_OPTIONS.length)
  })
})
