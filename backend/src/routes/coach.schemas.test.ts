import { describe, expect, it } from "vitest"

import { coachTraineeInsightBodySchema, coachTraineeInsightQuerySchema, programImageImportSchema } from "./coach.schemas"

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

describe("programImageImportSchema", () => {
  const image = { data: "A".repeat(200), mediaType: "image/jpeg" as const }

  it("takes one to three JPG, PNG or WebP images", () => {
    expect(programImageImportSchema.parse({ images: [image], locale: "vi" }).images).toHaveLength(1)
    expect(programImageImportSchema.safeParse({ images: [] }).success).toBe(false)
    expect(programImageImportSchema.safeParse({ images: [image, image, image, image] }).success).toBe(false)
    expect(programImageImportSchema.safeParse({ images: [{ ...image, mediaType: "image/gif" }] }).success).toBe(false)
  })

  it("rejects data that is not plain base64 or too large", () => {
    expect(programImageImportSchema.safeParse({ images: [{ ...image, data: `data:image/jpeg;base64,${image.data}` }] }).success).toBe(false)
    expect(programImageImportSchema.safeParse({ images: [{ ...image, data: "A".repeat(1_500_001) }] }).success).toBe(false)
  })
})
