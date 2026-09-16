import { NotificationStatus, NotificationType, Prisma, type Notification } from "@prisma/client"

import { logger } from "../../lib/logger"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { sendPushToUser } from "../push-notification.service"
import { loadNotificationPreferences, type NotificationPreferenceSettings } from "./notification-preferences.service"

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

const DEFAULT_ICON = "/android-icon-192x192.png"

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

function readString(metadata: Prisma.JsonValue, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" ? value : undefined
}

/**
 * The device replaces a notification carrying the same tag instead of stacking
 * another one, so repeated saves of one program collapse into a single alert.
 */
function buildPushTag(notification: Pick<Notification, "id" | "metadata" | "relatedEntityId" | "type">) {
  switch (notification.type) {
    case NotificationType.program_assigned:
    case NotificationType.program_updated:
      return `program:${notification.relatedEntityId ?? notification.id}`
    case NotificationType.workout_session_open:
      return `workout-session:${notification.relatedEntityId ?? notification.id}`
    case NotificationType.weight_reminder:
      return "weight-reminder"
    case NotificationType.check_in_reminder:
      return "check-in-reminder"
    case NotificationType.meal_reminder:
      return `meal-reminder:${readString(notification.metadata, "mealType") ?? "meal"}`
    case NotificationType.workout_reminder:
      return "workout-reminder"
    case NotificationType.coach_weekly_review:
      return "coach-weekly-review"
    default:
      return `notification:${notification.id}`
  }
}

/**
 * Push already-stored notifications, honouring each user's preferences.
 * Never throws: a push failure must not fail the change that caused it.
 */
async function pushStoredNotifications(notifications: readonly Notification[]) {
  if (notifications.length === 0) return

  try {
    const preferenceFor = await loadNotificationPreferences(notifications.map((notification) => notification.userId))

    await Promise.all(notifications.map(async (notification) => {
      if (!isPushAllowed(notification.type, preferenceFor(notification.userId))) return

      await sendPushToUser(notification.userId, {
        body: notification.message,
        data: { notificationId: notification.id, type: notification.type },
        icon: DEFAULT_ICON,
        tag: buildPushTag(notification),
        title: notification.title,
        url: readString(notification.metadata, "url") ?? "/dashboard",
      })
    }))
  } catch (error) {
    logger.warn("unable to push notifications", { count: notifications.length, error })
  }
}

/** Fire-and-forget variant for request handlers that should not wait on push delivery. */
function queuePushForNotifications(notifications: readonly Notification[]) {
  void pushStoredNotifications(notifications)
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
