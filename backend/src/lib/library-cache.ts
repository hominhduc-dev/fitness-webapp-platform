/**
 * Shared cache for read-heavy reference data (exercise + food libraries).
 *
 * These datasets are large (≈1,900 exercise variations) but change rarely, while
 * every coach/trainee page reads them — making them costly across a cross-region
 * DB link yet very cache-friendly.
 *
 * Consistency model:
 *  - Exercise library: invalidated explicitly on coach write paths, and after
 *    every successful admin write (a middleware on the admin router). Scripts run
 *    in their own process and cannot reach this cache, so a dataset sync shows
 *    up within EXERCISE_LIBRARY_TTL_MS.
 *  - System food catalog: invalidated when an admin promotes a custom food.
 */
import { TtlCache } from "./cache"

export const libraryCache = new TtlCache()

/**
 * Every reload reads the whole variation catalogue from the database, and
 * database egress is billed, so this is minutes rather than seconds. Writes
 * invalidate it (see above), so the length only bounds script-driven changes.
 */
export const EXERCISE_LIBRARY_TTL_MS = 15 * 60_000
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

/** Drop the shared food catalog after a custom food becomes system-visible. */
export function invalidateSystemFoodCatalog() {
  libraryCache.delete(CACHE_KEYS.systemFoods)
}
