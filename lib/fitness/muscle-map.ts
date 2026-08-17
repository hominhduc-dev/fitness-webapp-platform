import type { MuscleSlug } from "@/components/body/muscle-map"
import type { Workout, WorkoutLog } from "@/lib/types"

/**
 * Maps `Exercise.muscleGroup` onto the regions the body artwork can colour in.
 *
 * `muscleGroup` is the legacy, unconstrained classification kept during the
 * additive muscle-profile rollout. Production currently contains nine clean
 * values, but import paths can still introduce an unknown string. Unknown input
 * therefore degrades to "highlight nothing" instead of throwing.
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
  legs: ["quadriceps", "hamstring", "gluteal", "calves", "adductors"],
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
 * Anatomical legacy groups that can be resolved from a body region.
 * The table above also carries fine-grained spellings (Biceps, Quads, Traps)
 * because stored data uses them, but those are not groups a user can pick, so
 * they are not candidates when resolving a region back to a group.
 *
 * Order is the tie-break rule, and both ties are deliberate:
 *   - `trapezius` belongs to Back and Shoulders; Back wins because Shoulders is
 *     defined by the deltoids, which map to Shoulders unambiguously.
 *   - `calves` belongs to Calves and Legs; the narrower group wins, otherwise
 *     the dedicated Calves filter could never be reached from the artwork.
 */
const CANONICAL_MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Glutes", "Calves", "Legs"] as const

// Derived rather than hand-written so it cannot drift from MUSCLE_GROUP_SLUGS.
// `Map` keeps the last value written for a repeated key, so the pairs are
// reversed to make the *first* group in the priority order above the winner.
const SLUG_TO_CANONICAL_GROUP: ReadonlyMap<MuscleSlug, string> = new Map(
  CANONICAL_MUSCLE_GROUPS.flatMap((group) =>
    muscleGroupToSlugs(group).map((slug) => [slug, group] as const),
  ).reverse(),
)

/**
 * Resolve a body region back to the group a user can pick — the inverse of
 * `muscleGroupToSlugs`, narrowed to the canonical list.
 *
 * Returns `null` for regions no group claims. `tibialis` is the live example:
 * the artwork draws the shin, but no entry in the table above targets it, so
 * clicking it resolves to nothing rather than being forced into Legs.
 */
export function muscleGroupFromSlug(slug: MuscleSlug): string | null {
  return SLUG_TO_CANONICAL_GROUP.get(slug) ?? null
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

export type ExerciseActivityType = "strength" | "cardio" | "mobility" | "sport" | "other"
export type MuscleProfileStatus = "approved" | "pending"

export interface MuscleProfileLike {
  activityType?: ExerciseActivityType
  muscleGroup?: string | null
  muscleProfileStatus?: MuscleProfileStatus
  primaryMuscles?: readonly MuscleSlug[]
  secondaryMuscles?: readonly MuscleSlug[]
}

export interface ResolvedMuscleProfile {
  activityType?: ExerciseActivityType
  primaryMuscles: readonly MuscleSlug[]
  secondaryMuscles: readonly MuscleSlug[]
  usesLegacyFallback: boolean
}

/**
 * Prefer an approved variation-level profile. Pending and historical records
 * deliberately fall back to the coarse group until rollout coverage reaches 100%.
 */
export function resolveMuscleProfile(profile: MuscleProfileLike): ResolvedMuscleProfile {
  const hasExplicitTargets = (profile.primaryMuscles?.length ?? 0) + (profile.secondaryMuscles?.length ?? 0) > 0
  if (profile.muscleProfileStatus === "approved" || (profile.muscleProfileStatus === undefined && hasExplicitTargets)) {
    return {
      activityType: profile.activityType,
      primaryMuscles: [...new Set(profile.primaryMuscles ?? [])],
      secondaryMuscles: [...new Set(profile.secondaryMuscles ?? [])].filter(
        (slug) => !profile.primaryMuscles?.includes(slug),
      ),
      usesLegacyFallback: false,
    }
  }

  return {
    activityType: profile.activityType,
    primaryMuscles: muscleGroupToSlugs(profile.muscleGroup),
    secondaryMuscles: [],
    usesLegacyFallback: true,
  }
}

/** Build a two-tier body-map fill; a primary hit always wins over secondary. */
export function buildMuscleProfileHighlights(
  profiles: readonly MuscleProfileLike[],
  primaryColor: string,
  secondaryColor: string,
): Partial<Record<MuscleSlug, string>> {
  const primary = new Set<MuscleSlug>()
  const secondary = new Set<MuscleSlug>()

  for (const profile of profiles) {
    const resolved = resolveMuscleProfile(profile)
    resolved.secondaryMuscles.forEach((slug) => secondary.add(slug))
    resolved.primaryMuscles.forEach((slug) => primary.add(slug))
  }

  primary.forEach((slug) => secondary.delete(slug))

  return Object.fromEntries([
    ...[...secondary].map((slug) => [slug, secondaryColor] as const),
    ...[...primary].map((slug) => [slug, primaryColor] as const),
  ])
}

export function muscleProfilesFromWorkout(workout: Workout): MuscleProfileLike[] {
  return workout.exercises.map((entry) => ({
    ...entry.variation,
    muscleGroup: entry.exercise.muscleGroup,
  }))
}

export function muscleProfilesFromLogs(logs: readonly WorkoutLog[]): MuscleProfileLike[] {
  return logs.flatMap((log) =>
    log.exercises.map((entry) => ({
      ...entry.variation,
      muscleGroup: entry.exercise.muscleGroup,
    })),
  )
}

/** Distinct muscle groups a planned workout targets. */
export function muscleGroupsFromWorkout(workout: Workout): string[] {
  return dedupeGroups(workout.exercises.map((exercise) => exercise.exercise.muscleGroup))
}

/** Distinct muscle groups a set of completed sessions touched. */
export function muscleGroupsFromLogs(logs: readonly WorkoutLog[]): string[] {
  return dedupeGroups(logs.flatMap((log) => log.exercises.map((exercise) => exercise.exercise.muscleGroup)))
}

function dedupeGroups(muscleGroups: readonly (string | null | undefined)[]): string[] {
  return [...new Set(muscleGroups.map((group) => group?.trim()).filter((group): group is string => Boolean(group)))]
}
