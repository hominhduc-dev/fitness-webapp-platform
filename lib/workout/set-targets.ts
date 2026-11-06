import type { ExerciseSet } from "@/lib/types"

export const DEFAULT_BACKOFF_REDUCTION = 15

export function calculateBackoffWeight(topWeight: number | undefined, weightUnit: "kg" | "lbs") {
  if (topWeight == null || !Number.isFinite(topWeight) || topWeight <= 0) return undefined

  const reducedWeight = topWeight * (100 - DEFAULT_BACKOFF_REDUCTION) / 100
  const weight = weightUnit === "kg"
    ? 5 * Math.min(Math.round(reducedWeight / 5), Math.ceil(topWeight / 5) - 1)
    : Math.round(reducedWeight * 100) / 100
  return weight > 0 ? weight : undefined
}

export function backoffWeightSuggestions(sets: readonly ExerciseSet[], weightUnit: "kg" | "lbs") {
  const weights = new Map<string, number>()
  let weight: number | undefined
  for (const set of sets) {
    if (set.intensityTag === "top_set") {
      weight = set.completed ? calculateBackoffWeight(set.weight, weightUnit) : undefined
    } else if (set.intensityTag === "back_off" && !set.completed && weight != null) {
      weights.set(set.id, weight)
    }
  }
  return weights
}
