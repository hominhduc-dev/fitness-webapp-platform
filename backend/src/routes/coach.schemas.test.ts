import { describe, expect, it } from "vitest"

import { coachTraineeInsightBodySchema, coachTraineeInsightQuerySchema } from "./coach.schemas"

describe("coach trainee insight schemas", () => {
  it("defaults to 14 days and reads the window from a query string", () => {
    expect(coachTraineeInsightQuerySchema.parse({})).toEqual({ days: 14 })
    expect(coachTraineeInsightQuerySchema.parse({ days: "28", locale: "vi" })).toEqual({ days: 28, locale: "vi" })
    expect(coachTraineeInsightBodySchema.parse({ days: 7, locale: "en" })).toEqual({ days: 7, locale: "en" })
  })

  it("rejects any other window", () => {
    expect(coachTraineeInsightQuerySchema.safeParse({ days: "30" }).success).toBe(false)
    expect(coachTraineeInsightBodySchema.safeParse({ days: 0 }).success).toBe(false)
    expect(coachTraineeInsightBodySchema.safeParse({ days: 14, locale: "fr" }).success).toBe(false)
  })
})
