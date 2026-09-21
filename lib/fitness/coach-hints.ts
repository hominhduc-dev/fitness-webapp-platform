import { resolveMuscleProfile, type MuscleProfileLike } from "@/lib/fitness/muscle-map"
import type { VolumeRecommendationAction, VolumeRecoveryData } from "@/lib/fitness/types"

export type CoachHint = {
  action: VolumeRecommendationAction
  currentSets: number
  muscleSlug: string
  recommendedSets: number
}

/**
 * Recommendations the trainee said yes to but has not carried out yet. A
 * pending one belongs on the dashboard card where it can still be answered;
 * an applied one is done and stops following the trainee around.
 */
export function acceptedCoachHints(data: VolumeRecoveryData | undefined): CoachHint[] {
  if (!data) return []

  return data.muscles
    .filter((muscle) => muscle.recommendation.status === "accepted")
    .map((muscle) => ({
      action: muscle.recommendation.action,
      currentSets: muscle.recommendation.currentSets,
      muscleSlug: muscle.muscleSlug,
      recommendedSets: muscle.recommendation.recommendedSets,
    }))
}

/**
 * Primary targets only: "add trapezius volume" should land on a shrug, not on
 * every press that happens to involve traps.
 */
function trainsMuscle(profile: MuscleProfileLike, muscleSlug: string) {
  const primaryMuscles: readonly string[] = resolveMuscleProfile(profile).primaryMuscles
  return primaryMuscles.includes(muscleSlug)
}

/** The hint that belongs on one exercise, or null. */
export function coachHintForExercise(
  hints: readonly CoachHint[],
  profile: MuscleProfileLike,
): CoachHint | null {
  return hints.find((hint) => trainsMuscle(profile, hint.muscleSlug)) ?? null
}

/** The first hint any of these exercises would carry, for a whole-session summary. */
export function coachHintForProfiles(
  hints: readonly CoachHint[],
  profiles: readonly MuscleProfileLike[],
): CoachHint | null {
  return hints.find((hint) => profiles.some((profile) => trainsMuscle(profile, hint.muscleSlug))) ?? null
}
