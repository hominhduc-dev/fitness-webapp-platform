import webpush, { type PushSubscription as WebPushSubscription } from "web-push"
import { PushDeliveryStatus, type PushSubscription } from "@prisma/client"

import { env } from "../config/env"
import { logger } from "../lib/logger"
import { ensurePrisma } from "./fitness-data/shared/guards"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"

type PushSubscriptionInput = {
  endpoint: string
  expirationTime?: number | null
  locale: "en" | "vi"
  keys: {
    auth: string
    p256dh: string
  }
}

type PushPayload = {
  badge?: string
  badgeCount?: number
  body: string
  data?: Record<string, unknown>
  icon?: string
  tag?: string
  title: string
  url?: string
}

type PushSendResult =
  | { outcome: "gone"; statusCode: number }
  | { outcome: "sent" }
  | { error: string; outcome: "failed"; statusCode?: number }

function isPushConfigured() {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey)
}

function configureWebPush() {
  if (!isPushConfigured()) return false

  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!)
  return true
}

function getPushPublicConfig() {
  return {
    enabled: isPushConfigured(),
    publicKey: env.vapidPublicKey ?? null,
  }
}

async function savePushSubscriptionForUser(
  profile: SerializedProfile,
  input: PushSubscriptionInput,
  userAgent?: string,
) {
  if (!isPushConfigured()) {
    throw new BadRequestError("Push notification chưa được cấu hình trên server.")
  }

  const db = ensurePrisma()
  const subscription = await db.$transaction(async (transaction) => {
    const row = await transaction.pushSubscription.upsert({
      create: {
        auth: input.keys.auth,
        endpoint: input.endpoint,
        locale: input.locale,
        p256dh: input.keys.p256dh,
        userAgent,
        userId: profile.id,
      },
      update: {
        auth: input.keys.auth,
        locale: input.locale,
        p256dh: input.keys.p256dh,
        revokedAt: null,
        userAgent,
        userId: profile.id,
      },
      where: { endpoint: input.endpoint },
    })

    // An endpoint can move between accounts on a shared device. Old queued
    // deliveries must become terminal before this endpoint can serve the new user.
    await transaction.pushDelivery.updateMany({
      data: {
        lastError: "Subscription rebound to another account",
        status: PushDeliveryStatus.failed,
      },
      where: {
        notification: { userId: { not: profile.id } },
        status: { in: [PushDeliveryStatus.pending, PushDeliveryStatus.processing, PushDeliveryStatus.retrying] },
        subscriptionId: row.id,
      },
    })

    return row
  })

  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
  }
}

async function revokePushSubscriptionForUser(profile: SerializedProfile, endpoint: string) {
  const db = ensurePrisma()
  const now = new Date()
  await db.$transaction(async (transaction) => {
    const subscriptions = await transaction.pushSubscription.findMany({
      select: { id: true },
      where: { endpoint, userId: profile.id },
    })
    if (subscriptions.length === 0) return

    const ids = subscriptions.map((subscription) => subscription.id)
    await transaction.pushSubscription.updateMany({ data: { revokedAt: now }, where: { id: { in: ids } } })
    await transaction.pushDelivery.updateMany({
      data: { lastError: "Subscription revoked", status: PushDeliveryStatus.failed },
      where: {
        status: { in: [PushDeliveryStatus.pending, PushDeliveryStatus.processing, PushDeliveryStatus.retrying] },
        subscriptionId: { in: ids },
      },
    })
  })

  return { revoked: true }
}

async function sendPushToUser(userId: string, payload: PushPayload | ((locale: "en" | "vi") => PushPayload)) {
  if (!configureWebPush()) {
    logger.warn("push notification skipped: VAPID is not configured", { userId })
    return { failed: 0, sent: 0 }
  }

  const db = ensurePrisma()
  const subscriptions = await db.pushSubscription.findMany({
    where: {
      revokedAt: null,
      userId,
    },
  })

  let sent = 0
  let failed = 0

  await Promise.all(subscriptions.map(async (subscription) => {
    const locale = subscription.locale === "vi" ? "vi" : "en"
    const result = await sendPushToSubscription(subscription, typeof payload === "function" ? payload(locale) : payload)
    if (result.outcome === "sent") {
      sent += 1
      return
    }

    failed += 1
    if (result.outcome === "gone") {
      try {
        await db.pushSubscription.update({
          data: { revokedAt: new Date() },
          where: { id: subscription.id },
        })
      } catch (error) {
        logger.warn("unable to revoke expired push subscription", { error, subscriptionId: subscription.id, userId })
      }
      return
    }

    logger.warn("push notification send failed", { error: result.error, subscriptionId: subscription.id, userId })
  }))

  return { failed, sent }
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return "Unknown Web Push error"
}

async function sendPushToSubscription(
  subscription: Pick<PushSubscription, "auth" | "endpoint" | "p256dh">,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!configureWebPush()) return { error: "VAPID is not configured", outcome: "failed" }

  const webPushSubscription: WebPushSubscription = {
    endpoint: subscription.endpoint,
    keys: { auth: subscription.auth, p256dh: subscription.p256dh },
  }

  try {
    await webpush.sendNotification(webPushSubscription, JSON.stringify(payload))
    return { outcome: "sent" }
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined

    if (statusCode === 404 || statusCode === 410) return { outcome: "gone", statusCode }
    return { error: pushErrorMessage(error), outcome: "failed", statusCode }
  }
}

async function sendTestPushForUser(profile: SerializedProfile) {
  return sendPushToUser(profile.id, (locale) => ({
    body: locale === "vi"
      ? "Thông báo đẩy đã sẵn sàng trên thiết bị này."
      : "Push notifications are ready on this device.",
    icon: "/android-icon-192x192.png",
    tag: "yeahbuddy-push-test",
    title: "YeahBuddy",
    url: "/dashboard",
  }))
}

export {
  getPushPublicConfig,
  revokePushSubscriptionForUser,
  savePushSubscriptionForUser,
  sendPushToSubscription,
  sendPushToUser,
  sendTestPushForUser,
}
export type { PushSubscriptionInput }
export type { PushPayload, PushSendResult }
