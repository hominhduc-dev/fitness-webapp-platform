import { NotificationType } from "@prisma/client"

import type { SerializedProfile } from "../auth.service"
import { NotFoundError } from "../errors"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "../fitness-data/shared/guards"
import type { VolumeLandmarks } from "../volume-recovery/analytics"
import { systemLandmarksForMuscle } from "../volume-recovery/volume-landmarks"
import { clientCalendarDay, formatUtcDateOnly, startOfUtcWeek } from "../fitness-data/shared/dates"
import { buildCoachAlertDetail, MISSED_HISTORY_WEEKS, READINESS_HISTORY_DAYS, VOLUME_WEEKS } from "./coach-alert-detail"
import { PLATEAU_LOOKBACK_DAYS, type CoachTraineeAlertKind } from "./coach-trainee-alerts"

const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_DAYS = Math.max(PLATEAU_LOOKBACK_DAYS, MISSED_HISTORY_WEEKS * 7, VOLUME_WEEKS * 7)

function readExerciseNames(metadata: unknown) {
  const exercises = metadata && typeof metadata === "object" ? (metadata as { exercises?: unknown }).exercises : undefined
  return Array.isArray(exercises) ? exercises.filter((entry): entry is string => typeof entry === "string") : []
}

function readNumber(metadata: unknown, key: string) {
  const value = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>)[key] : undefined
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Workout exercise ids in the logs' snapshots, whose coach notes tell older trainee notes apart. */
function workoutExerciseIdsOf(logs: ReadonlyArray<{ exerciseSnapshot: unknown }>) {
  const ids = new Set<string>()
  for (const log of logs) {
    if (!Array.isArray(log.exerciseSnapshot)) continue
    for (const entry of log.exerciseSnapshot as Array<{ id?: unknown }>) {
      if (typeof entry?.id === "string" && /^[0-9a-f-]{36}$/i.test(entry.id)) ids.add(entry.id)
    }
  }
  return Array.from(ids)
}

/**
 * One coach alert with its evidence. The alert is found by what names it — the
 * trainee, the kind and the week it was raised for — so both the bell and a
 * push link can open it.
 */
async function getCoachTraineeAlertDetail(
  profile: SerializedProfile,
  input: { kind: CoachTraineeAlertKind; traineeId: string; weekStart: string },
) {
  assertCoach(profile)
  const trainee = await assertCoachOwnsTrainee(profile.id, input.traineeId)
  const db = ensurePrisma()

  const notification = await db.notification.findFirst({
    select: { createdAt: true, id: true, metadata: true },
    where: {
      dedupeKey: `coach_trainee_alert:${profile.id}:${input.traineeId}:${input.kind}:${input.weekStart}`,
      type: NotificationType.coach_trainee_alert,
      userId: profile.id,
    },
  })
  if (!notification) throw new NotFoundError("Không tìm thấy cảnh báo này.")

  const raisedAt = notification.createdAt
  const since = new Date(raisedAt.getTime() - HISTORY_DAYS * DAY_MS)
  const [logs, checkIns, profiles, assignment] = await Promise.all([
    db.workoutLog.findMany({
      orderBy: { startedAt: "asc" },
      select: { exerciseSnapshot: true, startedAt: true, workoutSnapshot: true },
      where: { completedAt: { not: null }, startedAt: { gte: since }, userId: trainee.id },
    }),
    db.recoveryCheckIn.findMany({
      include: { muscles: { select: { soreness: true } } },
      orderBy: { checkInDate: "asc" },
      where: { checkInDate: { gte: new Date(raisedAt.getTime() - Math.max(READINESS_HISTORY_DAYS, 21) * DAY_MS) }, userId: trainee.id },
    }),
    input.kind === "plateau" ? db.userMuscleVolumeProfile.findMany({ where: { userId: trainee.id } }) : Promise.resolve([]),
    db.programAssignment.findFirst({
      orderBy: { assignedAt: "desc" },
      select: { program: { select: { archivedAt: true, id: true, name: true, workoutsPerWeek: true } } },
      where: { program: { archivedAt: null }, userId: trainee.id },
    }),
  ])
  const coachNotes = input.kind === "plateau"
    ? new Map((await db.workoutExercise.findMany({
        select: { id: true, notes: true },
        where: { id: { in: workoutExerciseIdsOf(logs) } },
      })).map((entry) => [entry.id, entry.notes]))
    : new Map<string, string | null>()

  const profileByMuscle = new Map(profiles.map((entry) => [entry.muscleSlug, entry]))
  const landmarksFor = (muscleSlug: string): VolumeLandmarks => {
    const stored = profileByMuscle.get(muscleSlug)
    return stored && stored.mevSets != null && stored.mavMinSets != null && stored.mavMaxSets != null && stored.mrvSets != null
      ? { confidence: stored.confidence, mavMaxSets: stored.mavMaxSets, mavMinSets: stored.mavMinSets, mevSets: stored.mevSets, mrvSets: stored.mrvSets, source: stored.source }
      : systemLandmarksForMuscle(muscleSlug)
  }

  const program = assignment?.program ?? null
  const detail = buildCoachAlertDetail({
    checkIns: checkIns.map((checkIn) => ({
      checkInDate: checkIn.checkInDate,
      fatigue: checkIn.fatigue,
      maxSoreness: checkIn.muscles.length > 0 ? Math.max(...checkIn.muscles.map((muscle) => muscle.soreness)) : null,
      note: checkIn.note,
      readinessScore: checkIn.readinessScore,
      sleepMinutes: checkIn.sleepMinutes,
      sleepQuality: checkIn.sleepQuality,
      stress: checkIn.stress,
    })),
    coachNotes,
    kind: input.kind,
    landmarksFor,
    logs: logs.map((log) => ({
      exerciseSnapshot: log.exerciseSnapshot,
      startedAt: log.startedAt,
      workoutSnapshot: log.workoutSnapshot,
      workoutName: log.workoutSnapshot && typeof log.workoutSnapshot === "object" && !Array.isArray(log.workoutSnapshot)
        ? ((log.workoutSnapshot as { name?: unknown }).name as string | undefined) ?? null
        : null,
    })),
    plateauExercises: readExerciseNames(notification.metadata),
    raisedAt,
    // The trainee's own week, as the volume engine buckets it.
    weekStartOf: (date) => formatUtcDateOnly(startOfUtcWeek(clientCalendarDay(date))),
    // The plan as it was when the alert was raised, when the alert recorded it.
    workoutsPerWeek: readNumber(notification.metadata, "planned") ?? program?.workoutsPerWeek ?? 0,
  })

  return {
    ...detail,
    notificationId: notification.id,
    program: program ? { id: program.id, name: program.name, workoutsPerWeek: program.workoutsPerWeek } : null,
    trainee: { id: trainee.id, name: trainee.name },
    weekStart: input.weekStart,
  }
}

export { getCoachTraineeAlertDetail }
