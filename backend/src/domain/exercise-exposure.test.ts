import { describe, expect, it } from "vitest"

import { isComparablePrescription, prescriptionFromSets, prescriptionMismatch } from "./exercise-exposure"

const prescription = (overrides: Partial<Parameters<typeof isComparablePrescription>[0]> = {}) => ({
  repMax: 10,
  repMin: 8,
  targetRir: 2,
  tempo: null,
  ...overrides,
})

describe("comparing two prescriptions", () => {
  it("compares sessions that asked for the same thing", () => {
    expect(isComparablePrescription(prescription(), prescription())).toBe(true)
    expect(prescriptionMismatch(prescription(), prescription())).toBeUndefined()
  })

  it("names the dimension that moved", () => {
    expect(prescriptionMismatch(prescription(), prescription({ repMax: 20, repMin: 15 }))).toBe("reps")
    expect(prescriptionMismatch(prescription(), prescription({ targetRir: 0 }))).toBe("rir")
  })

  it("treats a slower cadence as a different set, not as progress", () => {
    // 10 reps at 4-1-1-0 is 60s under tension against 30s at 2-0-1-0. Reading
    // the second as a flat comparison would add load to the harder set.
    const fast = prescription({ tempo: "2-0-1-0" })
    const slow = prescription({ tempo: "4-1-1-0" })

    expect(prescriptionMismatch(fast, slow)).toBe("tempo")
    expect(isComparablePrescription(fast, slow)).toBe(false)
  })

  it("lets a cadence drift by a second without losing the baseline", () => {
    expect(isComparablePrescription(prescription({ tempo: "3-0-1-0" }), prescription({ tempo: "4-0-1-0" }))).toBe(true)
    expect(isComparablePrescription(prescription({ tempo: "3-0-1-0" }), prescription({ tempo: "3-0-X-0" }))).toBe(true)
  })

  it("treats prescribing a cadence where there was none as a change", () => {
    // An untempoed set was done at whatever pace the trainee chose, so this is
    // a new prescription rather than a gap in what the old log recorded.
    expect(prescriptionMismatch(prescription({ tempo: null }), prescription({ tempo: "4-1-1-0" }))).toBe("tempo")
    expect(prescriptionMismatch(prescription({ tempo: "4-1-1-0" }), prescription({ tempo: null }))).toBe("tempo")
    // Neither side prescribing one is the ordinary case and must stay comparable.
    expect(isComparablePrescription(prescription(), prescription())).toBe(true)
  })

  it("still forgives an unknown rep target or effort", () => {
    expect(isComparablePrescription(prescription({ targetRir: null }), prescription({ targetRir: 0 }))).toBe(true)
    expect(isComparablePrescription(prescription({ repMax: null, repMin: null }), prescription())).toBe(true)
  })
})

describe("prescriptionFromSets", () => {
  it("reads the first working set, carrying its cadence", () => {
    expect(prescriptionFromSets([
      { intensityTag: "warmup", targetReps: 20, tempo: "2-0-1-0" },
      { targetReps: 10, targetRepsMin: 8, targetRir: 2, tempo: "3-1-1-0" },
    ])).toEqual({ repMax: 10, repMin: 8, targetRir: 2, tempo: "3-1-1-0" })
  })

  it("reports no cadence when the set carries none", () => {
    expect(prescriptionFromSets([{ targetReps: 10 }]).tempo).toBeNull()
  })
})
