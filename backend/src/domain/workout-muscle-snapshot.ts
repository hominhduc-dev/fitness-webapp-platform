import type { ExerciseActivityTypeValue, MuscleSlugValue } from "./muscle-profile"

export type SnapshotMuscleProfile = {
  activityType?: ExerciseActivityTypeValue
  primaryMuscles: MuscleSlugValue[]
  secondaryMuscles: MuscleSlugValue[]
}

export function enrichExerciseSnapshot(
  snapshot: unknown,
  profilesByVariationId: ReadonlyMap<string, SnapshotMuscleProfile>,
) {
  if (!Array.isArray(snapshot)) return { changed: false, snapshot }
  let changed = false
  const next = snapshot.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry
    const record = entry as Record<string, unknown>
    const variation = record.variation
    if (!variation || typeof variation !== "object" || Array.isArray(variation)) return entry
    const variationRecord = variation as Record<string, unknown>
    const id = typeof variationRecord.id === "string" ? variationRecord.id : null
    const profile = id ? profilesByVariationId.get(id) : undefined
    if (!profile) return entry
    const sameArray = (value: unknown, expected: readonly string[]) =>
      Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index])
    if (
      variationRecord.activityType === profile.activityType &&
      sameArray(variationRecord.primaryMuscles, profile.primaryMuscles) &&
      sameArray(variationRecord.secondaryMuscles, profile.secondaryMuscles)
    ) {
      return entry
    }
    changed = true
    return {
      ...record,
      variation: {
        ...variationRecord,
        activityType: profile.activityType,
        primaryMuscles: profile.primaryMuscles,
        secondaryMuscles: profile.secondaryMuscles,
      },
    }
  })
  return { changed, snapshot: next }
}
