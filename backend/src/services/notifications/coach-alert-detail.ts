import type { Prisma } from "@prisma/client"

import type { Prescription } from "../../domain/exercise-exposure"
import {
  getSnapshotExerciseId,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
} from "../fitness-data/shared/workout-snapshot"
import {
  aggregateWeeklyMuscleVolume,
  classifyVolumeZone,
  type VolumeLandmarks,
  type VolumeZone,
} from "../volume-recovery/analytics"
import {
  buildLiftHistories,
  LOW_READINESS,
  PLATEAU_EXPOSURES,
  progressedSince,
  type CoachTraineeAlertKind,
  type LiftExposure,
  type LiftWeek,
} from "./coach-trainee-alerts"

/**
 * The evidence behind one coach alert, so the coach can see why it was raised
 * and what to do about it rather than only a sentence in the bell.
 *
 * Everything is read as of when the alert was raised, as the detection did, and
 * whatever was trained since is shown apart: it says whether the alert still
 * stands. Pure: the service loads the rows.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** Sessions of a stalled lift shown, newest last. */
const MAX_EXPOSURES_SHOWN = 6
/** Weeks of muscle volume shown around a plateau. */
const VOLUME_WEEKS = 4
const MISSED_HISTORY_WEEKS = 4
const READINESS_HISTORY_DAYS = 14
/** Readiness is averaged over the three weeks before a plateau alert. */
const PLATEAU_READINESS_DAYS = 21
/** Weekly sets at or above this share of MRV point at recovery, not stimulus. */
const NEAR_MRV_SHARE = 0.9
/** Average readiness under this over the window points at recovery. */
const LOW_AVERAGE_READINESS = 60

type DetailLog = {
  exerciseSnapshot: Prisma.JsonValue | null
  startedAt: Date
  workoutName: string | null
  workoutSnapshot?: Prisma.JsonValue | null
}
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

type Suggestion =
  | "change_stimulus"
  | "check_schedule"
  | "lighter_session"
  | "message_trainee"
  | "read_notes"
  | "reduce_volume"
  | "resolved"
  | "review_recovery"

/**
 * - judged: one of the comparable sessions the plateau was called on
 * - earlier: comparable, but older than the ones judged
 * - not_comparable: under a different prescription, so another block
 * - deload / intentional: a lighter session the plan asked for, left out
 */
type ExposureStatus = "deload" | "earlier" | "intentional" | "judged" | "not_comparable"

type ExposureView = {
  bestE1rm: number
  date: string
  prescription: Prescription
  status: ExposureStatus
  topReps: number | null
  topWeight: number | null
}

type PlateauLift = {
  /** Oldest first. */
  exposures: ExposureView[]
  key: string
  name: string
  notes: Array<{ date: string; note: string }>
  primaryMuscles: string[]
  sinceAlert: { bestE1rm: number | null; progressed: boolean; sessions: number; topWeight: number | null }
}

type MuscleContext = {
  landmarks: { mavMaxSets: number; mavMinSets: number; mevSets: number; mrvSets: number; source: VolumeLandmarks["source"] }
  muscleSlug: string
  /** Oldest first; weeks the muscle was not trained are left out. */
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
    judgedSessions: number
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
const liftKey = (exercise: ReturnType<typeof parseWorkoutLogSnapshotExercises>[number]) =>
  getSnapshotVariationId(exercise) ?? getSnapshotExerciseId(exercise)

function average(values: readonly number[]) {
  return values.length > 0 ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function exposureStatus(exposure: LiftExposure, chain: readonly LiftExposure[]): ExposureStatus {
  if (exposure.exclusion) return exposure.exclusion
  const index = chain.indexOf(exposure)
  if (index < 0) return "not_comparable"
  return index < PLATEAU_EXPOSURES ? "judged" : "earlier"
}

function viewExposure(exposure: LiftExposure, status: ExposureStatus): ExposureView {
  return {
    bestE1rm: round1(exposure.bestE1rm),
    date: dayKey(exposure.date),
    prescription: exposure.prescription,
    status,
    topReps: exposure.topWeight > 0 ? exposure.repsByWeight.get(exposure.topWeight) ?? null : null,
    topWeight: exposure.topWeight > 0 ? exposure.topWeight : null,
  }
}

/**
 * The trainee's own note on each exercise of each session: recorded apart from
 * the coach's since logs carry `traineeNote`; on older logs, a note that differs
 * from the coach's current note for that slot.
 */
function traineeNotesByLift(logs: readonly DetailLog[], coachNotes: ReadonlyMap<string, string | null>) {
  const notes = new Map<string, Array<{ date: string; note: string }>>()
  for (const log of logs) {
    for (const exercise of parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)) {
      const key = liftKey(exercise)
      const entry = exercise as { id?: unknown; notes?: unknown; traineeNote?: unknown }
      const recorded = typeof entry.traineeNote === "string" ? entry.traineeNote.trim() : null
      const legacy = recorded == null && typeof entry.notes === "string" && typeof entry.id === "string"
        && entry.notes.trim() && entry.notes.trim() !== (coachNotes.get(entry.id) ?? "").trim()
        ? entry.notes.trim()
        : null
      const note = recorded || legacy
      if (!key || !note) continue
      notes.set(key, [...(notes.get(key) ?? []), { date: dayKey(log.startedAt), note }])
    }
  }
  return notes
}

function buildPlateauLifts(input: {
  coachNotes: ReadonlyMap<string, string | null>
  exercises: readonly string[]
  logs: readonly DetailLog[]
  raisedAt: Date
}): PlateauLift[] {
  const named = new Set(input.exercises)
  const before = input.logs.filter((log) => log.startedAt.getTime() <= input.raisedAt.getTime())
  const after = input.logs.filter((log) => log.startedAt.getTime() > input.raisedAt.getTime())
  const notes = traineeNotesByLift(input.logs, input.coachNotes)
  // Every session since the alert, however long ago it was raised.
  const latest = after.at(-1)?.startedAt
  const sinceHistories = new Map(
    (latest ? buildLiftHistories(after, latest, Number.POSITIVE_INFINITY) : []).map((history) => [history.key, history]),
  )

  return buildLiftHistories(before, input.raisedAt)
    .filter((history) => named.has(history.name))
    .map((history): PlateauLift => {
      // Progress since means beating the best of the sessions it was judged on.
      const judged = history.chain.slice(0, PLATEAU_EXPOSURES)
      const best: LiftWeek = { bestE1rm: 0, repsByWeight: new Map(), topWeight: 0 }
      for (const exposure of judged) {
        best.bestE1rm = Math.max(best.bestE1rm, exposure.bestE1rm)
        best.topWeight = Math.max(best.topWeight, exposure.topWeight)
        for (const [weight, reps] of exposure.repsByWeight) best.repsByWeight.set(weight, Math.max(best.repsByWeight.get(weight) ?? 0, reps))
      }
      const since = sinceHistories.get(history.key)?.exposures ?? []
      return {
        exposures: history.exposures
          .slice(0, MAX_EXPOSURES_SHOWN)
          .reverse()
          .map((exposure) => viewExposure(exposure, exposureStatus(exposure, history.chain))),
        key: history.key,
        name: history.name,
        notes: notes.get(history.key) ?? [],
        primaryMuscles: history.primaryMuscles,
        sinceAlert: {
          bestE1rm: since.length > 0 ? round1(Math.max(...since.map((exposure) => exposure.bestE1rm))) : null,
          progressed: since.length > 0 && progressedSince(best, since),
          sessions: since.length,
          topWeight: since.length > 0 ? Math.max(...since.map((exposure) => exposure.topWeight)) || null : null,
        },
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Weekly volume of the given muscles over the weeks before the alert, counted
 * straight from the logs so it does not wait on the weekly summary job.
 */
function buildMuscleContext(input: {
  landmarksFor: (muscleSlug: string) => VolumeLandmarks
  logs: readonly DetailLog[]
  muscles: readonly string[]
  raisedAt: Date
  weekStartOf: (date: Date) => string
}): MuscleContext[] {
  const from = input.raisedAt.getTime() - VOLUME_WEEKS * WEEK_MS
  const byWeek = new Map<string, DetailLog[]>()
  for (const log of input.logs) {
    if (log.startedAt.getTime() < from || log.startedAt.getTime() > input.raisedAt.getTime()) continue
    const week = input.weekStartOf(log.startedAt)
    byWeek.set(week, [...(byWeek.get(week) ?? []), log])
  }
  const volumeByWeek = Array.from(byWeek.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, logs]) => ({ volume: aggregateWeeklyMuscleVolume(logs), weekStart }))

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
      weeks: volumeByWeek.flatMap(({ volume, weekStart }) => {
        const muscle = volume.find((entry) => entry.muscleSlug === muscleSlug)
        return muscle
          ? [{ averageRir: muscle.averageRir, effectiveSets: round1(muscle.effectiveSets), weekStart, zone: classifyVolumeZone(muscle.effectiveSets, landmarks) }]
          : []
      }),
    }
  })
}

function plateauSuggestions(plateau: NonNullable<CoachAlertDetail["plateau"]>): Suggestion[] {
  const suggestions: Suggestion[] = []
  if (plateau.lifts.length > 0 && plateau.lifts.every((lift) => lift.sinceAlert.progressed)) suggestions.push("resolved")
  const nearMrv = plateau.muscles.some((muscle) => {
    const mean = average(muscle.weeks.map((week) => week.effectiveSets))
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
  /** The coach's current note per workout exercise, to tell older trainee notes apart. */
  coachNotes: ReadonlyMap<string, string | null>
  kind: CoachTraineeAlertKind
  landmarksFor: (muscleSlug: string) => VolumeLandmarks
  logs: readonly DetailLog[]
  /** The alert's own metadata: the lifts a plateau named. */
  plateauExercises: readonly string[]
  raisedAt: Date
  /** The trainee's week a session falls in, as a day key. */
  weekStartOf: (date: Date) => string
  workoutsPerWeek: number
}): CoachAlertDetail {
  const raisedAt = input.raisedAt
  const before = (date: Date) => date.getTime() <= raisedAt.getTime()
  const base = { kind: input.kind, raisedAt: raisedAt.toISOString() }

  switch (input.kind) {
    case "plateau": {
      const lifts = buildPlateauLifts({ coachNotes: input.coachNotes, exercises: input.plateauExercises, logs: input.logs, raisedAt })
      const muscles = Array.from(new Set(lifts.flatMap((lift) => lift.primaryMuscles))).sort()
      const windowStart = raisedAt.getTime() - PLATEAU_READINESS_DAYS * DAY_MS
      const plateau = {
        judgedSessions: PLATEAU_EXPOSURES,
        lifts,
        muscles: buildMuscleContext({ landmarksFor: input.landmarksFor, logs: input.logs, muscles, raisedAt, weekStartOf: input.weekStartOf }),
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

export { buildCoachAlertDetail, MISSED_HISTORY_WEEKS, READINESS_HISTORY_DAYS, VOLUME_WEEKS }
export type { CoachAlertDetail, DetailCheckIn, DetailLog, ExposureStatus, Suggestion }
