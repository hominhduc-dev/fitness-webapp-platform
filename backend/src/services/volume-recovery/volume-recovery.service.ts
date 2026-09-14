import type { SerializedProfile } from "../auth.service"
import { AppError } from "../errors"
import { addUtcDays, formatUtcDateOnly, startOfUtcWeek } from "../fitness-data/shared/dates"
import { assertTrainee, ensurePrisma } from "../fitness-data/shared/guards"
import {
  aggregateWeeklyMuscleVolume,
  buildMusclePerformanceTrend,
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

  const weekStart = startOfUtcWeek(requestedWeekStart ?? new Date())
  const weekEnd = addUtcDays(weekStart, 7)
  const previousWeekStart = addUtcDays(weekStart, -7)

  const [logs, checkIns, profiles] = await Promise.all([
    db.workoutLog.findMany({
      orderBy: { startedAt: "asc" },
      select: { exerciseSnapshot: true, startedAt: true },
      where: {
        completedAt: { not: null },
        startedAt: { gte: previousWeekStart, lt: weekEnd },
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
  ])

  const currentLogs = logs.filter((log) => log.startedAt >= weekStart) as VolumeLogRecord[]
  const previousLogs = logs.filter((log) => log.startedAt < weekStart) as VolumeLogRecord[]
  const volume = aggregateWeeklyMuscleVolume(currentLogs)
  const performanceByMuscle = buildMusclePerformanceTrend(currentLogs, previousLogs)
  const latestCheckIn = checkIns[0] ?? null
  const sorenessByMuscle = new Map(latestCheckIn?.muscles.map((muscle) => [muscle.muscleSlug, muscle.soreness]) ?? [])
  const profileByMuscle = new Map(profiles.map((volumeProfile) => [volumeProfile.muscleSlug, volumeProfile]))
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
      recommendation,
      soreness,
      zone,
    }
  })

  const averageRir = average(volume.flatMap((muscle) => (muscle.averageRir == null ? [] : [muscle.averageRir])))
  const performanceChangePct = average(Array.from(performanceByMuscle.values()))

  return {
    algorithmVersion: VOLUME_RECOVERY_ALGORITHM_VERSION,
    checkIn: latestCheckIn ? serializeCheckIn(latestCheckIn) : null,
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

export { getVolumeRecoveryForTrainee, upsertRecoveryCheckInForTrainee }
export type { RecoveryCheckInInput }
