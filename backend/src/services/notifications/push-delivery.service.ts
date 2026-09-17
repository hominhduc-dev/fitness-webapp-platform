import { NotificationType, PushDeliveryStatus, type Notification, type Prisma } from "@prisma/client"

import { logger } from "../../lib/logger"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { sendPushToSubscription } from "../push-notification.service"
import { localizedNotificationCopy, type PushLocale } from "./localized-push"

const MAX_ATTEMPTS = 5
const DELIVERY_BATCH_SIZE = 50
const STALE_PROCESSING_MS = 5 * 60_000
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000]
const DEFAULT_ICON = "/android-icon-192x192.png"

function metadataRecord(metadata: Prisma.JsonValue) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

function metadataText(metadata: Prisma.JsonValue, key: string) {
  const value = metadataRecord(metadata)[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function notificationPushTag(notification: Pick<Notification, "id" | "metadata" | "relatedEntityId" | "type">) {
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
      return `meal-reminder:${metadataText(notification.metadata, "mealType") ?? "meal"}`
    case NotificationType.workout_reminder:
      return "workout-reminder"
    case NotificationType.coach_weekly_review:
      return "coach-weekly-review"
    default:
      return `notification:${notification.id}`
  }
}

function retryAt(attemptCount: number, now: Date) {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(0, attemptCount - 1), RETRY_DELAYS_MS.length - 1)]
  return new Date(now.getTime() + delay)
}

/** Creates one durable delivery per active device. Safe to call repeatedly. */
async function enqueuePushDeliveries(notifications: readonly Notification[]) {
  if (notifications.length === 0) return 0

  const db = ensurePrisma()
  const subscriptions = await db.pushSubscription.findMany({
    select: { id: true, userId: true },
    where: { revokedAt: null, userId: { in: Array.from(new Set(notifications.map((row) => row.userId))) } },
  })
  const subscriptionIds = new Map<string, string[]>()
  subscriptions.forEach((subscription) => {
    subscriptionIds.set(subscription.userId, [...(subscriptionIds.get(subscription.userId) ?? []), subscription.id])
  })

  const rows = notifications.flatMap((notification) =>
    (subscriptionIds.get(notification.userId) ?? []).map((subscriptionId) => ({
      notificationId: notification.id,
      subscriptionId,
    })))
  if (rows.length === 0) return 0

  const result = await db.pushDelivery.createMany({ data: rows, skipDuplicates: true })
  return result.count
}

async function claimDelivery(deliveryId: string, now: Date) {
  const db = ensurePrisma()
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
  const claimed = await db.pushDelivery.updateMany({
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: now,
      status: PushDeliveryStatus.processing,
    },
    where: {
      id: deliveryId,
      OR: [
        { nextAttemptAt: { lte: now }, status: { in: [PushDeliveryStatus.pending, PushDeliveryStatus.retrying] } },
        { lastAttemptAt: { lte: staleBefore }, status: PushDeliveryStatus.processing },
      ],
    },
  })
  return claimed.count === 1
}

async function deliverOne(delivery: Awaited<ReturnType<typeof findDueDeliveries>>[number], now: Date) {
  if (!await claimDelivery(delivery.id, now)) return "skipped" as const

  const db = ensurePrisma()
  // Rebinding and enqueueing can race on a shared device. Never deliver when
  // the endpoint's current owner differs from the notification recipient.
  if (delivery.notification.userId !== delivery.subscription.userId) {
    await db.pushDelivery.update({
      data: { lastError: "Subscription belongs to another account", status: PushDeliveryStatus.failed },
      where: { id: delivery.id },
    })
    return "failed" as const
  }

  const attemptCount = delivery.attemptCount + 1
  const unreadCount = await db.notification.count({
    where: { readAt: null, status: "sent", userId: delivery.notification.userId },
  })
  const locale: PushLocale = delivery.subscription.locale === "vi" ? "vi" : "en"
  const copy = localizedNotificationCopy(delivery.notification, locale, now)
  const result = await sendPushToSubscription(delivery.subscription, {
    badgeCount: unreadCount,
    body: copy.body,
    data: { notificationId: delivery.notification.id, type: delivery.notification.type },
    icon: DEFAULT_ICON,
    tag: notificationPushTag(delivery.notification),
    title: copy.title,
    url: metadataText(delivery.notification.metadata, "url") ?? "/dashboard",
  })

  if (result.outcome === "sent") {
    await db.pushDelivery.update({
      data: { lastError: null, sentAt: now, status: PushDeliveryStatus.sent },
      where: { id: delivery.id },
    })
    return "sent" as const
  }

  if (result.outcome === "gone") {
    await db.$transaction([
      db.pushSubscription.update({ data: { revokedAt: now }, where: { id: delivery.subscription.id } }),
      db.pushDelivery.update({
        data: { lastError: `Push endpoint expired (${result.statusCode})`, status: PushDeliveryStatus.failed },
        where: { id: delivery.id },
      }),
    ])
    return "failed" as const
  }

  const exhausted = attemptCount >= MAX_ATTEMPTS
  await db.pushDelivery.update({
    data: {
      lastError: result.error,
      nextAttemptAt: exhausted ? delivery.nextAttemptAt : retryAt(attemptCount, now),
      status: exhausted ? PushDeliveryStatus.failed : PushDeliveryStatus.retrying,
    },
    where: { id: delivery.id },
  })
  return exhausted ? "failed" as const : "retrying" as const
}

async function findDueDeliveries(now: Date, notificationIds?: readonly string[]) {
  const db = ensurePrisma()
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
  return db.pushDelivery.findMany({
    include: { notification: true, subscription: true },
    orderBy: { nextAttemptAt: "asc" },
    take: DELIVERY_BATCH_SIZE,
    where: {
      ...(notificationIds?.length ? { notificationId: { in: [...notificationIds] } } : {}),
      subscription: { revokedAt: null },
      OR: [
        { nextAttemptAt: { lte: now }, status: { in: [PushDeliveryStatus.pending, PushDeliveryStatus.retrying] } },
        { lastAttemptAt: { lte: staleBefore }, status: PushDeliveryStatus.processing },
      ],
    },
  })
}

async function processPushDeliveries(now = new Date(), notificationIds?: readonly string[]) {
  const deliveries = await findDueDeliveries(now, notificationIds)
  const results = await Promise.all(deliveries.map(async (delivery) => {
    try {
      return await deliverOne(delivery, now)
    } catch (error) {
      logger.warn("push delivery attempt failed", { deliveryId: delivery.id, error })
      return "failed" as const
    }
  }))

  return {
    candidates: deliveries.length,
    failed: results.filter((result) => result === "failed").length,
    retrying: results.filter((result) => result === "retrying").length,
    sent: results.filter((result) => result === "sent").length,
  }
}

export {
  enqueuePushDeliveries,
  notificationPushTag,
  processPushDeliveries,
  retryAt,
}
