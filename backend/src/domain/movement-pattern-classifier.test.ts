import { describe, expect, it } from "vitest"

import type { AIProvider } from "../lib/ai/types"
import { classifyMovementPatterns, parseMovementPatternBatch } from "./movement-pattern-classifier"

const benchId = "00000000-0000-4000-8000-000000000001"
const rowId = "00000000-0000-4000-8000-000000000002"

describe("parseMovementPatternBatch", () => {
  it("keeps valid answers and reports the missing ones", () => {
    const result = parseMovementPatternBatch(
      { classifications: [{ exerciseId: benchId, movementPattern: "horizontal_push" }] },
      [benchId, rowId],
    )
    expect(result).toEqual({ classifications: [{ exerciseId: benchId, movementPattern: "horizontal_push" }], failedIds: [rowId] })
  })

  it("drops unknown patterns, unexpected ids and duplicates", () => {
    const result = parseMovementPatternBatch(
      {
        classifications: [
          { exerciseId: benchId, movementPattern: "push" },
          { exerciseId: "00000000-0000-4000-8000-000000000009", movementPattern: "hinge" },
          { exerciseId: rowId, movementPattern: "horizontal_pull" },
          { exerciseId: rowId, movementPattern: "vertical_pull" },
        ],
      },
      [benchId, rowId],
    )
    expect(result.classifications).toEqual([{ exerciseId: rowId, movementPattern: "horizontal_pull" }])
    expect(result.failedIds).toEqual([benchId])
  })
})

describe("classifyMovementPatterns", () => {
  it("sends no request for an empty batch", async () => {
    const provider = {
      async generateStructuredJSON() {
        throw new Error("should not be called")
      },
    } as unknown as AIProvider
    await expect(classifyMovementPatterns(provider, [])).resolves.toMatchObject({ classifications: [], tokenUsage: 0 })
  })

  it("sends exercises as data and returns the parsed batch", async () => {
    let prompt = ""
    const provider = {
      async generateStructuredJSON({ userPrompt }: { userPrompt: string }) {
        prompt = userPrompt
        return { data: { classifications: [{ exerciseId: benchId, movementPattern: "horizontal_push" }] }, tokenUsage: 42 }
      },
    } as unknown as AIProvider
    const result = await classifyMovementPatterns(provider, [
      { activityType: "strength", equipment: ["Barbell"], exerciseId: benchId, muscleGroup: "Chest", name: "Bench Press", primaryMuscles: ["chest"] },
    ])

    expect(JSON.parse(prompt).exercises[0].name).toBe("Bench Press")
    expect(result).toMatchObject({ failedIds: [], tokenUsage: 42 })
  })
})
