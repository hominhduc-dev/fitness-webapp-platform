import type { VolumeLandmarks } from "./analytics"

type SetLandmarks = Pick<VolumeLandmarks, "mavMaxSets" | "mavMinSets" | "mevSets" | "mrvSets">

/** The fallback for a muscle with no starting point of its own. */
const GENERIC_LANDMARKS: SetLandmarks = { mevSets: 8, mavMinSets: 10, mavMaxSets: 16, mrvSets: 20 }

/**
 * Weekly hard-set starting points per muscle, in effective sets (a secondary
 * set counts half). They follow the published hypertrophy landmark ranges,
 * shaded down where a muscle already collects a lot of indirect work: the
 * deltoids and triceps from pressing, the biceps from rows, the lower back and
 * glutes from squats and hinges. A muscle with an MEV of 0 grows on that
 * indirect work alone, so it is never reported as below MEV.
 *
 * These are only where a trainee starts. A coach's own numbers replace them,
 * and so will what the engine learns from the trainee's history.
 */
const SYSTEM_LANDMARKS_BY_MUSCLE: Readonly<Record<string, SetLandmarks>> = {
  abs: { mevSets: 2, mavMinSets: 8, mavMaxSets: 16, mrvSets: 22 },
  adductors: { mevSets: 0, mavMinSets: 4, mavMaxSets: 8, mrvSets: 14 },
  biceps: { mevSets: 6, mavMinSets: 10, mavMaxSets: 16, mrvSets: 22 },
  calves: { mevSets: 6, mavMinSets: 10, mavMaxSets: 14, mrvSets: 20 },
  chest: { mevSets: 6, mavMinSets: 10, mavMaxSets: 16, mrvSets: 22 },
  deltoids: { mevSets: 6, mavMinSets: 10, mavMaxSets: 18, mrvSets: 24 },
  forearm: { mevSets: 2, mavMinSets: 6, mavMaxSets: 10, mrvSets: 16 },
  gluteal: { mevSets: 2, mavMinSets: 6, mavMaxSets: 12, mrvSets: 16 },
  hamstring: { mevSets: 4, mavMinSets: 8, mavMaxSets: 12, mrvSets: 18 },
  "lower-back": { mevSets: 0, mavMinSets: 3, mavMaxSets: 6, mrvSets: 10 },
  obliques: { mevSets: 0, mavMinSets: 4, mavMaxSets: 10, mrvSets: 16 },
  quadriceps: { mevSets: 6, mavMinSets: 10, mavMaxSets: 16, mrvSets: 20 },
  tibialis: { mevSets: 0, mavMinSets: 2, mavMaxSets: 6, mrvSets: 12 },
  trapezius: { mevSets: 2, mavMinSets: 8, mavMaxSets: 14, mrvSets: 24 },
  triceps: { mevSets: 4, mavMinSets: 8, mavMaxSets: 12, mrvSets: 18 },
  "upper-back": { mevSets: 8, mavMinSets: 12, mavMaxSets: 20, mrvSets: 25 },
}

/** Confidence in a system default: a population guess, not this trainee's history. */
const SYSTEM_LANDMARK_CONFIDENCE = 0.25

function systemLandmarksForMuscle(muscleSlug: string): VolumeLandmarks {
  return {
    ...(SYSTEM_LANDMARKS_BY_MUSCLE[muscleSlug] ?? GENERIC_LANDMARKS),
    confidence: SYSTEM_LANDMARK_CONFIDENCE,
    source: "system",
  }
}

export { systemLandmarksForMuscle }
