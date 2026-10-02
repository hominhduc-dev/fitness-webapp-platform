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
/** A backfill reads sixteen weeks per user, so fewer of them fit in a pass. */
const BACKFILL_USERS_PER_PASS = 10
/** First pass shortly after boot, so a deploy starts backfilling without waiting six hours. */
const FIRST_PASS_DELAY_MS = 60 * 1000
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

type LearningCandidate = { id: string; notificationPreference: { timeZone: string } | null }

/** Runs `work` in the trainee's own time zone, so week bounds are their midnights. */
async function inTraineeZone(user: LearningCandidate, work: () => Promise<void>) {
  const timeZone = user.notificationPreference?.timeZone ?? DEFAULT_NOTIFICATION_PREFERENCES.timeZone
  try {
    await withRequestContext({ method: "JOB", path: "volume-learning", requestId: randomUUID(), timeZone }, work)
  } catch (error) {
    logger.warn("volume learning failed for user", { error, userId: user.id })
  }
}

/**
 * Summarises every completed week in the learning window for one user, oldest
 * first, then learns from them. This is what lets a trainee with months of
 * history get personal landmarks right away instead of after four new weeks.
 */
async function backfillUser(userId: string, now = new Date()) {
  const currentWeekStart = startOfUtcWeek(clientCalendarDay(now))
  let weeks = 0
  for (let weeksAgo = LEARNING_WEEKS; weeksAgo >= 1; weeksAgo -= 1) {
    if ((await summarizeWeek(userId, addUtcDays(currentWeekStart, -7 * weeksAgo))) > 0) weeks += 1
  }
  const learned = await learnForUser(userId, currentWeekStart)
  return { learned, weeks }
}

/**
 * One pass, in two parts. First, trainees with training in the learning window
 * but no summaries at all — those who trained before this feature existed —
 * get their whole window backfilled. Then everyone who trained last week and
 * has no summary for it gets that week, and their landmarks re-learned.
 * Each part is bounded; the rest are picked up by the next pass.
 */
async function runVolumeLearningPass(now = new Date()) {
  const db = ensurePrisma()
  const currentWeekStart = startOfUtcWeek(clientCalendarDay(now))
  const lastWeekStart = addUtcDays(currentWeekStart, -7)
  const select = { id: true, notificationPreference: { select: { timeZone: true } } } as const
  const trainedBetween = (from: Date, to: Date) => ({
    some: { completedAt: { not: null }, startedAt: { gte: addUtcDays(from, -1), lt: addUtcDays(to, 1) } },
  })

  const backfillCandidates = await db.user.findMany({
    select,
    take: BACKFILL_USERS_PER_PASS,
    where: {
      isActive: true,
      weeklyMuscleSummaries: { none: {} },
      workoutLogs: trainedBetween(addUtcDays(currentWeekStart, -7 * LEARNING_WEEKS), currentWeekStart),
    },
  })

  let backfilled = 0
  let summarized = 0
  let learned = 0
  for (const user of backfillCandidates) {
    await inTraineeZone(user, async () => {
      const result = await backfillUser(user.id, now)
      if (result.weeks > 0) backfilled += 1
      learned += result.learned
    })
  }

  const weeklyCandidates = await db.user.findMany({
    select,
    take: USERS_PER_PASS,
    where: {
      isActive: true,
      weeklyMuscleSummaries: { none: { weekStart: lastWeekStart } },
      workoutLogs: trainedBetween(lastWeekStart, currentWeekStart),
    },
  })

  for (const user of weeklyCandidates) {
    await inTraineeZone(user, async () => {
      const userWeekStart = addUtcDays(startOfUtcWeek(clientCalendarDay(now)), -7)
      if ((await summarizeWeek(user.id, userWeekStart)) > 0) summarized += 1
      learned += await learnForUser(user.id, addUtcDays(userWeekStart, 7))
    })
  }

  const users = backfillCandidates.length + weeklyCandidates.length
  if (backfilled > 0 || summarized > 0 || learned > 0) {
    logger.info("volume learning pass", { backfilled, learned, summarized, users })
  }
  return { backfilled, learned, summarized, users }
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
  setTimeout(() => void tick(), FIRST_PASS_DELAY_MS).unref()
  logger.info("volume learning scheduler started", { intervalMs: INTERVAL_MS })
}

function stopVolumeLearningScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}

export { backfillUser, learnForUser, runVolumeLearningPass, startVolumeLearningScheduler, stopVolumeLearningScheduler, summarizeWeek }
