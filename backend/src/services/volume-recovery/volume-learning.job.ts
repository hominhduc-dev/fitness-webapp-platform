import { randomUUID } from "node:crypto"

import { env } from "../../config/env"
import { learnVolumeLandmarks, type LearningWeek } from "../../domain/volume-learning"
import { logger, withRequestContext } from "../../lib/logger"
import { addUtcDays, clientCalendarDay, clientDayStart, startOfUtcWeek } from "../fitness-data/shared/dates"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../notifications/notification-preferences.service"
import { aggregateWeeklyMuscleVolume, buildMusclePerformanceTrend, type VolumeLogRecord } from "./analytics"
import { systemLandmarksForMuscle } from "./volume-landmarks"

/**
 * Background learning of each trainee's own volume landmarks.
 *
 * Once a week has ended, its training is folded into one WeeklyMuscleSummary
 * row per muscle — sets, effort, the performance change against the sessions
 * before it, readiness and soreness. The trainee's last months of rows then
 * update their UserMuscleVolumeProfile, stamped `learned`. Landmarks a coach
 * set by hand are never overwritten.
 */

const INTERVAL_MS = 6 * 60 * 60 * 1000
const USERS_PER_PASS = 50
/** History the learning reads: about four months of weeks. */
const LEARNING_WEEKS = 16
const PERFORMANCE_LOOKBACK_DAYS = 14

function average(values: readonly number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

/** Rewrites one user's summaries for the week starting `weekStart` (a day key). */
async function summarizeWeek(userId: string, weekStart: Date) {
  const db = ensurePrisma()
  const weekEnd = addUtcDays(weekStart, 7)
  const [logs, checkIns] = await Promise.all([
    db.workoutLog.findMany({
      orderBy: { startedAt: "asc" },
      select: { exerciseSnapshot: true, startedAt: true },
      where: {
        completedAt: { not: null },
        startedAt: { gte: clientDayStart(addUtcDays(weekStart, -PERFORMANCE_LOOKBACK_DAYS)), lt: clientDayStart(weekEnd) },
        userId,
      },
    }),
    db.recoveryCheckIn.findMany({
      include: { muscles: { select: { muscleSlug: true, soreness: true } } },
      where: { checkInDate: { gte: weekStart, lt: weekEnd }, userId },
    }),
  ])

  const weekStartInstant = clientDayStart(weekStart)
  const weekLogs = logs.filter((log) => log.startedAt >= weekStartInstant) as VolumeLogRecord[]
  const earlierLogs = logs.filter((log) => log.startedAt < weekStartInstant) as VolumeLogRecord[]
  const volume = aggregateWeeklyMuscleVolume(weekLogs)
  const performance = buildMusclePerformanceTrend(weekLogs, earlierLogs)
  const averageReadiness = average(checkIns.flatMap((checkIn) => (checkIn.readinessScore == null ? [] : [checkIn.readinessScore])))
  const sorenessByMuscle = new Map<string, number>()
  for (const rating of checkIns.flatMap((checkIn) => checkIn.muscles)) {
    sorenessByMuscle.set(rating.muscleSlug, Math.max(sorenessByMuscle.get(rating.muscleSlug) ?? 0, rating.soreness))
  }

  const knownMuscles = new Set(
    (await db.muscleRegion.findMany({ select: { slug: true }, where: { slug: { in: volume.map((muscle) => muscle.muscleSlug) } } }))
      .map((muscle) => muscle.slug),
  )
  const rows = volume
    .filter((muscle) => knownMuscles.has(muscle.muscleSlug))
    .map((muscle) => ({
      averageReadiness: averageReadiness == null ? null : Math.round(averageReadiness * 10) / 10,
      averageRir: muscle.averageRir,
      directSets: muscle.directSets,
      effectiveSets: muscle.effectiveSets,
      id: randomUUID(),
      indirectSets: muscle.indirectSets,
      lowConfidenceSets: muscle.lowConfidenceSets,
      maxSoreness: sorenessByMuscle.get(muscle.muscleSlug) ?? null,
      muscleSlug: muscle.muscleSlug,
      performanceChangePct: performance.get(muscle.muscleSlug) ?? null,
      updatedAt: new Date(),
      userId,
      weekStart,
    }))

  await db.$transaction([
    db.weeklyMuscleSummary.deleteMany({ where: { userId, weekStart } }),
    db.weeklyMuscleSummary.createMany({ data: rows }),
  ])

  return rows.length
}

/** Re-learns every muscle the user has history for, leaving coach-set ones alone. */
async function learnForUser(userId: string, currentWeekStart: Date) {
  const db = ensurePrisma()
  const [summaries, profiles] = await Promise.all([
    db.weeklyMuscleSummary.findMany({
      orderBy: { weekStart: "asc" },
      where: { userId, weekStart: { gte: addUtcDays(currentWeekStart, -7 * LEARNING_WEEKS), lt: currentWeekStart } },
    }),
    db.userMuscleVolumeProfile.findMany({ where: { userId } }),
  ])

  const weeksByMuscle = new Map<string, LearningWeek[]>()
  for (const summary of summaries) {
    const weeks = weeksByMuscle.get(summary.muscleSlug) ?? []
    weeks.push(summary)
    weeksByMuscle.set(summary.muscleSlug, weeks)
  }

  let learned = 0
  for (const [muscleSlug, weeks] of weeksByMuscle) {
    const existing = profiles.find((profile) => profile.muscleSlug === muscleSlug)
    if (existing?.source === "coach") continue

    const result = learnVolumeLandmarks(systemLandmarksForMuscle(muscleSlug), weeks)
    if (!result) continue

    const data = { ...result, source: "learned" as const }
    if (existing) {
      await db.userMuscleVolumeProfile.update({ data, where: { id: existing.id } })
    } else {
      await db.userMuscleVolumeProfile.create({ data: { ...data, muscleSlug, userId } })
    }
    learned += 1
  }

  return learned
}

/**
 * One pass: summarise last week for trainees who trained in it and have no
 * summary for it yet, then re-learn their landmarks. Bounded per pass; the rest
 * are picked up by the next one.
 */
async function runVolumeLearningPass(now = new Date()) {
  const db = ensurePrisma()
  const currentWeekStart = startOfUtcWeek(clientCalendarDay(now))
  const lastWeekStart = addUtcDays(currentWeekStart, -7)

  const candidates = await db.user.findMany({
    select: { id: true, notificationPreference: { select: { timeZone: true } } },
    take: USERS_PER_PASS,
    where: {
      isActive: true,
      weeklyMuscleSummaries: { none: { weekStart: lastWeekStart } },
      workoutLogs: {
        some: {
          completedAt: { not: null },
          startedAt: { gte: addUtcDays(lastWeekStart, -1), lt: addUtcDays(currentWeekStart, 1) },
        },
      },
    },
  })

  let summarized = 0
  let learned = 0
  for (const user of candidates) {
    const timeZone = user.notificationPreference?.timeZone ?? DEFAULT_NOTIFICATION_PREFERENCES.timeZone
    try {
      // Week bounds are the trainee's own midnights, as everywhere else.
      await withRequestContext({ method: "JOB", path: "volume-learning", requestId: randomUUID(), timeZone }, async () => {
        const userWeekStart = addUtcDays(startOfUtcWeek(clientCalendarDay(now)), -7)
        if ((await summarizeWeek(user.id, userWeekStart)) > 0) summarized += 1
        learned += await learnForUser(user.id, addUtcDays(userWeekStart, 7))
      })
    } catch (error) {
      logger.warn("volume learning failed for user", { error, userId: user.id })
    }
  }

  if (summarized > 0 || learned > 0) logger.info("volume learning pass", { learned, summarized, users: candidates.length })
  return { learned, summarized, users: candidates.length }
}

let timer: NodeJS.Timeout | null = null
let running = false

function startVolumeLearningScheduler() {
  if (timer || !env.volumeLearningEnabled || !env.databaseUrl) return

  const tick = async () => {
    if (running) return
    running = true
    try {
      await runVolumeLearningPass()
    } catch (error) {
      logger.error("volume learning pass failed", { error })
    } finally {
      running = false
    }
  }

  timer = setInterval(() => void tick(), INTERVAL_MS)
  timer.unref()
  logger.info("volume learning scheduler started", { intervalMs: INTERVAL_MS })
}

function stopVolumeLearningScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}

export { learnForUser, runVolumeLearningPass, startVolumeLearningScheduler, stopVolumeLearningScheduler, summarizeWeek }
