/**
 * Shared cache for read-heavy reference data (exercise + food libraries).
 *
 * These datasets are large (≈1,900 exercise variations) but change rarely, while
 * every coach/trainee page reads them — making them costly across a cross-region
 * DB link yet very cache-friendly.
 *
 * Consistency model:
 *  - Exercise library: invalidated explicitly on the frequent coach write paths
 *    (create/update/delete). Rare admin edits are NOT explicitly invalidated and
 *    instead fall off via the short TTL — so staleness is bounded to EXERCISE_LIBRARY_TTL_MS.
 *  - System food catalog: written only by the offline seed script, never at
 *    runtime, so a pure TTL with no invalidation is always correct.
 */
import { TtlCache } from "./cache"

export const libraryCache = new TtlCache()

export const EXERCISE_LIBRARY_TTL_MS = 60_000
export const FOOD_CATALOG_TTL_MS = 5 * 60_000

export const CACHE_KEYS = {
  exerciseDefaultsSeeded: "exercise:defaults-seeded",
  exerciseLibrary: "exercise:library",
  exerciseVariations: "exercise:variations",
  systemFoods: "food:system-catalog",
} as const

/** Drop every cached exercise dataset. Call after any exercise/variation write. */
export function invalidateExerciseLibrary() {
  libraryCache.delete(CACHE_KEYS.exerciseLibrary)
  libraryCache.delete(CACHE_KEYS.exerciseVariations)
}
