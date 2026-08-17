import { z } from "zod"

import type { AIProvider } from "../lib/ai/types"
import { AppError } from "../services/errors"
import { EXERCISE_ACTIVITY_TYPES, MUSCLE_SLUGS, muscleProfileInputSchema } from "./muscle-profile"

const classificationSchema = muscleProfileInputSchema.safeExtend({
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(1_000),
  variationId: z.string().uuid(),
})

const classificationBatchSchema = z.object({
  classifications: z.array(classificationSchema).min(1).max(25),
})

export type MuscleClassification = z.infer<typeof classificationSchema>

type PartialClassificationResult = {
  classifications: MuscleClassification[]
  failedVariationIds: string[]
}

export function parseClassificationBatch(value: unknown, expectedVariationIds: readonly string[]) {
  const parsed = classificationBatchSchema.parse(value)
  const expected = new Set(expectedVariationIds)
  const received = new Set<string>()

  for (const classification of parsed.classifications) {
    if (!expected.has(classification.variationId)) {
      throw new AppError(`AI returned unexpected variationId ${classification.variationId}.`, { code: "INVALID_AI_MUSCLE_PROFILE", status: 422 })
    }
    if (received.has(classification.variationId)) {
      throw new AppError(`AI returned duplicate variationId ${classification.variationId}.`, { code: "INVALID_AI_MUSCLE_PROFILE", status: 422 })
    }
    received.add(classification.variationId)
  }

  const missing = expectedVariationIds.filter((id) => !received.has(id))
  if (missing.length) {
    throw new AppError(`AI omitted ${missing.length} variation(s): ${missing.join(", ")}.`, { code: "INVALID_AI_MUSCLE_PROFILE", status: 422 })
  }

  return parsed.classifications
}

export function parseMuscleClassification(value: unknown) {
  return classificationSchema.parse(value)
}

export function shouldAutoApprove(classification: MuscleClassification) {
  return classification.confidence >= 0.9
}

export function isRateLimitError(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && error.status === 429) return true
  const message = error instanceof Error ? error.message : String(error)
  return /(^|\D)429(\D|$)|rate[ -]?limit/i.test(message)
}

function parsePartialClassificationBatch(value: unknown, expectedVariationIds: readonly string[]): PartialClassificationResult {
  const outer = z.object({ classifications: z.array(z.unknown()) }).parse(value)
  const expected = new Set(expectedVariationIds)
  const classifications: MuscleClassification[] = []
  const seen = new Set<string>()

  for (const candidate of outer.classifications) {
    const result = classificationSchema.safeParse(candidate)
    if (!result.success || !expected.has(result.data.variationId) || seen.has(result.data.variationId)) continue
    classifications.push(result.data)
    seen.add(result.data.variationId)
  }

  return {
    classifications,
    failedVariationIds: expectedVariationIds.filter((id) => !seen.has(id)),
  }
}

export async function classifyBatchWithRetry(
  provider: AIProvider,
  rows: readonly Record<string, unknown>[],
  maxRetries = 2,
) {
  const expectedIds = rows.map((row) => String(row.variationId))
  let lastError: unknown
  let lastResponseData: unknown
  let tokenUsage = 0

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await provider.generateStructuredJSON<unknown>({
        maxTokens: 8_000,
        systemPrompt: [
          "You classify exercise variations for a production fitness catalog.",
          `activityType must be one of: ${EXERCISE_ACTIVITY_TYPES.join(", ")}.`,
          `Muscles must use only these artwork slugs: ${MUSCLE_SLUGS.join(", ")}.`,
          "Return every input variation exactly once and preserve variationId.",
          "Order primaryMuscles by importance. position 0 is the main focus.",
          "Strength requires at least one primary muscle. Primary and secondary must not overlap.",
          "Cardio and mobility may still have muscle targets. Never infer a generic target for Other.",
          "Never output anatomical names outside the provided slugs (for example lats, hip-flexors, rotator-cuff, erector-spinae). Map to the closest allowed slug or omit that secondary target.",
          "Use confidence >= 0.90 only when the anatomy and activity classification are unambiguous.",
          "Return JSON: { classifications: [{ variationId, activityType, primaryMuscles, secondaryMuscles, confidence, rationale }] }.",
        ].join("\n"),
        userPrompt: JSON.stringify({ variations: rows }),
      })
      lastResponseData = response.data
      tokenUsage += response.tokenUsage
      return {
        classifications: parseClassificationBatch(response.data, expectedIds),
        failedVariationIds: [] as string[],
        tokenUsage,
      }
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const retryDelayMs = isRateLimitError(error) ? 60_000 * (attempt + 1) : 1_000 * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  if (lastResponseData !== undefined) {
    const partial = parsePartialClassificationBatch(lastResponseData, expectedIds)
    if (partial.classifications.length) {
      return { ...partial, tokenUsage }
    }
  }

  throw lastError
}
