import { MealStatus, NotificationType, UserRole } from "@prisma/client"
import { randomUUID } from "node:crypto"

import { env } from "../../config/env"
import { logger, withRequestContext } from "../../lib/logger"
import { findTodayScheduleEntryForTrainee } from "../fitness-data/core"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { buildCoachWeeklyReviewDraft } from "./coach-weekly-review"
import { createAndPushNotification, findUsedDedupeKeys, type NotificationDraft } from "./notification-dispatch.service"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  MEAL_REMINDER_TYPES,
  mealReminderColumns,
  type MealReminderType,
} from "./notification-preferences.service"
import {
  formatClockTime12h,
  formatElapsed,
  getLocalClock,
  isDailyReminderDue,
  isWorkoutReminderDue,
  isWorkoutSessionLeftOpen,
  MEAL_REMINDER_CATCH_UP_MINUTES,
  OPEN_SESSION_IDLE_MS,
  OPEN_SESSION_MAX_AGE_MS,
  OPEN_SESSION_MIN_AGE_MS,
  type LocalClock,
} from "./reminder-schedule"

/**
 * Scheduled notifications, produced by polling rather than a job queue.
 *
 * Each tick recomputes what is due from the database, so a restart or a missed
 * tick loses nothing inside the catch-up window. Every reminder carries a
 * deterministic `dedupeKey`, which makes a tick idempotent and lets several
 * backend instances run the scheduler side by side without double-sending.
 */

type JobResult = { candidates: number; sent: number }

/** Sends drafts whose dedupe key is unused. Sequential: volume is small and it keeps the pool free. */
async function sendNewDrafts(drafts: NotificationDraft[]): Promise<JobResult> {
  const used = await findUsedDedupeKeys(drafts.flatMap((draft) => (draft.dedupeKey ? [draft.dedupeKey] : [])))
  let sent = 0

  for (const draft of drafts) {
    if (draft.dedupeKey && used.has(draft.dedupeKey)) continue

    try {
      if (await createAndPushNotification(draft)) sent += 1
    } catch (error) {
      logger.warn("scheduled notification failed", { dedupeKey: draft.dedupeKey, error, userId: draft.userId })
    }
  }

  return { candidates: drafts.length, sent }
}

/**
 * A started session nobody finished: started 2h+ ago and idle 30m+.
 * Notified once per session — the key includes `startedAt`, so starting the same
 * workout again later is a new session.
 */
async function runOpenWorkoutSessionJob(now: Date) {
  const db = ensurePrisma()
  const drafts = await db.workoutSessionDraft.findMany({
    select: {
      id: true,
      startedAt: true,
      updatedAt: true,
      userId: true,
      workout: { select: { name: true } },
      workoutId: true,
      workoutName: true,
    },
    where: {
      startedAt: {
        gte: new Date(now.getTime() - OPEN_SESSION_MAX_AGE_MS),
        lte: new Date(now.getTime() - OPEN_SESSION_MIN_AGE_MS),
      },
      updatedAt: { lte: new Date(now.getTime() - OPEN_SESSION_IDLE_MS) },
      user: { isActive: true },
    },
  })
  const openDrafts = drafts.filter((draft) => isWorkoutSessionLeftOpen(draft, now))
  if (openDrafts.length === 0) return { candidates: 0, sent: 0 }

  // A finished session whose draft the client failed to delete is not "open".
  const finishedLogs = await db.workoutLog.findMany({
    select: { createdAt: true, userId: true, workoutId: true },
    where: {
      createdAt: { gte: openDrafts.reduce((min, draft) => (draft.startedAt < min ? draft.startedAt : min), now) },
      OR: openDrafts.map((draft) => ({ userId: draft.userId, workoutId: draft.workoutId })),
    },
  })
  const preferenceFor = await loadNotificationPreferences(openDrafts.map((draft) => draft.userId))

  const notificationDrafts = openDrafts.flatMap((draft): NotificationDraft[] => {
    if (!preferenceFor(draft.userId).workoutSessionReminders) return []

    const finished = finishedLogs.some((log) =>
      log.userId === draft.userId && log.workoutId === draft.workoutId && log.createdAt >= draft.startedAt)
    if (finished) return []

    const workoutName = draft.workoutName?.trim() || draft.workout.name

    return [{
      dedupeKey: `workout_session_open:${draft.id}:${draft.startedAt.getTime()}`,
      message: `You started ${workoutName} ${formatElapsed(now.getTime() - draft.startedAt.getTime())} ago. Finish or resume it?`,
      metadata: { draftId: draft.id, startedAt: draft.startedAt.toISOString(), workoutId: draft.workoutId, workoutName },
      relatedEntityId: draft.workoutId,
      relatedEntityType: "workout",
      title: "Workout still open",
      type: NotificationType.workout_session_open,
      url: `/workout/${draft.workoutId}/start`,
      userId: draft.userId,
    }]
  })

  return sendNewDrafts(notificationDrafts)
}

/** Users whose own daily reminder is due now, with their local clock. */
function dueUsers<T extends { timeZone: string; userId: string }>(
  rows: T[],
  now: Date,
  isDue: (row: T, clock: LocalClock) => boolean,
) {
  return rows.flatMap((row) => {
    const clock = getLocalClock(now, row.timeZone)
    return isDue(row, clock) ? [{ clock, row }] : []
  })
}

/** Weight reminder on the chosen days; skipped when today's weight is already logged. */
async function runWeightReminderJob(now: Date) {
  const db = ensurePrisma()
  const preferences = await db.notificationPreference.findMany({
    select: { timeZone: true, userId: true, weightReminderDays: true, weightReminderTime: true },
    where: { user: { isActive: true }, weightReminderEnabled: true },
  })
  const due = dueUsers(preferences, now, (row, clock) =>
    isDailyReminderDue(clock, row.weightReminderTime, row.weightReminderDays))
  if (due.length === 0) return { candidates: 0, sent: 0 }

  const entries = await db.bodyMetricEntry.findMany({
    select: { recordedAt: true, traineeId: true },
    where: {
      recordedAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
      traineeId: { in: due.map(({ row }) => row.userId) },
      weightKg: { not: null },
    },
  })

  const drafts = due.flatMap(({ clock, row }): NotificationDraft[] => {
    const loggedToday = entries.some((entry) =>
      entry.traineeId === row.userId && entry.recordedAt >= clock.dayStart && entry.recordedAt < clock.dayEnd)
    if (loggedToday) return []

    return [{
      dedupeKey: `weight_reminder:${row.userId}:${clock.dateKey}`,
      message: "A quick check-in keeps your trend accurate.",
      metadata: { date: clock.dateKey },
      title: "Time to log your weight",
      type: NotificationType.weight_reminder,
      url: "/trackweight",
      userId: row.userId,
    }]
  })

  return sendNewDrafts(drafts)
}

/** Morning check-in; skipped when today's recovery check-in already exists. */
async function runDailyCheckInJob(now: Date) {
  const db = ensurePrisma()
  const preferences = await db.notificationPreference.findMany({
    select: { dailyCheckInTime: true, timeZone: true, userId: true },
    where: { dailyCheckInEnabled: true, user: { isActive: true } },
  })
  const due = dueUsers(preferences, now, (row, clock) => isDailyReminderDue(clock, row.dailyCheckInTime))
  if (due.length === 0) return { candidates: 0, sent: 0 }

  const checkIns = await db.recoveryCheckIn.findMany({
    select: { checkInDate: true, userId: true },
    where: {
      // `checkInDate` is a DATE holding the user's local day.
      checkInDate: { in: Array.from(new Set(due.map(({ clock }) => clock.dateKey))).map((key) => new Date(`${key}T00:00:00.000Z`)) },
      userId: { in: due.map(({ row }) => row.userId) },
    },
  })
  const checkedIn = new Set(checkIns.map((checkIn) => `${checkIn.userId}:${checkIn.checkInDate.toISOString().slice(0, 10)}`))

  const drafts = due.flatMap(({ clock, row }): NotificationDraft[] => {
    if (checkedIn.has(`${row.userId}:${clock.dateKey}`)) return []

    return [{
      dedupeKey: `check_in_reminder:${row.userId}:${clock.dateKey}`,
      message: "How are you feeling today?",
      metadata: { date: clock.dateKey },
      title: "Morning check-in",
      type: NotificationType.check_in_reminder,
      url: "/dashboard",
      userId: row.userId,
    }]
  })

  return sendNewDrafts(drafts)
}

const MEAL_LABELS: Record<MealReminderType, string> = {
  breakfast: "Breakfast",
  dinner: "Dinner",
  lunch: "Lunch",
  snack: "Snack",
}

/** Meal-window reminders; skipped once that meal has logged calories for the day. */
async function runMealReminderJob(now: Date) {
  const db = ensurePrisma()
  const preferences = await db.notificationPreference.findMany({
    where: {
      OR: MEAL_REMINDER_TYPES.map((meal) => ({ [mealReminderColumns(meal).enabled]: true })),
      user: { isActive: true },
    },
  })

  const due = preferences.flatMap((preference) => {
    const clock = getLocalClock(now, preference.timeZone)

    return MEAL_REMINDER_TYPES.flatMap((meal) => {
      const columns = mealReminderColumns(meal)
      const isDue = preference[columns.enabled]
        && isDailyReminderDue(clock, preference[columns.time], undefined, MEAL_REMINDER_CATCH_UP_MINUTES)
      return isDue ? [{ clock, meal, userId: preference.userId }] : []
    })
  })
  if (due.length === 0) return { candidates: 0, sent: 0 }

  const loggedMeals = await db.meal.findMany({
    select: { calories: true, loggedDate: true, type: true, userId: true },
    where: {
      // `loggedDate` is a DATE holding the user's local day.
      loggedDate: { in: Array.from(new Set(due.map(({ clock }) => clock.dateKey))).map((key) => new Date(`${key}T00:00:00.000Z`)) },
      status: MealStatus.consumed,
      type: { in: Array.from(new Set(due.map(({ meal }) => meal))) },
      userId: { in: Array.from(new Set(due.map(({ userId }) => userId))) },
    },
  })
  const caloriesByMeal = new Map<string, number>()
  loggedMeals.forEach((meal) => {
    const key = `${meal.userId}:${meal.loggedDate.toISOString().slice(0, 10)}:${meal.type}`
    caloriesByMeal.set(key, (caloriesByMeal.get(key) ?? 0) + meal.calories)
  })

  const drafts = due.flatMap(({ clock, meal, userId }): NotificationDraft[] => {
    // A meal row with 0 calories is a placeholder, not a logged meal.
    if ((caloriesByMeal.get(`${userId}:${clock.dateKey}:${meal}`) ?? 0) > 0) return []

    return [{
      dedupeKey: `meal_reminder:${userId}:${clock.dateKey}:${meal}`,
      message: `Don't forget to log your ${meal}.`,
      metadata: { date: clock.dateKey, mealType: meal },
      title: `${MEAL_LABELS[meal]} reminder`,
      type: NotificationType.meal_reminder,
      url: "/meals",
      userId,
    }]
  })

  return sendNewDrafts(drafts)
}

/**
 * "Workout starts soon" before the user's usual training time, only on days their
 * schedule has a workout they have neither finished nor already started.
 */
async function runWorkoutReminderJob(now: Date) {
  const db = ensurePrisma()
  const preferences = await db.notificationPreference.findMany({
    select: { timeZone: true, userId: true, workoutReminderOffsetMinutes: true, workoutReminderTime: true },
    where: { user: { isActive: true, role: UserRole.trainee }, workoutReminderEnabled: true },
  })
  const due = dueUsers(preferences, now, (row, clock) =>
    isWorkoutReminderDue(clock, row.workoutReminderTime, row.workoutReminderOffsetMinutes))
  if (due.length === 0) return { candidates: 0, sent: 0 }

  // Resolving the schedule is the expensive part, so skip users already reminded today first.
  const used = await findUsedDedupeKeys(due.map(({ clock, row }) => `workout_reminder:${row.userId}:${clock.dateKey}`))
  const pending = due.filter(({ clock, row }) => !used.has(`workout_reminder:${row.userId}:${clock.dateKey}`))
  if (pending.length === 0) return { candidates: due.length, sent: 0 }

  const openDrafts = await db.workoutSessionDraft.findMany({
    select: { startedAt: true, userId: true },
    where: { userId: { in: pending.map(({ row }) => row.userId) } },
  })

  const drafts: NotificationDraft[] = []
  for (const { clock, row } of pending) {
    if (openDrafts.some((draft) => draft.userId === row.userId && draft.startedAt >= clock.dayStart)) continue

    const today = await withRequestContext(
      { method: "JOB", path: "notification-scheduler/workout-reminder", requestId: randomUUID(), timeZone: clock.timeZone },
      () => findTodayScheduleEntryForTrainee(row.userId),
    )
    if (!today || today.isCompleted) continue

    drafts.push({
      dedupeKey: `workout_reminder:${row.userId}:${clock.dateKey}`,
      message: `${today.workoutName} is scheduled at ${formatClockTime12h(row.workoutReminderTime)}.`,
      metadata: { date: clock.dateKey, time: row.workoutReminderTime, workoutId: today.workoutId, workoutName: today.workoutName },
      relatedEntityId: today.workoutId,
      relatedEntityType: "workout",
      title: "Workout starts soon",
      type: NotificationType.workout_reminder,
      url: "/dashboard",
      userId: row.userId,
    })
  }

  const result = await sendNewDrafts(drafts)
  return { candidates: due.length, sent: result.sent }
}

/** End-of-week summary asking each coach to review their trainees' numbers. */
async function runCoachWeeklyReviewJob(now: Date) {
  const db = ensurePrisma()
  const activeTrainee = { isActive: true, role: UserRole.trainee }
  const coaches = await db.user.findMany({
    select: {
      id: true,
      notificationPreference: {
        select: { coachWeeklyReviewDay: true, coachWeeklyReviewEnabled: true, coachWeeklyReviewTime: true, timeZone: true },
      },
      trainees: { orderBy: { name: "asc" }, select: { id: true, name: true }, where: activeTrainee },
    },
    where: { isActive: true, role: UserRole.coach, trainees: { some: activeTrainee } },
  })

  const due = coaches.flatMap((coach) => {
    // Coaches who never opened settings get the defaults: on, Sunday 18:00.
    const preference = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...coach.notificationPreference }
    if (!preference.coachWeeklyReviewEnabled) return []

    const clock = getLocalClock(now, preference.timeZone)
    return isDailyReminderDue(clock, preference.coachWeeklyReviewTime, [preference.coachWeeklyReviewDay])
      ? [{ clock, coach }]
      : []
  })
  if (due.length === 0) return { candidates: 0, sent: 0 }

  const earliestWeekStart = due.reduce((min, { clock }) => (clock.weekStart < min ? clock.weekStart : min), now)
  const logs = await db.workoutLog.findMany({
    select: { startedAt: true, userId: true },
    where: {
      startedAt: { gte: earliestWeekStart },
      userId: { in: due.flatMap(({ coach }) => coach.trainees.map((trainee) => trainee.id)) },
    },
  })

  const drafts = due.map(({ clock, coach }) => buildCoachWeeklyReviewDraft({
    coachId: coach.id,
    trainees: coach.trainees.map((trainee) => ({
      id: trainee.id,
      name: trainee.name,
      workouts: logs.filter((log) => log.userId === trainee.id && log.startedAt >= clock.weekStart).length,
    })),
    weekStartKey: clock.weekStartKey,
  }))

  return sendNewDrafts(drafts)
}

const JOBS = {
  coachWeeklyReview: runCoachWeeklyReviewJob,
  dailyCheckIn: runDailyCheckInJob,
  mealReminder: runMealReminderJob,
  openWorkoutSession: runOpenWorkoutSessionJob,
  weightReminder: runWeightReminderJob,
  workoutReminder: runWorkoutReminderJob,
} as const

/** One pass over every job. A failing job is logged and does not stop the others. */
async function runNotificationSchedulerTick(now = new Date()) {
  const results: Partial<Record<keyof typeof JOBS, JobResult>> = {}

  for (const [name, job] of Object.entries(JOBS) as Array<[keyof typeof JOBS, (now: Date) => Promise<JobResult>]>) {
    try {
      results[name] = await job(now)
    } catch (error) {
      logger.error("notification job failed", { error, job: name })
    }
  }

  const sent = Object.values(results).reduce((total, result) => total + (result?.sent ?? 0), 0)
  if (sent > 0) logger.info("scheduled notifications sent", { results })

  return results
}

let timer: NodeJS.Timeout | null = null
let running = false

function startNotificationScheduler() {
  if (timer || !env.notificationSchedulerEnabled || !env.databaseUrl) return

  const tick = async () => {
    // A slow tick (cold DB, many users) must not overlap the next one.
    if (running) return
    running = true
    try {
      await runNotificationSchedulerTick()
    } finally {
      running = false
    }
  }

  timer = setInterval(() => void tick(), env.notificationSchedulerIntervalMs)
  timer.unref()
  logger.info("notification scheduler started", { intervalMs: env.notificationSchedulerIntervalMs })
}

function stopNotificationScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}

export {
  runCoachWeeklyReviewJob,
  runDailyCheckInJob,
  runMealReminderJob,
  runNotificationSchedulerTick,
  runOpenWorkoutSessionJob,
  runWeightReminderJob,
  runWorkoutReminderJob,
  startNotificationScheduler,
  stopNotificationScheduler,
}
