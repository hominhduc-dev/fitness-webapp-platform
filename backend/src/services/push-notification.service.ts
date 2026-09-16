import webpush, { type PushSubscription as WebPushSubscription } from "web-push"

import { env } from "../config/env"
import { logger } from "../lib/logger"
import { ensurePrisma } from "./fitness-data/shared/guards"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"

type PushSubscriptionInput = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    auth: string
    p256dh: string
  }
}

type PushPayload = {
  badge?: string
  body: string
  data?: Record<string, unknown>
  icon?: string
  tag?: string
  title: string
  url?: string
}

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
  const subscription = await db.pushSubscription.upsert({
    create: {
      auth: input.keys.auth,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      userAgent,
      userId: profile.id,
    },
    update: {
      auth: input.keys.auth,
      p256dh: input.keys.p256dh,
      revokedAt: null,
      userAgent,
      userId: profile.id,
    },
    where: { endpoint: input.endpoint },
  })

  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
  }
}

async function revokePushSubscriptionForUser(profile: SerializedProfile, endpoint: string) {
  const db = ensurePrisma()
  await db.pushSubscription.updateMany({
    data: { revokedAt: new Date() },
    where: {
      endpoint,
      userId: profile.id,
    },
  })

  return { revoked: true }
}

async function sendPushToUser(userId: string, payload: PushPayload) {
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
    const webPushSubscription: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.auth,
        p256dh: subscription.p256dh,
      },
    }

    try {
      await webpush.sendNotification(webPushSubscription, JSON.stringify(payload))
      sent += 1
    } catch (error) {
      failed += 1
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : undefined

      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.update({
          data: { revokedAt: new Date() },
          where: { id: subscription.id },
        })
        return
      }

      logger.warn("push notification send failed", { error, subscriptionId: subscription.id, userId })
    }
  }))

  return { failed, sent }
}

async function sendTestPushForUser(profile: SerializedProfile) {
  return sendPushToUser(profile.id, {
    body: "Push notification đã sẵn sàng trên thiết bị này.",
    icon: "/android-icon-192x192.png",
    tag: "yeahbuddy-push-test",
    title: "YeahBuddy",
    url: "/dashboard",
  })
}

export {
  getPushPublicConfig,
  revokePushSubscriptionForUser,
  savePushSubscriptionForUser,
  sendPushToUser,
  sendTestPushForUser,
}
export type { PushSubscriptionInput }
