import { describe, expect, it } from "vitest"

import { lowerLoad, nextLoad, resolveLoadIncrement } from "./load-increment"

describe("load increments", () => {
  it("reads the increment from the equipment unless the variation sets its own", () => {
    expect(resolveLoadIncrement(null, "Barbell")).toBe(2.5)
    expect(resolveLoadIncrement(null, "Smith machine")).toBe(2.5)
    expect(resolveLoadIncrement(null, "Dumbbell")).toBe(2)
    expect(resolveLoadIncrement(null, "Cable")).toBe(2.5)
    expect(resolveLoadIncrement(null, "Machine")).toBe(5)
    expect(resolveLoadIncrement(null, "Bodyweight")).toBeNull()
    expect(resolveLoadIncrement(null, null)).toBe(2.5)
    expect(resolveLoadIncrement(1, "Machine")).toBe(1)
  })

  it("steps up to the next loadable weight, at least one step", () => {
    expect(nextLoad(80, 2.5, 0.025)).toBe(82.5)
    expect(nextLoad(50, 2.5, 0.025)).toBe(52.5)
    expect(nextLoad(22, 2, 0.025)).toBe(24)
    // An off-grid starting weight moves to the grid, not past it by a full step.
    expect(nextLoad(23, 2, 0.025)).toBe(24)
    expect(nextLoad(140, 2.5, 0.05)).toBe(147.5)
  })

  it("steps down to a loadable weight below the previous one", () => {
    expect(lowerLoad(80, 2.5, 0.9)).toBe(72.5)
    expect(lowerLoad(10, 5, 0.9)).toBe(5)
    expect(lowerLoad(2, 2, 0.9)).toBe(0)
  })
})
