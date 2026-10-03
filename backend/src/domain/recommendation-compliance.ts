import type { OverloadAction } from "./progressive-overload"

/**
 * How closely a trainee's session followed the engine's suggestion for one
 * exercise, and how the next session of that exercise went.
 *
 * Compliance is judged per dimension — load, reps, effort (RIR) and sets — and
 * by the action's own meaning rather than one tolerance for everything: an
 * add_load is followed only when the load actually went up. The overall verdict
 * is derived from the dimensions, which are kept so analysis can see where a
 * suggestion was not followed.
 *
 * Pure: no Prisma, no I/O.
 */

type Compliance = "followed" | "modified" | "partial"
type OverallCompliance = Compliance | "not_attempted"
type NextSessionOutcome = "insufficient_data" | "maintained" | "regressed" | "rolled_back" | "successful"

type SuggestedSet = { previousReps: number; previousWeight: number | null; reps: number; setNumber: number; weight: number | null }
type PerformedSet = { reps: number; rir: number | null; weight: number | null }

/** Used when the equipment's increment is unknown. */
const DEFAULT_LOAD_INCREMENT_KG = 2.5
/** Logged RIR within this of the target is on prescription. */
const RIR_TOLERANCE = 1

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits
const loadOf = (weight: number | null | undefined) => (typeof weight === "number" && weight > 0 ? weight : null)

/**
 * The working set that stands for the whole exercise: the heaviest load, and
 * the fewest reps done at it — the reps every set at that load reached, which
 * is what double progression reads.
 */
function topSet<T>(sets: readonly T[], weightOf: (set: T) => number | null, repsOf: (set: T) => number) {
  if (sets.length === 0) return null
  const weights = sets.map(weightOf)
  const weight = weights.some((value) => value != null) ? Math.max(...weights.map((value) => value ?? 0)) : null
  const atTop = sets.filter((set) => weightOf(set) === weight)
  return { reps: Math.min(...atTop.map(repsOf)), weight }
}

/** The suggestion reduced to the numbers it is compared on. */
function summarizeSuggestion(input: {
  programmedWorkingSets: number
  setDelta: number
  sets: readonly SuggestedSet[]
}) {
  const suggested = topSet(input.sets, (set) => loadOf(set.weight), (set) => set.reps)
  const previous = topSet(input.sets, (set) => loadOf(set.previousWeight), (set) => set.previousReps)
  return {
    previousReps: previous?.reps ?? null,
    previousWeight: previous?.weight ?? null,
    suggestedReps: suggested?.reps ?? null,
    suggestedSets: Math.max(1, input.programmedWorkingSets + input.setDelta),
    suggestedWeight: suggested?.weight ?? null,
  }
}

/** What was actually done: completed working sets only. */
function summarizeExecution(sets: readonly PerformedSet[]) {
  const top = topSet(sets, (set) => loadOf(set.weight), (set) => set.reps)
  const rirs = sets.flatMap((set) => (set.rir == null ? [] : [set.rir]))
  return {
    actualReps: top?.reps ?? null,
    actualRir: rirs.length > 0 ? round(rirs.reduce((sum, value) => sum + value, 0) / rirs.length, 1) : null,
    actualSets: sets.length,
    actualWeight: top?.weight ?? null,
  }
}

type ComplianceInput = {
  action: OverloadAction
  loadIncrementKg: number | null
  previousReps: number | null
  previousWeight: number | null
  programmedWorkingSets: number
  setDelta: number
  suggestedReps: number | null
  suggestedRir: number | null
  suggestedSets: number
  suggestedWeight: number | null
  /** Null when the exercise was skipped or removed from the session. */
  execution: ReturnType<typeof summarizeExecution> | null
  /** The trainee did a different variation in this slot. */
  swapped: boolean
}

type ComplianceResult = {
  loadCompliance: Compliance | null
  overallCompliance: OverallCompliance
  repCompliance: Compliance | null
  /** Null when either the target or the logged RIR is missing. */
  rirCompliance: Compliance | null
  setCompliance: Compliance | null
}

function loadCompliance(input: ComplianceInput, actualWeight: number | null): Compliance {
  const tolerance = (input.loadIncrementKg ?? DEFAULT_LOAD_INCREMENT_KG) / 2
  const suggested = input.suggestedWeight
  // Bodyweight work: followed while no load was strapped on.
  if (suggested == null) return actualWeight == null || actualWeight <= tolerance ? "followed" : "modified"
  if (actualWeight == null) return "modified"
  if (Math.abs(actualWeight - suggested) <= tolerance) return "followed"

  const previous = input.previousWeight
  switch (input.action) {
    case "add_load":
      // Went up, but not as far as suggested.
      return previous != null && actualWeight > previous + tolerance && actualWeight < suggested ? "partial" : "modified"
    case "reduce_load":
      if (actualWeight < suggested) return "followed"
      return previous != null && actualWeight < previous - tolerance ? "partial" : "modified"
    default:
      return "modified"
  }
}

function repCompliance(input: ComplianceInput, actualReps: number | null): Compliance | null {
  if (input.suggestedReps == null || actualReps == null) return null
  if (input.action === "add_reps") {
    // The rep is the whole step here, so it is not forgiven.
    if (actualReps >= input.suggestedReps) return "followed"
    return actualReps >= input.suggestedReps - 1 ? "partial" : "modified"
  }
  return actualReps >= input.suggestedReps - 1 ? "followed" : "partial"
}

function rirCompliance(input: ComplianceInput, actualRir: number | null): Compliance | null {
  if (input.suggestedRir == null || actualRir == null) return null
  return Math.abs(actualRir - input.suggestedRir) <= RIR_TOLERANCE ? "followed" : "modified"
}

function setCompliance(input: ComplianceInput, actualSets: number): Compliance {
  if (input.setDelta > 0) {
    if (actualSets >= input.suggestedSets) return "followed"
    return actualSets > input.programmedWorkingSets ? "partial" : "modified"
  }
  if (input.setDelta < 0) {
    if (actualSets <= input.suggestedSets) return "followed"
    return actualSets < input.programmedWorkingSets ? "partial" : "modified"
  }
  return actualSets >= input.suggestedSets ? "followed" : "partial"
}

/**
 * Overall: modified when the dimension the action is about was not followed —
 * the load for a load change, the reps for add_reps, the sets for a set change.
 * Otherwise followed only when every dimension that could be judged was.
 */
function classifyCompliance(input: ComplianceInput): ComplianceResult {
  const execution = input.execution
  if (!execution || execution.actualSets === 0) {
    return { loadCompliance: null, overallCompliance: "not_attempted", repCompliance: null, rirCompliance: null, setCompliance: null }
  }
  if (input.swapped) {
    return { loadCompliance: null, overallCompliance: "modified", repCompliance: null, rirCompliance: null, setCompliance: null }
  }

  const result = {
    loadCompliance: loadCompliance(input, execution.actualWeight),
    repCompliance: repCompliance(input, execution.actualReps),
    rirCompliance: rirCompliance(input, execution.actualRir),
    setCompliance: setCompliance(input, execution.actualSets),
  }

  const primaryMissed =
    result.loadCompliance === "modified"
    || (input.action === "add_reps" && result.repCompliance === "modified")
    || (input.setDelta !== 0 && result.setCompliance === "modified")
  const judged = Object.values(result).filter((value): value is Compliance => value != null)
  const overallCompliance: OverallCompliance = primaryMissed
    ? "modified"
    : judged.every((value) => value === "followed") ? "followed" : "partial"

  return { ...result, overallCompliance }
}

/**
 * How the next session of the same exercise went against the one the
 * suggestion was for. A load that came back down is a rollback — the clearest
 * sign the step was too big.
 */
function classifyNextSessionOutcome(input: {
  loadIncrementKg: number | null
  next: { reps: number | null; weight: number | null }
  previous: { overallCompliance: OverallCompliance | null; reps: number | null; weight: number | null }
}): NextSessionOutcome {
  const { next, previous } = input
  if (!previous.overallCompliance || previous.overallCompliance === "not_attempted") return "insufficient_data"
  if (previous.reps == null || next.reps == null) return "insufficient_data"

  const tolerance = (input.loadIncrementKg ?? DEFAULT_LOAD_INCREMENT_KG) / 2
  const previousWeight = previous.weight ?? 0
  const nextWeight = next.weight ?? 0
  if (nextWeight < previousWeight - tolerance) return "rolled_back"
  if (nextWeight > previousWeight + tolerance) return "successful"

  const repChange = next.reps - previous.reps
  if (repChange >= 1) return "successful"
  return repChange >= -1 ? "maintained" : "regressed"
}

export { classifyCompliance, classifyNextSessionOutcome, summarizeExecution, summarizeSuggestion }
export type { Compliance, ComplianceInput, ComplianceResult, NextSessionOutcome, OverallCompliance, PerformedSet, SuggestedSet }
