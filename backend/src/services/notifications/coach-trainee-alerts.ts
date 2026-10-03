import { NotificationType, type Prisma } from "@prisma/client"

import {
  getSnapshotExerciseId,
  getSnapshotExerciseName,
  getSnapshotMaxE1RM,
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

type AlertLog = { exerciseSnapshot: Prisma.JsonValue | null; startedAt: Date }

type TraineeAlertInput = {
  checkIns: ReadonlyArray<{ checkInDate: Date; readinessScore: number | null }>
  /** Completed sessions over the last four weeks. */
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
/** Weeks with no e1RM gain on a lift trained every one of them. */
const PLATEAU_WEEKS = 3
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
 * weight PR), or more reps at a weight already used in the first week (a rep
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

/**
 * A lift trained in each of the last three weeks with no e1RM, weight or rep PR
 * in the two later weeks against the first. Fewer weeks of data is not a
 * plateau, and neither is a lift still adding reps at the same load.
 */
function detectPlateau(input: TraineeAlertInput): CoachTraineeAlert | null {
  const weekOf = (date: Date) => Math.floor((input.now.getTime() - date.getTime()) / (7 * DAY_MS))
  const byLift = new Map<string, { name: string; weeks: Map<number, LiftWeek> }>()

  for (const log of input.logs) {
    const week = weekOf(log.startedAt)
    if (week < 0 || week >= PLATEAU_WEEKS) continue

    for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
      const best = getSnapshotMaxE1RM(exercise)
      const key = getSnapshotVariationId(exercise) ?? getSnapshotExerciseId(exercise)
      const name = getSnapshotExerciseName(exercise)
      if (!best || !key || !name) continue

      const lift = byLift.get(key) ?? { name, weeks: new Map<number, LiftWeek>() }
      const existing = lift.weeks.get(week) ?? { bestE1rm: 0, repsByWeight: new Map<number, number>(), topWeight: 0 }
      for (const [weight, reps] of repsByWeight(exercise)) {
        existing.repsByWeight.set(weight, Math.max(existing.repsByWeight.get(weight) ?? 0, reps))
        existing.topWeight = Math.max(existing.topWeight, weight)
      }
      existing.bestE1rm = Math.max(existing.bestE1rm, best.e1rm)
      lift.weeks.set(week, existing)
      byLift.set(key, lift)
    }
  }

  const stalled = Array.from(byLift.values()).flatMap((lift) => {
    if (lift.weeks.size < PLATEAU_WEEKS) return []
    const first = lift.weeks.get(PLATEAU_WEEKS - 1)!
    const later = Array.from({ length: PLATEAU_WEEKS - 1 }, (_, week) => lift.weeks.get(week)!)
    return progressedSince(first, later) ? [] : [lift.name]
  })

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
      return `${traineeName} has set no e1RM, weight or rep PR on ${alert.exercises.join(", ")} in ${PLATEAU_WEEKS} weeks.`
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
  detectCoachTraineeAlerts,
  LOW_READINESS,
  LOW_READINESS_STREAK,
  MISSED_SESSIONS_THRESHOLD,
  PLATEAU_WEEKS,
  progressedSince,
  repsByWeight,
}
export type { CoachTraineeAlert, CoachTraineeAlertKind, LiftWeek, TraineeAlertInput }
