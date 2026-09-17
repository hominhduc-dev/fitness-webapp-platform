import type { ExerciseActivityType, MuscleSlug } from "@/lib/types"

export const EXERCISE_ACTIVITY_TYPES = ["strength", "cardio", "mobility", "sport", "other"] as const satisfies readonly ExerciseActivityType[]

export const MUSCLE_SLUGS = [
  "abs", "adductors", "biceps", "calves", "chest", "deltoids", "forearm", "gluteal",
  "hamstring", "lower-back", "obliques", "quadriceps", "tibialis", "trapezius", "triceps", "upper-back",
] as const satisfies readonly MuscleSlug[]

const ACTIVITY_TYPE_SET = new Set<string>(EXERCISE_ACTIVITY_TYPES)
const MUSCLE_SLUG_SET = new Set<string>(MUSCLE_SLUGS)

function normalizeMuscleSlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-")
}

export function parseActivityType(value: unknown): ExerciseActivityType | null {
  const normalized = String(value ?? "").trim().toLowerCase()
  return ACTIVITY_TYPE_SET.has(normalized) ? (normalized as ExerciseActivityType) : null
}

export function parseMuscleSlugs(value: unknown): { invalid: string[]; muscles: MuscleSlug[] } {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",")
  const normalized = values.map(normalizeMuscleSlug).filter(Boolean)
  return {
    invalid: [...new Set(normalized.filter((slug) => !MUSCLE_SLUG_SET.has(slug)))],
    muscles: [...new Set(normalized.filter((slug) => MUSCLE_SLUG_SET.has(slug)))] as MuscleSlug[],
  }
}
