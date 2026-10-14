import { z } from "zod"

import type { AIProvider } from "../lib/ai/types"
import { AppError } from "../services/errors"
import { MOVEMENT_PATTERN_GUIDE, movementPatternSchema } from "./movement-pattern"

/** What the model sees per exercise: enough to tell a row from a curl, no ids it could echo wrongly. */
type MovementPatternInputRow = {
  exerciseId: string
  name: string
  muscleGroup: string
  activityType: string | null
  equipment: string[]
  primaryMuscles: string[]
}

const classificationSchema = z.object({
  exerciseId: z.string().uuid(),
  movementPattern: movementPatternSchema,
})

const batchSchema = z.object({ classifications: z.array(z.unknown()) })

type MovementPatternClassification = z.infer<typeof classificationSchema>

const SYSTEM_PROMPT = [
  "You classify exercises for a production fitness catalog by movement pattern, independent of equipment.",
  "Pick exactly one movementPattern per exercise:",
  MOVEMENT_PATTERN_GUIDE,
  "Multi-joint lifts take the pattern of their main joint action; use isolation only for single-joint work.",
  "activityType cardio means movementPattern cardio; activityType mobility means mobility.",
  "Return every input exercise exactly once and preserve exerciseId.",
  'Return JSON: { "classifications": [{ "exerciseId": string, "movementPattern": string }] }.',
].join("\n")

/**
 * Keeps every valid answer for an expected id and reports the rest as failed,
 * so one bad row does not throw away a whole batch of paid tokens.
 */
function parseMovementPatternBatch(value: unknown, expectedIds: readonly string[]) {
  const expected = new Set(expectedIds)
  const seen = new Set<string>()
  const classifications: MovementPatternClassification[] = []

  for (const candidate of batchSchema.parse(value).classifications) {
    const result = classificationSchema.safeParse(candidate)
    if (!result.success || !expected.has(result.data.exerciseId) || seen.has(result.data.exerciseId)) continue
    seen.add(result.data.exerciseId)
    classifications.push(result.data)
  }

  return { classifications, failedIds: expectedIds.filter((id) => !seen.has(id)) }
}

async function classifyMovementPatterns(provider: AIProvider, rows: readonly MovementPatternInputRow[]) {
  if (rows.length === 0) return { classifications: [], failedIds: [] as string[], tokenUsage: 0 }
  if (rows.length > 50) {
    throw new AppError("A movement pattern batch holds at most 50 exercises.", { status: 400 })
  }

  const response = await provider.generateStructuredJSON<unknown>({
    maxTokens: 4_000,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: JSON.stringify({ exercises: rows }),
  })
  return { ...parseMovementPatternBatch(response.data, rows.map((row) => row.exerciseId)), tokenUsage: response.tokenUsage }
}

export {
  classifyMovementPatterns,
  parseMovementPatternBatch,
  type MovementPatternClassification,
  type MovementPatternInputRow,
}
