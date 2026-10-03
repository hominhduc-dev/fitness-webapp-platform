import { NotificationType, type Prisma } from "@prisma/client"

import { isComparablePrescription, prescriptionFromSets, type Prescription } from "../../domain/exercise-exposure"

import {
  getSnapshotExerciseId,
  getSnapshotExerciseName,
  getSnapshotMaxE1RM,
  getSnapshotPrimaryMuscles,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
  type WorkoutLogSnapshotExercise,
} from "../fitness-data/shared/workout-snapshot"
import type { NotificationDraft } from "./notification-dispatch.service"

/**
 * Alerts that tell a coach which trainee needs a look, and why — rather than a
 * weekly total the coach has to read through. Each is raised from the trainee's
 * own data, at most once a week per trainee and kind.
 *
 * Pure detection: the scheduler loads the rows and sends the drafts.
 */

type CoachTraineeAlertKind = "low_readiness" | "missed_workouts" | "plateau"

type AlertLog = {
  exerciseSnapshot: Prisma.JsonValue | null
  startedAt: Date
  /** Carries the program phase the session fell in, when the log recorded it. */
  workoutSnapshot?: Prisma.JsonValue | null
}

type TraineeAlertInput = {
  checkIns: ReadonlyArray<{ checkInDate: Date; readinessScore: number | null }>
  /** Completed sessions over the plateau lookback (six weeks). */
  logs: readonly AlertLog[]
  now: Date
  /** Sessions a week the trainee's active program asks for; 0 without one. */
  workoutsPerWeek: number
}

type CoachTraineeAlert =
  | { kind: "missed_workouts"; completed: number; planned: number }
  | { kind: "low_readiness"; days: number; averageReadiness: number }
  | { kind: "plateau"; exercises: string[] }

const DAY_MS = 24 * 60 * 60 * 1000
const LOW_READINESS = 50
const LOW_READINESS_STREAK = 3
/** Sessions short of the plan, over the last seven days, before a coach hears of it. */
const MISSED_SESSIONS_THRESHOLD = 2
/** Comparable sessions a lift needs before it can be called stalled. */
const PLATEAU_EXPOSURES = 3
/** ...spread over at least this long, so three sessions in one week are not a plateau. */
const PLATEAU_MIN_SPAN_DAYS = 10
/** How far back a lift's sessions are read. */
const PLATEAU_LOOKBACK_DAYS = 42
/** A lift not trained this recently is not stalling now. */
const PLATEAU_RECENT_DAYS = 14
const MAX_PLATEAU_EXERCISES = 3

function detectMissedWorkouts(input: TraineeAlertInput): CoachTraineeAlert | null {
  if (input.workoutsPerWeek < MISSED_SESSIONS_THRESHOLD) return null
  const since = input.now.getTime() - 7 * DAY_MS
  const completed = input.logs.filter((log) => log.startedAt.getTime() >= since).length
  return input.workoutsPerWeek - completed >= MISSED_SESSIONS_THRESHOLD
    ? { completed, kind: "missed_workouts", planned: input.workoutsPerWeek }
    : null
}

/** The latest check-ins, on consecutive days, all below the readiness floor. */
function detectLowReadiness(input: TraineeAlertInput): CoachTraineeAlert | null {
  const scored = input.checkIns
    .filter((checkIn): checkIn is { checkInDate: Date; readinessScore: number } => checkIn.readinessScore != null)
    .slice()
    .sort((left, right) => right.checkInDate.getTime() - left.checkInDate.getTime())

  const streak: number[] = []
  for (const [index, checkIn] of scored.entries()) {
    if (checkIn.readinessScore >= LOW_READINESS) break
    if (index > 0 && scored[index - 1].checkInDate.getTime() - checkIn.checkInDate.getTime() > DAY_MS) break
    streak.push(checkIn.readinessScore)
  }

  // A streak that ended days ago is history, not something to act on now.
  const latest = scored[0]
  if (!latest || input.now.getTime() - latest.checkInDate.getTime() > 2 * DAY_MS) return null
  if (streak.length < LOW_READINESS_STREAK) return null

  return {
    averageReadiness: Math.round(streak.reduce((sum, value) => sum + value, 0) / streak.length),
    days: streak.length,
    kind: "low_readiness",
  }
}

type LiftWeek = { bestE1rm: number; repsByWeight: Map<number, number>; topWeight: number }

/** Completed working sets as weight → most reps done at it. */
function repsByWeight(exercise: WorkoutLogSnapshotExercise) {
  const result = new Map<number, number>()
  for (const set of exercise.sets ?? []) {
    if (set?.completed !== true || set.intensityTag === "warmup") continue
    if (typeof set.weight !== "number" || set.weight <= 0 || typeof set.actualReps !== "number" || set.actualReps <= 0) continue
    result.set(set.weight, Math.max(result.get(set.weight) ?? 0, set.actualReps))
  }
  return result
}

/**
 * Any of three kinds of progress counts: a higher e1RM, a heavier top set (a
 * weight PR), or more reps at a weight already used in the first session (a rep
 * PR). The rep check matters because the e1RM credits logged RIR: 80×8 @2 RIR
 * and 80×9 @1 RIR estimate the same, yet the second is a better set.
 */
function progressedSince(first: LiftWeek, later: readonly LiftWeek[]) {
  return later.some((week) =>
    week.bestE1rm > first.bestE1rm
    || week.topWeight > first.topWeight
    || Array.from(week.repsByWeight).some(([weight, reps]) => reps > (first.repsByWeight.get(weight) ?? Infinity)),
  )
}

/** Why a session of a lift is left out of its plateau evidence. */
type ExposureExclusion = "deload" | "intentional"

type LiftExposure = LiftWeek & {
  date: Date
  exclusion: ExposureExclusion | null
  prescription: Prescription
}

type LiftHistory = {
  /** Comparable, counted sessions back from the latest: the evidence a plateau is judged on. Newest first. */
  chain: LiftExposure[]
  /** Every session in the window, newest first. */
  exposures: LiftExposure[]
  key: string
  name: string
  primaryMuscles: string[]
}

function readPhase(log: AlertLog) {
  const snapshot = log.workoutSnapshot
  const phase = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? (snapshot as { phase?: unknown }).phase : undefined
  return typeof phase === "string" ? phase : null
}

/**
 * A lighter session the engine itself asked for — a deload or a load cut —
 * is the plan working, not the lift stalling.
 */
function intentionalRegression(exercise: WorkoutLogSnapshotExercise) {
  const progression = (exercise as { progression?: { action?: unknown; muscleAction?: unknown } | null }).progression
  return progression?.action === "reduce_load" || progression?.muscleAction === "deload"
}

/**
 * Each lift's sessions over the window, and the run of comparable ones that
 * ends at its latest counted session. Sessions in a deload week, or where the
 * engine asked for less, are skipped without breaking the run; a session under
 * a different prescription ends it, since what came before was another block.
 */
function buildLiftHistories(logs: readonly AlertLog[], now: Date, lookbackDays = PLATEAU_LOOKBACK_DAYS) {
  const from = now.getTime() - lookbackDays * DAY_MS
  const byLift = new Map<string, Omit<LiftHistory, "chain"> & { muscles: Set<string> }>()

  for (const log of logs) {
    if (log.startedAt.getTime() < from || log.startedAt.getTime() > now.getTime()) continue
    const phase = readPhase(log)
    for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
      const best = getSnapshotMaxE1RM(exercise)
      const key = getSnapshotVariationId(exercise) ?? getSnapshotExerciseId(exercise)
      const name = getSnapshotExerciseName(exercise)
      if (!best || !key || !name) continue

      const reps = repsByWeight(exercise)
      const lift = byLift.get(key) ?? { exposures: [], key, muscles: new Set<string>(), name, primaryMuscles: [] }
      for (const muscle of getSnapshotPrimaryMuscles(exercise)) lift.muscles.add(muscle)
      lift.exposures.push({
        bestE1rm: best.e1rm,
        date: log.startedAt,
        exclusion: phase === "deload" ? "deload" : intentionalRegression(exercise) ? "intentional" : null,
        prescription: prescriptionFromSets(exercise.sets ?? []),
        repsByWeight: reps,
        topWeight: Math.max(0, ...reps.keys()),
      })
      byLift.set(key, lift)
    }
  }

  return Array.from(byLift.values()).map(({ muscles, ...lift }): LiftHistory => {
    const exposures = lift.exposures.slice().sort((left, right) => right.date.getTime() - left.date.getTime())
    const counted = exposures.filter((exposure) => exposure.exclusion == null)
    const reference = counted[0]
    const chain: LiftExposure[] = []
    for (const exposure of counted) {
      if (!reference || !isComparablePrescription(reference.prescription, exposure.prescription)) break
      chain.push(exposure)
    }
    return { ...lift, chain, exposures, primaryMuscles: Array.from(muscles).sort() }
  })
}

/**
 * Stalled: at least three comparable sessions spread over ten days or more,
 * the latest within two weeks, and none of the later ones beating the first —
 * no e1RM, weight or rep PR. Fewer comparable sessions is not enough evidence,
 * however many weeks they span.
 */
function isPlateau(history: LiftHistory, now: Date) {
  const judged = history.chain.slice(0, PLATEAU_EXPOSURES)
  if (judged.length < PLATEAU_EXPOSURES) return false
  const [latest] = judged
  const first = judged.at(-1)!
  if (now.getTime() - latest.date.getTime() > PLATEAU_RECENT_DAYS * DAY_MS) return false
  if (latest.date.getTime() - first.date.getTime() < PLATEAU_MIN_SPAN_DAYS * DAY_MS) return false
  return !progressedSince(first, judged.slice(0, -1))
}

function detectPlateau(input: TraineeAlertInput): CoachTraineeAlert | null {
  const stalled = buildLiftHistories(input.logs, input.now)
    .filter((history) => isPlateau(history, input.now))
    .map((history) => history.name)

  return stalled.length > 0
    ? { exercises: stalled.sort().slice(0, MAX_PLATEAU_EXERCISES), kind: "plateau" }
    : null
}

function detectCoachTraineeAlerts(input: TraineeAlertInput): CoachTraineeAlert[] {
  return [detectMissedWorkouts(input), detectLowReadiness(input), detectPlateau(input)]
    .filter((alert): alert is CoachTraineeAlert => alert != null)
}

function describeAlert(alert: CoachTraineeAlert, traineeName: string) {
  switch (alert.kind) {
    case "missed_workouts":
      return `${traineeName} completed ${alert.completed} of ${alert.planned} planned sessions in the last 7 days.`
    case "low_readiness":
      return `${traineeName}'s readiness has been below ${LOW_READINESS} for ${alert.days} days (avg ${alert.averageReadiness}).`
    case "plateau":
      return `${traineeName} has set no e1RM, weight or rep PR on ${alert.exercises.join(", ")} over their last ${PLATEAU_EXPOSURES} comparable sessions.`
  }
}

function buildCoachTraineeAlertDraft(input: {
  alert: CoachTraineeAlert
  coachId: string
  trainee: { id: string; name: string }
  weekStartKey: string
}): NotificationDraft {
  return {
    dedupeKey: `coach_trainee_alert:${input.coachId}:${input.trainee.id}:${input.alert.kind}:${input.weekStartKey}`,
    message: describeAlert(input.alert, input.trainee.name),
    metadata: {
      ...input.alert,
      traineeId: input.trainee.id,
      traineeName: input.trainee.name,
      weekStart: input.weekStartKey,
    },
    relatedEntityId: input.trainee.id,
    relatedEntityType: "user",
    title: "Trainee needs attention",
    type: NotificationType.coach_trainee_alert,
    url: `/coach/trainees/${input.trainee.id}/alerts/${input.alert.kind}?week=${input.weekStartKey}`,
    userId: input.coachId,
  }
}

export {
  buildCoachTraineeAlertDraft,
  buildLiftHistories,
  detectCoachTraineeAlerts,
  isPlateau,
  LOW_READINESS,
  LOW_READINESS_STREAK,
  MISSED_SESSIONS_THRESHOLD,
  PLATEAU_EXPOSURES,
  PLATEAU_LOOKBACK_DAYS,
  progressedSince,
}
export type { CoachTraineeAlert, CoachTraineeAlertKind, ExposureExclusion, LiftExposure, LiftHistory, LiftWeek, TraineeAlertInput }
