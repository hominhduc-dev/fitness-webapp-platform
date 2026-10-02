/**
 * Learns a trainee's own volume landmarks for one muscle from their completed
 * weeks, starting from the system defaults and moving towards what the history
 * shows as the evidence accumulates.
 *
 * A week is "productive" when performance rose without recovery breaking down,
 * and "overreached" when performance fell while recovery did. The lowest
 * productive volume bounds MEV from above; the lowest overreached volume is
 * where recovery ran out, so MRV sits there; MAV spans the productive weeks.
 * With few weeks the defaults dominate, so one odd week cannot rewrite them.
 *
 * Pure: the caller loads the summaries and stores the result.
 */

type LearningWeek = {
  averageReadiness: number | null
  effectiveSets: number
  maxSoreness: number | null
  performanceChangePct: number | null
}

type Landmarks = { mavMaxSets: number; mavMinSets: number; mevSets: number; mrvSets: number }

type LearnedLandmarks = Landmarks & { confidence: number; weeksObserved: number }

/** Weeks before anything is learned at all. */
const MIN_WEEKS = 4
/** Weeks at which the history carries its full weight. */
const FULL_WEIGHT_WEEKS = 8
/** The history's share never reaches 1: the defaults keep a floor of influence. */
const MAX_HISTORY_WEIGHT = 0.8
const BASE_CONFIDENCE = 0.25
const MAX_CONFIDENCE = 0.85

const PRODUCTIVE_PERFORMANCE_PCT = 0.5
const OVERREACHED_PERFORMANCE_PCT = -2
const RECOVERED_READINESS = 60
const POOR_READINESS = 50
const HIGH_SORENESS = 4

function isProductive(week: LearningWeek) {
  return week.performanceChangePct != null
    && week.performanceChangePct >= PRODUCTIVE_PERFORMANCE_PCT
    && (week.averageReadiness == null || week.averageReadiness >= RECOVERED_READINESS)
    && (week.maxSoreness ?? 0) < HIGH_SORENESS
}

function isOverreached(week: LearningWeek) {
  return week.performanceChangePct != null
    && week.performanceChangePct <= OVERREACHED_PERFORMANCE_PCT
    && ((week.averageReadiness != null && week.averageReadiness < POOR_READINESS) || (week.maxSoreness ?? 0) >= HIGH_SORENESS)
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2
}

function blend(system: number, learned: number | null, weight: number) {
  return learned == null ? system : system * (1 - weight) + learned * weight
}

function learnVolumeLandmarks(system: Landmarks, history: readonly LearningWeek[]): LearnedLandmarks | null {
  const weeks = history.filter((week) => week.effectiveSets > 0)
  if (weeks.length < MIN_WEEKS) return null

  const productive = weeks.filter(isProductive).map((week) => week.effectiveSets).sort((a, b) => a - b)
  const overreached = weeks.filter(isOverreached).map((week) => week.effectiveSets).sort((a, b) => a - b)
  // Two weeks of a kind before it counts: one is as likely a bad night's sleep.
  if (productive.length < 2 && overreached.length < 2) return null

  const weight = Math.min(weeks.length / FULL_WEIGHT_WEEKS, 1) * MAX_HISTORY_WEIGHT

  const learnedMev = productive.length >= 2 ? Math.min(system.mevSets, productive[0]) : null
  const learnedMavMin = productive.length >= 2 ? productive[Math.floor((productive.length - 1) / 4)] : null
  const learnedMavMax = productive.length >= 2 ? productive[productive.length - 1] : null
  const learnedMrv = overreached.length >= 2 ? overreached[0] : null

  let mevSets = roundToHalf(blend(system.mevSets, learnedMev, weight))
  let mavMinSets = roundToHalf(blend(system.mavMinSets, learnedMavMin, weight))
  let mavMaxSets = roundToHalf(blend(system.mavMaxSets, learnedMavMax, weight))
  let mrvSets = roundToHalf(blend(system.mrvSets, learnedMrv, weight))

  // Keep the landmarks ordered: productive weeks can never sit above MRV, and a
  // range cannot invert however the evidence pulls each end.
  mrvSets = Math.max(mrvSets, learnedMavMax ?? 0, mevSets)
  mavMaxSets = Math.min(Math.max(mavMaxSets, mevSets), mrvSets)
  mavMinSets = Math.min(Math.max(mavMinSets, mevSets), mavMaxSets)
  mevSets = Math.min(mevSets, mavMinSets)

  return {
    confidence: Math.round((BASE_CONFIDENCE + (MAX_CONFIDENCE - BASE_CONFIDENCE) * Math.min(weeks.length / FULL_WEIGHT_WEEKS, 1)) * 100) / 100,
    mavMaxSets,
    mavMinSets,
    mevSets,
    mrvSets,
    weeksObserved: weeks.length,
  }
}

export { learnVolumeLandmarks, MIN_WEEKS }
export type { LearnedLandmarks, LearningWeek }
