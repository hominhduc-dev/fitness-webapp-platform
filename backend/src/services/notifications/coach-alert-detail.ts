import type { Prisma } from "@prisma/client"

import {
  getSnapshotExerciseId,
  getSnapshotExerciseName,
  getSnapshotMaxE1RM,
  getSnapshotPrimaryMuscles,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
} from "../fitness-data/shared/workout-snapshot"
import { classifyVolumeZone, type VolumeLandmarks, type VolumeZone } from "../volume-recovery/analytics"
import {
  LOW_READINESS,
  PLATEAU_WEEKS,
  progressedSince,
  repsByWeight,
  type CoachTraineeAlertKind,
  type LiftWeek,
} from "./coach-trainee-alerts"

/**
 * The evidence behind one coach alert, so the coach can see why it was raised
 * and what to do about it rather than only a sentence in the bell.
 *
 * Weeks are counted back from when the alert was raised, as the detection did,
 * and whatever was trained since is shown apart: it says whether the alert still
 * stands. Pure: the service loads the rows.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** Weeks of history drawn for a plateau: the three it was judged on and one before. */
const PLATEAU_HISTORY_WEEKS = PLATEAU_WEEKS + 1
const MISSED_HISTORY_WEEKS = 4
const READINESS_HISTORY_DAYS = 14
/** Weekly sets at or above this share of MRV point at recovery, not stimulus. */
const NEAR_MRV_SHARE = 0.9
/** Average readiness under this over the window points at recovery. */
const LOW_AVERAGE_READINESS = 60

type DetailLog = { exerciseSnapshot: Prisma.JsonValue | null; startedAt: Date; workoutName: string | null }
type DetailCheckIn = {
  checkInDate: Date
  fatigue: number
  maxSoreness: number | null
  note: string | null
  readinessScore: number | null
  sleepMinutes: number | null
  sleepQuality: number | null
  stress: number | null
}
type WeeklySummary = { averageRir: number | null; effectiveSets: number; muscleSlug: string; weekStart: Date }
type ExerciseNote = { date: Date; exerciseName: string; note: string }

type Suggestion =
  | "change_stimulus"
  | "check_schedule"
  | "lighter_session"
  | "message_trainee"
  | "read_notes"
  | "reduce_volume"
  | "resolved"
  | "review_recovery"

type LiftWeekView = { bestE1rm: number | null; sessions: number; topReps: number | null; topWeight: number | null; weeksAgo: number }

type PlateauLift = {
  key: string
  name: string
  notes: Array<{ date: string; note: string }>
  primaryMuscles: string[]
  sinceAlert: { bestE1rm: number | null; progressed: boolean; sessions: number; topWeight: number | null }
  /** Oldest first. */
  weeks: LiftWeekView[]
}

type MuscleContext = {
  landmarks: { mavMaxSets: number; mavMinSets: number; mevSets: number; mrvSets: number; source: VolumeLandmarks["source"] }
  muscleSlug: string
  /** Oldest first; weeks with no summary are left out. */
  weeks: Array<{ averageRir: number | null; effectiveSets: number; weekStart: string; zone: VolumeZone }>
}

type CoachAlertDetail = {
  kind: CoachTraineeAlertKind
  lowReadiness?: {
    checkIns: Array<{
      date: string
      fatigue: number
      maxSoreness: number | null
      note: string | null
      readiness: number | null
      sinceAlert: boolean
      sleepMinutes: number | null
      sleepQuality: number | null
      stress: number | null
    }>
    threshold: number
  }
  missedWorkouts?: {
    planned: number
    /** Sessions in the seven days the alert was judged on, newest first. */
    sessions: Array<{ date: string; workoutName: string | null }>
    sinceAlert: number
    /** Oldest first: sessions completed in each seven-day window. */
    weeks: Array<{ completed: number; weeksAgo: number }>
  }
  plateau?: {
    lifts: PlateauLift[]
    muscles: MuscleContext[]
    readinessAverage: number | null
  }
  raisedAt: string
  suggestions: Suggestion[]
}

const round1 = (value: number) => Math.round(value * 10) / 10
const dayKey = (date: Date) => date.toISOString().slice(0, 10)
const weeksBefore = (anchor: Date, date: Date) => Math.floor((anchor.getTime() - date.getTime()) / WEEK_MS)

function average(values: readonly number[]) {
  return values.length > 0 ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function emptyWeek(): LiftWeek & { sessions: number } {
  return { bestE1rm: 0, repsByWeight: new Map(), sessions: 0, topWeight: 0 }
}

function foldInto(week: LiftWeek & { sessions: number }, exercise: ReturnType<typeof parseWorkoutLogSnapshotExercises>[number]) {
  for (const [weight, reps] of repsByWeight(exercise)) {
    week.repsByWeight.set(weight, Math.max(week.repsByWeight.get(weight) ?? 0, reps))
    week.topWeight = Math.max(week.topWeight, weight)
  }
  week.bestE1rm = Math.max(week.bestE1rm, getSnapshotMaxE1RM(exercise)?.e1rm ?? 0)
  week.sessions += 1
}

function viewWeek(week: (LiftWeek & { sessions: number }) | undefined, weeksAgo: number): LiftWeekView {
  if (!week || week.sessions === 0) return { bestE1rm: null, sessions: 0, topReps: null, topWeight: null, weeksAgo }
  return {
    bestE1rm: week.bestE1rm > 0 ? round1(week.bestE1rm) : null,
    sessions: week.sessions,
    topReps: week.topWeight > 0 ? week.repsByWeight.get(week.topWeight) ?? null : null,
    topWeight: week.topWeight > 0 ? week.topWeight : null,
    weeksAgo,
  }
}

/** The weeks of each named lift before the alert, and what it did since. */
function buildPlateauLifts(input: { exercises: readonly string[]; logs: readonly DetailLog[]; notes: readonly ExerciseNote[]; raisedAt: Date }) {
  const named = new Set(input.exercises)
  const byLift = new Map<string, { name: string; primaryMuscles: Set<string>; since: LiftWeek & { sessions: number }; weeks: Map<number, LiftWeek & { sessions: number }> }>()

  for (const log of input.logs) {
    const weeksAgo = weeksBefore(input.raisedAt, log.startedAt)
    const after = log.startedAt.getTime() > input.raisedAt.getTime()
    if (!after && weeksAgo >= PLATEAU_HISTORY_WEEKS) continue

    for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
      const name = getSnapshotExerciseName(exercise)
      const key = getSnapshotVariationId(exercise) ?? getSnapshotExerciseId(exercise)
      if (!name || !key || !named.has(name)) continue

      const lift = byLift.get(key) ?? { name, primaryMuscles: new Set<string>(), since: emptyWeek(), weeks: new Map() }
      for (const muscle of getSnapshotPrimaryMuscles(exercise) ?? []) lift.primaryMuscles.add(muscle)
      if (after) {
        foldInto(lift.since, exercise)
      } else {
        const week = lift.weeks.get(weeksAgo) ?? emptyWeek()
        foldInto(week, exercise)
        lift.weeks.set(weeksAgo, week)
      }
      byLift.set(key, lift)
    }
  }

  return Array.from(byLift.entries())
    .map(([key, lift]): PlateauLift => {
      // The best of the weeks the alert was judged on: progress since means beating it.
      const judged = emptyWeek()
      for (let weeksAgo = 0; weeksAgo < PLATEAU_WEEKS; weeksAgo += 1) {
        const week = lift.weeks.get(weeksAgo)
        if (!week) continue
        judged.bestE1rm = Math.max(judged.bestE1rm, week.bestE1rm)
        judged.topWeight = Math.max(judged.topWeight, week.topWeight)
        for (const [weight, reps] of week.repsByWeight) judged.repsByWeight.set(weight, Math.max(judged.repsByWeight.get(weight) ?? 0, reps))
      }
      const since = viewWeek(lift.since, -1)
      return {
        key,
        name: lift.name,
        notes: input.notes
          .filter((note) => note.exerciseName === lift.name)
          .map((note) => ({ date: dayKey(note.date), note: note.note })),
        primaryMuscles: Array.from(lift.primaryMuscles).sort(),
        sinceAlert: {
          bestE1rm: since.bestE1rm,
          progressed: lift.since.sessions > 0 && progressedSince(judged, [lift.since]),
          sessions: lift.since.sessions,
          topWeight: since.topWeight,
        },
        weeks: Array.from({ length: PLATEAU_HISTORY_WEEKS }, (_, index) => {
          const weeksAgo = PLATEAU_HISTORY_WEEKS - 1 - index
          return viewWeek(lift.weeks.get(weeksAgo), weeksAgo)
        }),
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function buildMuscleContext(input: {
  landmarksFor: (muscleSlug: string) => VolumeLandmarks
  muscles: readonly string[]
  raisedAt: Date
  summaries: readonly WeeklySummary[]
}): MuscleContext[] {
  const from = input.raisedAt.getTime() - PLATEAU_HISTORY_WEEKS * WEEK_MS
  return input.muscles.map((muscleSlug) => {
    const landmarks = input.landmarksFor(muscleSlug)
    return {
      landmarks: {
        mavMaxSets: landmarks.mavMaxSets,
        mavMinSets: landmarks.mavMinSets,
        mevSets: landmarks.mevSets,
        mrvSets: landmarks.mrvSets,
        source: landmarks.source,
      },
      muscleSlug,
      weeks: input.summaries
        .filter((summary) => summary.muscleSlug === muscleSlug && summary.weekStart.getTime() >= from && summary.weekStart.getTime() < input.raisedAt.getTime())
        .sort((left, right) => left.weekStart.getTime() - right.weekStart.getTime())
        .map((summary) => ({
          averageRir: summary.averageRir,
          effectiveSets: round1(summary.effectiveSets),
          weekStart: dayKey(summary.weekStart),
          zone: classifyVolumeZone(summary.effectiveSets, landmarks),
        })),
    }
  })
}

function plateauSuggestions(plateau: NonNullable<CoachAlertDetail["plateau"]>): Suggestion[] {
  const suggestions: Suggestion[] = []
  if (plateau.lifts.length > 0 && plateau.lifts.every((lift) => lift.sinceAlert.progressed)) suggestions.push("resolved")
  const nearMrv = plateau.muscles.some((muscle) => {
    const sets = muscle.weeks.map((week) => week.effectiveSets)
    const mean = average(sets)
    return mean != null && mean >= muscle.landmarks.mrvSets * NEAR_MRV_SHARE
  })
  if (nearMrv) suggestions.push("reduce_volume")
  if (plateau.readinessAverage != null && plateau.readinessAverage < LOW_AVERAGE_READINESS) suggestions.push("review_recovery")
  if (plateau.lifts.some((lift) => lift.notes.length > 0)) suggestions.push("read_notes")
  suggestions.push("change_stimulus")
  return suggestions
}

function buildCoachAlertDetail(input: {
  checkIns: readonly DetailCheckIn[]
  exerciseNotes: readonly ExerciseNote[]
  kind: CoachTraineeAlertKind
  landmarksFor: (muscleSlug: string) => VolumeLandmarks
  logs: readonly DetailLog[]
  /** The alert's own metadata: the lifts a plateau named. */
  plateauExercises: readonly string[]
  raisedAt: Date
  summaries: readonly WeeklySummary[]
  workoutsPerWeek: number
}): CoachAlertDetail {
  const raisedAt = input.raisedAt
  const before = (date: Date) => date.getTime() <= raisedAt.getTime()
  const base = { kind: input.kind, raisedAt: raisedAt.toISOString() }

  switch (input.kind) {
    case "plateau": {
      const lifts = buildPlateauLifts({ exercises: input.plateauExercises, logs: input.logs, notes: input.exerciseNotes, raisedAt })
      const muscles = Array.from(new Set(lifts.flatMap((lift) => lift.primaryMuscles))).sort()
      const windowStart = raisedAt.getTime() - PLATEAU_WEEKS * WEEK_MS
      const plateau = {
        lifts,
        muscles: buildMuscleContext({ landmarksFor: input.landmarksFor, muscles, raisedAt, summaries: input.summaries }),
        readinessAverage: average(input.checkIns.flatMap((checkIn) =>
          checkIn.readinessScore != null && before(checkIn.checkInDate) && checkIn.checkInDate.getTime() >= windowStart ? [checkIn.readinessScore] : [],
        )),
      }
      return { ...base, plateau, suggestions: plateauSuggestions(plateau) }
    }

    case "missed_workouts": {
      const completedBefore = input.logs.filter((log) => before(log.startedAt))
      const sinceAlert = input.logs.length - completedBefore.length
      const lastWeek = completedBefore.filter((log) => weeksBefore(raisedAt, log.startedAt) === 0)
      return {
        ...base,
        missedWorkouts: {
          planned: input.workoutsPerWeek,
          sessions: lastWeek
            .slice()
            .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
            .map((log) => ({ date: dayKey(log.startedAt), workoutName: log.workoutName })),
          sinceAlert,
          weeks: Array.from({ length: MISSED_HISTORY_WEEKS }, (_, index) => {
            const weeksAgo = MISSED_HISTORY_WEEKS - 1 - index
            return { completed: completedBefore.filter((log) => weeksBefore(raisedAt, log.startedAt) === weeksAgo).length, weeksAgo }
          }),
        },
        suggestions: sinceAlert >= input.workoutsPerWeek && input.workoutsPerWeek > 0
          ? ["resolved", "check_schedule"]
          : ["message_trainee", "check_schedule"],
      }
    }

    case "low_readiness": {
      const from = raisedAt.getTime() - READINESS_HISTORY_DAYS * DAY_MS
      const checkIns = input.checkIns
        .filter((checkIn) => checkIn.checkInDate.getTime() >= from)
        .slice()
        .sort((left, right) => left.checkInDate.getTime() - right.checkInDate.getTime())
      const latestSince = checkIns.filter((checkIn) => !before(checkIn.checkInDate) && checkIn.readinessScore != null).at(-1)
      const recovered = latestSince?.readinessScore != null && latestSince.readinessScore >= LOW_READINESS
      return {
        ...base,
        lowReadiness: {
          checkIns: checkIns.map((checkIn) => ({
            date: dayKey(checkIn.checkInDate),
            fatigue: checkIn.fatigue,
            maxSoreness: checkIn.maxSoreness,
            note: checkIn.note,
            readiness: checkIn.readinessScore == null ? null : Math.round(checkIn.readinessScore),
            sinceAlert: !before(checkIn.checkInDate),
            sleepMinutes: checkIn.sleepMinutes,
            sleepQuality: checkIn.sleepQuality,
            stress: checkIn.stress,
          })),
          threshold: LOW_READINESS,
        },
        suggestions: recovered ? ["resolved", "review_recovery"] : ["lighter_session", "review_recovery", "message_trainee"],
      }
    }
  }
}

export { buildCoachAlertDetail, MISSED_HISTORY_WEEKS, PLATEAU_HISTORY_WEEKS, READINESS_HISTORY_DAYS }
export type { CoachAlertDetail, DetailCheckIn, DetailLog, ExerciseNote, Suggestion, WeeklySummary }
