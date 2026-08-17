import type { MuscleSlug } from "@/components/body/muscle-map"

/**
 * Maps `Exercise.muscleGroup` onto the regions the body artwork can colour in.
 *
 * `muscleGroup` is an unconstrained string in Prisma, and the repo currently
 * writes it from four disagreeing lists: the admin picker
 * (components/admin/admin-exercises-panel.tsx), the backend seed
 * (backend/src/services/fitness-data/core.ts), and the two AI generator forms,
 * which say Biceps/Triceps/Abs where the admin panel says Arms/Core. The XLSX
 * importer (backend/src/scripts/seed-exercise-library.ts) validates nothing at
 * all. So this table covers every spelling in use rather than one canonical set,
 * and unknown input degrades to "highlight nothing" instead of throwing.
 *
 * This is deliberately the *only* place that knowledge lives. When the schema
 * grows real primaryMuscles/secondaryMuscles columns, this function changes and
 * its callers do not.
 */

// Coarse groups map to several regions because one exercise trains several
// muscles — "Back" lights up lats, lower back and traps, not one abstract slab.
const MUSCLE_GROUP_SLUGS: Record<string, readonly MuscleSlug[]> = {
  abductors: ["gluteal"],
  abs: ["abs", "obliques"],
  adductors: ["adductors"],
  arms: ["biceps", "triceps", "forearm"],
  back: ["upper-back", "lower-back", "trapezius"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  core: ["abs", "obliques"],
  delts: ["deltoids"],
  forearms: ["forearm"],
  glutes: ["gluteal"],
  hamstrings: ["hamstring"],
  legs: ["quadriceps", "hamstring", "calves", "adductors"],
  "lower back": ["lower-back"],
  quads: ["quadriceps"],
  shoulders: ["deltoids", "trapezius"],
  traps: ["trapezius"],
  triceps: ["triceps"],
  "upper back": ["upper-back", "trapezius"],
}

// "Full Body" is spelled out rather than derived from the table above so it
// stays a deliberate list: it should read as a trained physique, which means
// skipping the incidental regions (adductors, forearms) that would otherwise
// make every full-body session look identical to a leg day.
const FULL_BODY_SLUGS: readonly MuscleSlug[] = [
  "chest",
  "upper-back",
  "lower-back",
  "trapezius",
  "deltoids",
  "biceps",
  "triceps",
  "abs",
  "obliques",
  "quadriceps",
  "hamstring",
  "gluteal",
  "calves",
]

/**
 * Resolve a stored muscle group to body-map regions.
 *
 * Returns `[]` for values the map does not know — including `Cardio`, `Other`,
 * and the free-text rows a coach or XLSX import can introduce. Production holds
 * roughly 2900 exercises, so unrecognised input is expected, not exceptional.
 */
export function muscleGroupToSlugs(muscleGroup: string | null | undefined): readonly MuscleSlug[] {
  const key = muscleGroup?.trim().toLowerCase()
  if (!key) {
    return []
  }

  if (key === "full body" || key === "fullbody" || key === "full-body") {
    return FULL_BODY_SLUGS
  }

  return MUSCLE_GROUP_SLUGS[key] ?? []
}

/** Resolve many muscle groups at once, de-duplicated. */
export function muscleGroupsToSlugs(muscleGroups: readonly (string | null | undefined)[]): readonly MuscleSlug[] {
  return [...new Set(muscleGroups.flatMap((muscleGroup) => muscleGroupToSlugs(muscleGroup)))]
}

/**
 * Build the `highlights` prop for `MuscleMap` by painting every region a set of
 * muscle groups touches in one colour.
 */
export function buildMuscleHighlights(
  muscleGroups: readonly (string | null | undefined)[],
  color: string,
): Partial<Record<MuscleSlug, string>> {
  return Object.fromEntries(muscleGroupsToSlugs(muscleGroups).map((slug) => [slug, color]))
}
