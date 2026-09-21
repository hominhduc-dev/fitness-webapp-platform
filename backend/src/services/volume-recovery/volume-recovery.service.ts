import type { SerializedProfile } from "../auth.service"
import { AppError } from "../errors"
import { addUtcDays, clientCalendarDay, clientDayStart, formatUtcDateOnly, startOfUtcWeek } from "../fitness-data/shared/dates"
import { assertTrainee, ensurePrisma } from "../fitness-data/shared/guards"
import {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
  buildTrainingGuidance,
  buildVolumeRecommendation,
  calculateReadiness,
  classifyVolumeZone,
  DEFAULT_VOLUME_LANDMARKS,
  VOLUME_RECOVERY_ALGORITHM_VERSION,
  type VolumeLandmarks,
  type VolumeLogRecord,
} from "./analytics"

type RecoveryCheckInInput = {
  checkInDate: Date
  fatigue: number
  muscles: Array<{ muscleSlug: string; pain?: number; soreness: number }>
  note?: string
  sleepMinutes?: number
  sleepQuality?: number
  stress?: number
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function roundOrNull(value: number | null) {
  return value == null ? null : Math.round(value)
}

function serializeRecommendationRecord(record: {
  acceptedAt: Date | null
  dismissedAt: Date | null
  muscleSlug: string | null
  status: string
  weekStart: Date
}) {
  return {
    acceptedAt: record.acceptedAt,
    dismissedAt: record.dismissedAt,
    muscleSlug: record.muscleSlug,
    status: record.status,
    weekStart: formatUtcDateOnly(record.weekStart),
  }
}

function serializeCheckIn(checkIn: {
  algorithmVersion: string | null
  checkInDate: Date
  fatigue: number
  id: string
  muscles: Array<{ muscleSlug: string; pain: number | null; soreness: number }>
  note: string | null
  readinessScore: number | null
  sleepMinutes: number | null
  sleepQuality: number | null
  stress: number | null
}) {
  return {
    ...checkIn,
    checkInDate: formatUtcDateOnly(checkIn.checkInDate),
  }
}

async function upsertRecoveryCheckInForTrainee(profile: SerializedProfile, input: RecoveryCheckInInput) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const muscleSlugs = Array.from(new Set(input.muscles.map((muscle) => muscle.muscleSlug)))
  const validMuscleCount = await db.muscleRegion.count({ where: { slug: { in: muscleSlugs } } })

  if (validMuscleCount !== muscleSlugs.length) {
    throw new AppError("Một hoặc nhiều nhóm cơ không hợp lệ.", {
      code: "INVALID_MUSCLE_SLUG",
      status: 400,
    })
  }

  const readinessScore = calculateReadiness({
    fatigue: input.fatigue,
    sleepMinutes: input.sleepMinutes,
    sleepQuality: input.sleepQuality,
    soreness: average(input.muscles.map((muscle) => muscle.soreness)),
    stress: input.stress,
  })
  const muscleRows = input.muscles.map((muscle) => ({
    muscleSlug: muscle.muscleSlug,
    pain: muscle.pain,
    soreness: muscle.soreness,
  }))

  const checkIn = await db.$transaction(async (tx) => {
    const saved = await tx.recoveryCheckIn.upsert({
      create: {
        algorithmVersion: VOLUME_RECOVERY_ALGORITHM_VERSION,
        checkInDate: input.checkInDate,
        fatigue: input.fatigue,
        note: input.note?.trim() || undefined,
        readinessScore,
        sleepMinutes: input.sleepMinutes,
        sleepQuality: input.sleepQuality,
        stress: input.stress,
        userId: profile.id,
      },
      update: {
        algorithmVersion: VOLUME_RECOVERY_ALGORITHM_VERSION,
        fatigue: input.fatigue,
        note: input.note?.trim() || null,
        readinessScore,
        sleepMinutes: input.sleepMinutes ?? null,
        sleepQuality: input.sleepQuality ?? null,
        stress: input.stress ?? null,
      },
      where: {
        userId_checkInDate: {
          checkInDate: input.checkInDate,
          userId: profile.id,
        },
      },
    })

    await tx.muscleRecoveryRating.deleteMany({ where: { checkInId: saved.id } })
    if (muscleRows.length > 0) {
      await tx.muscleRecoveryRating.createMany({
        data: muscleRows.map((muscle) => ({ ...muscle, checkInId: saved.id })),
      })
    }

    return tx.recoveryCheckIn.findUniqueOrThrow({
      include: { muscles: { orderBy: { muscleSlug: "asc" } } },
      where: { id: saved.id },
    })
  })

  return serializeCheckIn(checkIn)
}

async function getVolumeRecoveryForTrainee(profile: SerializedProfile, requestedWeekStart?: Date) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const weekStart = startOfUtcWeek(requestedWeekStart ?? clientCalendarDay())
  const weekEnd = addUtcDays(weekStart, 7)
  const previousWeekStart = addUtcDays(weekStart, -7)

  const [logs, checkIns, profiles, storedRecommendations] = await Promise.all([
    db.workoutLog.findMany({
      orderBy: { startedAt: "asc" },
      select: { exerciseSnapshot: true, startedAt: true },
      where: {
        completedAt: { not: null },
        // Week bounds are day keys; the logs are instants, filtered by the client's midnights.
        startedAt: { gte: clientDayStart(previousWeekStart), lt: clientDayStart(weekEnd) },
        userId: profile.id,
      },
    }),
    db.recoveryCheckIn.findMany({
      include: { muscles: { orderBy: { muscleSlug: "asc" } } },
      orderBy: { checkInDate: "desc" },
      where: { checkInDate: { gte: weekStart, lt: weekEnd }, userId: profile.id },
    }),
    db.userMuscleVolumeProfile.findMany({
      where: { userId: profile.id },
    }),
    db.volumeRecommendation.findMany({
      where: { userId: profile.id, weekStart },
    }),
  ])

  const weekStartInstant = clientDayStart(weekStart)
  const currentLogs = logs.filter((log) => log.startedAt >= weekStartInstant) as VolumeLogRecord[]
  const previousLogs = logs.filter((log) => log.startedAt < weekStartInstant) as VolumeLogRecord[]
  const volume = aggregateWeeklyMuscleVolume(currentLogs)
  const performanceByMuscle = buildMusclePerformanceTrend(currentLogs, previousLogs)
  const latestCheckIn = checkIns[0] ?? null
  const sorenessByMuscle = new Map(latestCheckIn?.muscles.map((muscle) => [muscle.muscleSlug, muscle.soreness]) ?? [])
  const profileByMuscle = new Map(profiles.map((volumeProfile) => [volumeProfile.muscleSlug, volumeProfile]))
  // A recommendation the trainee already accepted or dismissed keeps that
  // answer for the rest of the week, so the card does not ask again.
  const statusByMuscle = new Map(storedRecommendations.flatMap((record) =>
    record.muscleSlug == null ? [] : [[record.muscleSlug, record.status] as const],
  ))
  const readinessScore = latestCheckIn?.readinessScore ?? null

  const muscles = volume.map((muscleVolume) => {
    const stored = profileByMuscle.get(muscleVolume.muscleSlug)
    const landmarks: VolumeLandmarks = stored && stored.mevSets != null && stored.mavMinSets != null && stored.mavMaxSets != null && stored.mrvSets != null
      ? {
          confidence: stored.confidence,
          mavMaxSets: stored.mavMaxSets,
          mavMinSets: stored.mavMinSets,
          mevSets: stored.mevSets,
          mrvSets: stored.mrvSets,
          source: stored.source,
        }
      : DEFAULT_VOLUME_LANDMARKS
    const zone = classifyVolumeZone(muscleVolume.effectiveSets, landmarks)
    const performanceChangePct = performanceByMuscle.get(muscleVolume.muscleSlug) ?? null
    const soreness = sorenessByMuscle.get(muscleVolume.muscleSlug) ?? null
    const recommendation = buildVolumeRecommendation({
      effectiveSets: muscleVolume.effectiveSets,
      landmarks,
      performanceChangePct,
      readinessScore,
      recoveryCheckInCount: checkIns.length,
      soreness,
      zone,
    })

    return {
      ...muscleVolume,
      landmarks,
      performanceChangePct,
      recommendation: {
        ...recommendation,
        status: statusByMuscle.get(muscleVolume.muscleSlug) ?? "pending",
      },
      soreness,
      zone,
    }
  })

  const averageRir = average(volume.flatMap((muscle) => (muscle.averageRir == null ? [] : [muscle.averageRir])))
  const performanceChangePct = average(Array.from(performanceByMuscle.values()))

  const worstSoreness = latestCheckIn && latestCheckIn.muscles.length > 0
    ? Math.max(...latestCheckIn.muscles.map((muscle) => muscle.soreness))
    : null

  return {
    algorithmVersion: VOLUME_RECOVERY_ALGORITHM_VERSION,
    checkIn: latestCheckIn ? serializeCheckIn(latestCheckIn) : null,
    guidance: buildTrainingGuidance({ muscles, readinessScore, soreness: worstSoreness }),
    confidence: {
      label: currentLogs.length >= 2 && checkIns.length >= 2 ? "medium" : "low",
      recoveryCheckIns: checkIns.length,
      workoutSessions: currentLogs.length,
    },
    muscles,
    readiness: {
      label: readinessScore == null ? "insufficient_data" : readinessScore >= 70 ? "ready" : readinessScore >= 50 ? "moderate" : "low",
      score: readinessScore,
    },
    summary: {
      averageRir: averageRir == null ? null : Math.round(averageRir * 10) / 10,
      hardSets: Math.round(volume.reduce((sum, muscle) => sum + muscle.directSets, 0)),
      performanceChangePct: performanceChangePct == null ? null : Math.round(performanceChangePct * 10) / 10,
    },
    weekEnd: formatUtcDateOnly(addUtcDays(weekEnd, -1)),
    weekStart: formatUtcDateOnly(weekStart),
  }
}

/**
 * A single readiness score answers "today"; the trend answers "is this week
 * going the way I think". Soreness collapses to the worst muscle, which is the
 * one that decides whether a session gets cut short.
 */
async function listRecoveryHistoryForTrainee(profile: SerializedProfile, days: number) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const since = addUtcDays(clientCalendarDay(), -(days - 1))
  const checkIns = await db.recoveryCheckIn.findMany({
    include: { muscles: { select: { soreness: true } } },
    orderBy: { checkInDate: "asc" },
    where: { checkInDate: { gte: since }, userId: profile.id },
  })

  const entries = checkIns.map((checkIn) => ({
    checkInDate: formatUtcDateOnly(checkIn.checkInDate),
    fatigue: checkIn.fatigue,
    readinessScore: checkIn.readinessScore,
    sleepMinutes: checkIn.sleepMinutes,
    sleepQuality: checkIn.sleepQuality,
    soreness: checkIn.muscles.length === 0 ? null : Math.max(...checkIn.muscles.map((muscle) => muscle.soreness)),
    stress: checkIn.stress,
  }))

  return {
    averages: {
      readinessScore: roundOrNull(average(entries.flatMap((entry) => (entry.readinessScore == null ? [] : [entry.readinessScore])))),
      sleepMinutes: roundOrNull(average(entries.flatMap((entry) => (entry.sleepMinutes == null ? [] : [entry.sleepMinutes])))),
    },
    days,
    entries,
  }
}

/**
 * The recommendation a trainee accepts has to be the one the server computed:
 * recomputing it here rather than trusting numbers from the request keeps a
 * client from writing its own set counts into the history.
 */
async function setVolumeRecommendationStatusForTrainee(
  profile: SerializedProfile,
  input: { muscleSlug: string; status: "accepted" | "applied" | "dismissed"; weekStart?: Date },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const weekStart = startOfUtcWeek(input.weekStart ?? clientCalendarDay())
  const recovery = await getVolumeRecoveryForTrainee(profile, weekStart)
  const muscle = recovery.muscles.find((entry) => entry.muscleSlug === input.muscleSlug)

  if (!muscle) {
    throw new AppError("Nhóm cơ này chưa có dữ liệu volume trong tuần đã chọn.", {
      code: "VOLUME_RECOMMENDATION_NOT_FOUND",
      status: 404,
    })
  }

  const existing = await db.volumeRecommendation.findFirst({
    where: { muscleSlug: input.muscleSlug, userId: profile.id, weekStart },
  })
  const now = new Date()
  // `applied` follows `accepted`, so it keeps the earlier acceptance rather
  // than overwriting when it happened.
  const timestamps = input.status === "accepted"
    ? { acceptedAt: now, appliedAt: null, dismissedAt: null }
    : input.status === "applied"
      ? { acceptedAt: existing?.acceptedAt ?? now, appliedAt: now, dismissedAt: null }
      : { acceptedAt: null, appliedAt: null, dismissedAt: now }
  const data = {
    action: muscle.recommendation.action,
    algorithmVersion: VOLUME_RECOVERY_ALGORITHM_VERSION,
    confidence: muscle.recommendation.confidence,
    currentSets: muscle.recommendation.currentSets,
    reasons: muscle.recommendation.reasons,
    recommendedSets: muscle.recommendation.recommendedSets,
    status: input.status,
    ...timestamps,
  }

  const saved = existing
    ? await db.volumeRecommendation.update({ data, where: { id: existing.id } })
    : await db.volumeRecommendation.create({
        data: { ...data, muscleSlug: input.muscleSlug, userId: profile.id, weekStart },
      })

  return serializeRecommendationRecord(saved)
}

/**
 * Landmarks a coach or trainee sets by hand outrank the system defaults, so the
 * profile is stamped `coach` and given full confidence — the volume engine
 * weighs that confidence when it decides how far to move a recommendation.
 */
async function upsertVolumeLandmarksForTrainee(
  profile: SerializedProfile,
  input: { mavMaxSets: number; mavMinSets: number; mevSets: number; mrvSets: number; muscleSlug: string },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  if (!(input.mevSets <= input.mavMinSets && input.mavMinSets <= input.mavMaxSets && input.mavMaxSets <= input.mrvSets)) {
    throw new AppError("Ngưỡng phải tăng dần: MEV ≤ MAV tối thiểu ≤ MAV tối đa ≤ MRV.", {
      code: "INVALID_VOLUME_LANDMARKS",
      status: 400,
    })
  }

  const muscleExists = await db.muscleRegion.count({ where: { slug: input.muscleSlug } })
  if (muscleExists === 0) {
    throw new AppError("Nhóm cơ không hợp lệ.", { code: "INVALID_MUSCLE_SLUG", status: 400 })
  }

  const existing = await db.userMuscleVolumeProfile.findFirst({
    where: { muscleSlug: input.muscleSlug, userId: profile.id },
  })
  const data = {
    confidence: 1,
    mavMaxSets: input.mavMaxSets,
    mavMinSets: input.mavMinSets,
    mevSets: input.mevSets,
    mrvSets: input.mrvSets,
    source: "coach" as const,
  }

  const saved = existing
    ? await db.userMuscleVolumeProfile.update({ data, where: { id: existing.id } })
    : await db.userMuscleVolumeProfile.create({
        data: { ...data, muscleSlug: input.muscleSlug, userId: profile.id },
      })

  return {
    confidence: saved.confidence,
    mavMaxSets: saved.mavMaxSets,
    mavMinSets: saved.mavMinSets,
    mevSets: saved.mevSets,
    mrvSets: saved.mrvSets,
    muscleSlug: saved.muscleSlug,
    source: saved.source,
  }
}

/** Restores the system defaults by dropping the stored profile. */
async function resetVolumeLandmarksForTrainee(profile: SerializedProfile, muscleSlug: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  await db.userMuscleVolumeProfile.deleteMany({ where: { muscleSlug, userId: profile.id } })

  return { muscleSlug, ...DEFAULT_VOLUME_LANDMARKS }
}

export {
  getVolumeRecoveryForTrainee,
  listRecoveryHistoryForTrainee,
  resetVolumeLandmarksForTrainee,
  setVolumeRecommendationStatusForTrainee,
  upsertRecoveryCheckInForTrainee,
  upsertVolumeLandmarksForTrainee,
}
export type { RecoveryCheckInInput }
