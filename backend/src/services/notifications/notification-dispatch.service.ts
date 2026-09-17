import { NotificationStatus, NotificationType, Prisma, type Notification } from "@prisma/client"

import { logger } from "../../lib/logger"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { loadNotificationPreferences, type NotificationPreferenceSettings } from "./notification-preferences.service"
import { enqueuePushDeliveries, notificationPushTag, processPushDeliveries } from "./push-delivery.service"

/**
 * Every user-facing notification is stored in-app first and then pushed.
 *
 * Event notifications (coach assigned / updated a program) are written inside the
 * transaction that caused them, so the in-app row never outlives a rolled-back
 * change; their push goes out only after commit via `pushStoredNotifications`.
 * Scheduled reminders go through `createAndPushNotification`, which dedupes on
 * `dedupeKey`.
 */

type NotificationDraft = {
  dedupeKey?: string
  message: string
  metadata?: Record<string, unknown>
  relatedEntityId?: string
  relatedEntityType?: string
  title: string
  type: NotificationType
  /** Where a tap on the push lands. Stored in metadata so the in-app list can link too. */
  url: string
  userId: string
}

/** Row data for `notification.create` / `createMany`, usable inside a transaction. */
function buildNotificationData(draft: NotificationDraft, now = new Date()): Prisma.NotificationCreateManyInput {
  return {
    channel: "in_app",
    dedupeKey: draft.dedupeKey,
    message: draft.message,
    metadata: { ...draft.metadata, url: draft.url } as Prisma.InputJsonObject,
    relatedEntityId: draft.relatedEntityId,
    relatedEntityType: draft.relatedEntityType,
    scheduledFor: now,
    sentAt: now,
    status: NotificationStatus.sent,
    title: draft.title,
    type: draft.type,
    userId: draft.userId,
  }
}

/** Whether the user's settings allow a push for this notification type. */
function isPushAllowed(type: NotificationType, preference: NotificationPreferenceSettings) {
  switch (type) {
    case NotificationType.program_assigned:
    case NotificationType.program_updated:
      return preference.coachProgramUpdates
    case NotificationType.workout_session_open:
      return preference.workoutSessionReminders
    case NotificationType.weight_reminder:
      return preference.weightReminderEnabled
    case NotificationType.check_in_reminder:
      return preference.dailyCheckInEnabled
    case NotificationType.workout_reminder:
      return preference.workoutReminderEnabled
    case NotificationType.coach_weekly_review:
      return preference.coachWeeklyReviewEnabled
    // Meal reminders are gated per meal by the job that creates them.
    default:
      return true
  }
}

/**
 * The device replaces a notification carrying the same tag instead of stacking
 * another one, so repeated saves of one program collapse into a single alert.
 */
function buildPushTag(notification: Pick<Notification, "id" | "metadata" | "relatedEntityId" | "type">) {
  return notificationPushTag(notification)
}

/**
 * Push already-stored notifications, honouring each user's preferences.
 * Never throws: a push failure must not fail the change that caused it.
 */
async function pushStoredNotifications(notifications: readonly Notification[]) {
  if (notifications.length === 0) return

  try {
    const preferenceFor = await loadNotificationPreferences(notifications.map((notification) => notification.userId))

    const allowed = notifications.filter((notification) =>
      isPushAllowed(notification.type, preferenceFor(notification.userId)))
    await enqueuePushDeliveries(allowed)
    await processPushDeliveries(new Date(), allowed.map((notification) => notification.id))
  } catch (error) {
    logger.warn("unable to push notifications", { count: notifications.length, error })
  }
}

/** Fire-and-forget variant for request handlers that should not wait on push delivery. */
async function queuePushForNotifications(notifications: readonly Notification[]) {
  if (notifications.length === 0) return

  try {
    const preferenceFor = await loadNotificationPreferences(notifications.map((notification) => notification.userId))
    const allowed = notifications.filter((notification) =>
      isPushAllowed(notification.type, preferenceFor(notification.userId)))
    await enqueuePushDeliveries(allowed)
    void processPushDeliveries(new Date(), allowed.map((notification) => notification.id))
  } catch (error) {
    logger.warn("unable to queue push notifications", { count: notifications.length, error })
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * Store and push one notification. Returns null when `dedupeKey` was already
 * used — another tick or instance delivered it first.
 */
async function createAndPushNotification(draft: NotificationDraft) {
  const db = ensurePrisma()

  let notification: Notification
  try {
    notification = await db.notification.create({ data: buildNotificationData(draft) })
  } catch (error) {
    if (draft.dedupeKey && isUniqueConstraintError(error)) return null
    throw error
  }

  await pushStoredNotifications([notification])
  return notification
}

/** Dedupe keys from `keys` that already have a stored notification. */
async function findUsedDedupeKeys(keys: readonly string[]) {
  if (keys.length === 0) return new Set<string>()

  const db = ensurePrisma()
  const rows = await db.notification.findMany({
    select: { dedupeKey: true },
    where: { dedupeKey: { in: Array.from(new Set(keys)) } },
  })

  return new Set(rows.flatMap((row) => (row.dedupeKey ? [row.dedupeKey] : [])))
}

export {
  buildNotificationData,
  buildPushTag,
  createAndPushNotification,
  findUsedDedupeKeys,
  isPushAllowed,
  pushStoredNotifications,
  queuePushForNotifications,
}
export type { NotificationDraft }
