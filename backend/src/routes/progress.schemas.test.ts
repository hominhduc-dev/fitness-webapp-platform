import { describe, expect, it } from "vitest"

import { recoveryCheckInSchema } from "./progress.schemas"

const base = {
  checkInDate: "2026-10-01",
  fatigue: 3,
  muscles: [],
}

describe("recoveryCheckInSchema stress", () => {
  it("accepts the full 1-99 stress range", () => {
    expect(recoveryCheckInSchema.safeParse({ ...base, stress: 1 }).success).toBe(true)
    expect(recoveryCheckInSchema.safeParse({ ...base, stress: 50 }).success).toBe(true)
    expect(recoveryCheckInSchema.safeParse({ ...base, stress: 99 }).success).toBe(true)
  })

  it("rejects stress outside 1-99", () => {
    expect(recoveryCheckInSchema.safeParse({ ...base, stress: 0 }).success).toBe(false)
    expect(recoveryCheckInSchema.safeParse({ ...base, stress: 100 }).success).toBe(false)
  })
})
