import { describe, expect, it, vi } from "vitest"

import type { AIProvider } from "../lib/ai/types"
import { classifyBatchWithRetry, isRateLimitError, parseClassificationBatch, shouldAutoApprove } from "./muscle-profile-classifier"

const id = "11111111-1111-4111-8111-111111111111"
const valid = {
  activityType: "strength" as const,
  confidence: 0.95,
  primaryMuscles: ["gluteal" as const],
  rationale: "Hip extension is the main movement.",
  secondaryMuscles: ["hamstring" as const],
  variationId: id,
}

describe("AI muscle profile classifier", () => {
  it("validates exact batch membership and confidence gate", () => {
    const [classification] = parseClassificationBatch({ classifications: [valid] }, [id])
    expect(shouldAutoApprove(classification)).toBe(true)
    expect(() => parseClassificationBatch({ classifications: [{ ...valid, variationId: "22222222-2222-4222-8222-222222222222" }] }, [id])).toThrow("unexpected")
  })

  it("retries twice and returns a validated result", async () => {
    const generateStructuredJSON = vi.fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockRejectedValueOnce(new Error("provider timeout"))
      .mockResolvedValue({ data: { classifications: [valid] }, tokenUsage: 12 })
    const provider = { generateStructuredJSON } as unknown as AIProvider
    const result = await classifyBatchWithRetry(provider, [{ variationId: id }])
    expect(generateStructuredJSON).toHaveBeenCalledTimes(3)
    expect(result.tokenUsage).toBe(12)
    expect(result.failedVariationIds).toEqual([])
  })

  it("rejects primary-secondary overlap before approval", () => {
    expect(() => parseClassificationBatch({ classifications: [{ ...valid, secondaryMuscles: ["gluteal"] }] }, [id])).toThrow()
  })

  it("recognizes provider rate-limit errors", () => {
    expect(isRateLimitError(new Error("429 status code (no body)"))).toBe(true)
    expect(isRateLimitError({ status: 429 })).toBe(true)
    expect(isRateLimitError(new Error("rate limit exceeded"))).toBe(true)
    expect(isRateLimitError(new Error("provider unavailable"))).toBe(false)
  })

  it("keeps valid rows after retries and isolates invalid rows as pending", async () => {
    const secondId = "22222222-2222-4222-8222-222222222222"
    const data = { classifications: [valid, { ...valid, primaryMuscles: ["lats"], variationId: secondId }] }
    const generateStructuredJSON = vi.fn().mockResolvedValue({ data, tokenUsage: 9 })
    const provider = { generateStructuredJSON } as unknown as AIProvider
    const result = await classifyBatchWithRetry(provider, [{ variationId: id }, { variationId: secondId }])
    expect(generateStructuredJSON).toHaveBeenCalledTimes(3)
    expect(result.classifications.map((row) => row.variationId)).toEqual([id])
    expect(result.failedVariationIds).toEqual([secondId])
  })
})
