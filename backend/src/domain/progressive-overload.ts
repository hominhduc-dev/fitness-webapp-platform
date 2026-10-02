/**
 * Progressive overload for one exercise slot: given what the coach programmed
 * and what the trainee did last time, what should today's sets be.
 *
 * Double progression, steered by RIR. Reps climb inside the programmed range at
 * the same load; once every working set reaches the top of the range without
 * going harder than the target RIR, the load goes up and the reps drop back to
 * the bottom. Sets that fall short of the range hold the load, and a session
 * where most of them fell short takes weight off.
 *
 * Loads land on the equipment's grid (see load-increment.ts); an exercise with
 * no external load progresses on reps alone.
 *
 * Pure: no Prisma, no I/O. The caller supplies the history.
 */

import { lowerLoad, nextLoad } from "./load-increment"

type OverloadAction = "add_load" | "add_reps" | "maintain" | "reduce_load" | "establish_baseline"

type OverloadReason =
  | "no_history"
  | "top_of_range_reached"
  | "top_of_range_too_hard"
  | "inside_range"
  | "below_range"
  | "mostly_below_range"
  | "readiness_low"
  | "no_load_increment"

type OverloadSetInput = {
  setNumber: number
  /** Bottom of the programmed range; absent means a single rep target. */
  targetRepsMin?: number | null
  targetReps: number
  /** RIR the coach programmed for this set, if any. */
  targetRir?: number | null
  /** Warm-ups are not progressed. */
  isWarmup?: boolean
  previous?: { reps?: number | null; rir?: number | null; weight?: number | null } | null
}

type OverloadSetSuggestion = {
  /** What the set was last session, so a later step can fall back to it. */
  previousReps: number
  previousWeight: number | null
  reps: number
  setNumber: number
  weight: number | null
}

type OverloadRecommendation = {
  action: OverloadAction
  reasons: OverloadReason[]
  sets: OverloadSetSuggestion[]
}

/** Readiness below this turns a progression step into the next smaller one. */
const LOW_READINESS = 50
/** Share of working sets below the range that takes weight off. */
const REDUCE_SHARE = 0.5
const REDUCE_FACTOR = 0.9
/** Assumed when the coach programmed none: a hypertrophy-typical working effort. */
const DEFAULT_TARGET_RIR = 2

/** Upper body aims for ~2.5% jumps, lower body ~5%; the equipment grid has the last word. */
const UPPER_BODY_PCT = 0.025
const LOWER_BODY_PCT = 0.05
/** Used when the caller does not know the equipment. */
const DEFAULT_LOAD_INCREMENT = 2.5

function repRange(set: OverloadSetInput) {
  const max = Math.max(1, set.targetReps)
  const min = Math.min(max, Math.max(1, set.targetRepsMin ?? max))
  return { max, min }
}

function buildOverloadRecommendation(input: {
  /** The equipment's smallest load jump; null when the load does not progress. */
  loadIncrementKg?: number | null
  lowerBody?: boolean
  readinessScore?: number | null
  sets: readonly OverloadSetInput[]
}): OverloadRecommendation {
  const working = input.sets.filter((set) => !set.isWarmup)
  const withHistory = working.filter(
    (set) => typeof set.previous?.reps === "number" && set.previous.reps > 0,
  )

  if (withHistory.length === 0) {
    return { action: "establish_baseline", reasons: ["no_history"], sets: [] }
  }

  const lowerBody = input.lowerBody === true
  const evaluated = withHistory.map((set) => {
    const range = repRange(set)
    const reps = set.previous!.reps!
    const rir = set.previous?.rir
    const targetRir = set.targetRir ?? DEFAULT_TARGET_RIR
    return {
      atTop: reps >= range.max,
      belowMin: reps < range.min,
      // One rep harder than programmed is still within target; more is a grind.
      harderThanTarget: typeof rir === "number" && rir < targetRir - 1,
      range,
      reps,
      set,
      weight: typeof set.previous?.weight === "number" && set.previous.weight > 0 ? set.previous.weight : null,
    }
  })

  const belowCount = evaluated.filter((entry) => entry.belowMin).length
  let action: OverloadAction
  const reasons: OverloadReason[] = []

  if (belowCount / evaluated.length >= REDUCE_SHARE && evaluated.some((entry) => entry.weight != null)) {
    action = belowCount === evaluated.length || evaluated.some((entry) => entry.belowMin && entry.harderThanTarget)
      ? "reduce_load"
      : "maintain"
    reasons.push(action === "reduce_load" ? "mostly_below_range" : "below_range")
  } else if (belowCount > 0) {
    action = "maintain"
    reasons.push("below_range")
  } else if (evaluated.every((entry) => entry.atTop)) {
    const tooHard = evaluated.some((entry) => entry.harderThanTarget)
    action = tooHard ? "maintain" : "add_load"
    reasons.push(tooHard ? "top_of_range_too_hard" : "top_of_range_reached")
  } else {
    action = "add_reps"
    reasons.push("inside_range")
  }

  const increment = input.loadIncrementKg === undefined ? DEFAULT_LOAD_INCREMENT : input.loadIncrementKg
  // Without external load there is nothing to add: the top of the range is
  // pushed past instead, a rep at a time.
  const loadless = increment == null || evaluated.every((entry) => entry.weight == null)
  if (loadless && (action === "add_load" || action === "reduce_load")) {
    action = action === "add_load" ? "add_reps" : "maintain"
    reasons.push("no_load_increment")
  }

  const lowReadiness = input.readinessScore != null && input.readinessScore < LOW_READINESS
  if (lowReadiness && (action === "add_load" || action === "add_reps")) {
    action = action === "add_load" ? "add_reps" : "maintain"
    reasons.push("readiness_low")
  }

  const pct = lowerBody ? LOWER_BODY_PCT : UPPER_BODY_PCT
  const pastTopAllowed = reasons.includes("no_load_increment")
  const sets = evaluated.map(({ range, reps, set, weight }): OverloadSetSuggestion => {
    const previous = { previousReps: reps, previousWeight: weight, setNumber: set.setNumber }
    switch (action) {
      case "add_load":
        return { ...previous, reps: range.min, weight: weight == null || increment == null ? weight : nextLoad(weight, increment, pct) }
      case "reduce_load":
        return {
          ...previous,
          reps: range.min,
          weight: weight == null || increment == null ? weight : lowerLoad(weight, increment, REDUCE_FACTOR),
        }
      case "add_reps":
        return { ...previous, reps: pastTopAllowed ? reps + 1 : Math.min(range.max, reps + 1), weight }
      default:
        return { ...previous, reps: Math.max(range.min, Math.min(range.max, reps)), weight }
    }
  })

  return { action, reasons, sets }
}

const LOWER_BODY_MUSCLES: ReadonlySet<string> = new Set(["adductors", "calves", "gluteal", "hamstring", "quadriceps", "tibialis"])

/** An exercise is lower-body when its primary muscles are mostly legs and hips. */
function isLowerBodyExercise(primaryMuscles: readonly string[]) {
  if (primaryMuscles.length === 0) return false
  const lower = primaryMuscles.filter((muscle) => LOWER_BODY_MUSCLES.has(muscle)).length
  return lower * 2 >= primaryMuscles.length
}

export { buildOverloadRecommendation, isLowerBodyExercise }
export type { OverloadAction, OverloadReason, OverloadRecommendation, OverloadSetInput, OverloadSetSuggestion }
