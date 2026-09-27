import { NotificationType, Prisma, PushDeliveryStatus, UserRole } from "@prisma/client"

import type { SerializedProfile } from "../auth.service"
import { ForbiddenError } from "../errors"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { buildNotificationData, queuePushForNotifications } from "../notifications/notification-dispatch.service"

/**
 * Notices an admin sends to everyone who uses the app. Each recipient gets a
 * bell entry, and a push on every device where they turned push on. The
 * broadcast row keeps what was sent; the stats come from the recipients'
 * notifications and their push deliveries.
 */

export const ADMIN_BROADCAST_ENTITY = "admin_broadcast"
export const ADMIN_BROADCAST_KIND = "admin_broadcast"
/** In-app pages a broadcast can open, so a tap never leaves the app. */
export const ADMIN_BROADCAST_TARGETS = ["/dashboard", "/workout", "/schedule", "/meals", "/progress", "/profile"] as const
export type AdminBroadcastTarget = (typeof ADMIN_BROADCAST_TARGETS)[number]

const HISTORY_LIMIT = 20
const CREATE_BATCH = 500

/** Everyone a broadcast reaches: active trainees and coaches (not admins). */
const RECIPIENT_WHERE = {
  isActive: true,
  role: { in: [UserRole.trainee, UserRole.coach] },
} satisfies Prisma.UserWhereInput

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) {
    throw new ForbiddenError("Chỉ admin mới có quyền gửi thông báo.")
  }
}

/** How many people and devices a broadcast would reach right now. */
export async function getAdminBroadcastAudience(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const activeSubscription = { revokedAt: null, user: RECIPIENT_WHERE } satisfies Prisma.PushSubscriptionWhereInput
  const [accounts, usersWithPush, devices] = await Promise.all([
    db.user.count({ where: RECIPIENT_WHERE }),
    db.user.count({ where: { ...RECIPIENT_WHERE, pushSubscriptions: { some: { revokedAt: null } } } }),
    db.pushSubscription.count({ where: activeSubscription }),
  ])
  return { accounts, devices, usersWithPush }
}

export async function sendAdminBroadcast(
  profile: SerializedProfile,
  input: { message: string; target?: AdminBroadcastTarget | null; title: string },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const title = input.title.trim()
  const message = input.message.trim()
  const url = input.target ?? null

  const recipients = await db.user.findMany({ select: { id: true }, where: RECIPIENT_WHERE })

  const broadcast = await db.adminBroadcast.create({
    data: { adminId: profile.id, message, recipientCount: recipients.length, title, url },
  })

  // Each recipient's copy links back to the broadcast, which is where the
  // history reads its read and push counts from.
  const notifications = []
  for (let start = 0; start < recipients.length; start += CREATE_BATCH) {
    const batch = recipients.slice(start, start + CREATE_BATCH)
    notifications.push(...await db.notification.createManyAndReturn({
      data: batch.map((recipient) => buildNotificationData({
        message,
        metadata: { broadcastId: broadcast.id, kind: ADMIN_BROADCAST_KIND },
        relatedEntityId: broadcast.id,
        relatedEntityType: ADMIN_BROADCAST_ENTITY,
        title,
        type: NotificationType.general,
        // No target: the root sends each role to its own home.
        url: url ?? "/",
        userId: recipient.id,
      })),
    }))
  }

  await db.adminAuditLog.create({
    data: {
      action: "notification.broadcast",
      adminId: profile.id,
      entityId: broadcast.id,
      entityLabel: title,
      entityType: "notification",
      metadata: { recipientCount: recipients.length, url } as Prisma.InputJsonObject,
    },
  })

  // Queued, with retries; it never throws, so a slow push service can't fail the send.
  await queuePushForNotifications(notifications)

  return { id: broadcast.id, recipientCount: recipients.length }
}

/** The most recent broadcasts, each with how many read it and how its pushes went. */
export async function listAdminBroadcasts(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const broadcasts = await db.adminBroadcast.findMany({
    include: { admin: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  })
  if (broadcasts.length === 0) return []

  const recipients = await db.notification.findMany({
    select: { pushDeliveries: { select: { status: true } }, readAt: true, relatedEntityId: true },
    where: { relatedEntityId: { in: broadcasts.map((broadcast) => broadcast.id) }, relatedEntityType: ADMIN_BROADCAST_ENTITY },
  })

  const stats = new Map<string, { failed: number; pending: number; read: number; sent: number }>()
  for (const recipient of recipients) {
    if (!recipient.relatedEntityId) continue
    const entry = stats.get(recipient.relatedEntityId) ?? { failed: 0, pending: 0, read: 0, sent: 0 }
    if (recipient.readAt) entry.read += 1
    for (const delivery of recipient.pushDeliveries) {
      if (delivery.status === PushDeliveryStatus.sent) entry.sent += 1
      else if (delivery.status === PushDeliveryStatus.failed) entry.failed += 1
      else entry.pending += 1
    }
    stats.set(recipient.relatedEntityId, entry)
  }

  return broadcasts.map((broadcast) => {
    const entry = stats.get(broadcast.id) ?? { failed: 0, pending: 0, read: 0, sent: 0 }
    return {
      createdAt: broadcast.createdAt,
      id: broadcast.id,
      message: broadcast.message,
      push: { failed: entry.failed, pending: entry.pending, sent: entry.sent },
      read: entry.read,
      recipientCount: broadcast.recipientCount,
      sentBy: broadcast.admin.name,
      title: broadcast.title,
      url: broadcast.url,
    }
  })
}
