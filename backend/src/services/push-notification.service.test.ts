import { PushDeliveryStatus, type UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  deliveryUpdateMany: vi.fn(),
  subscriptionFindMany: vi.fn(),
  subscriptionUpdateMany: vi.fn(),
  subscriptionUpsert: vi.fn(),
  transaction: vi.fn(),
}))

const transactionClient = {
  pushDelivery: { updateMany: mocks.deliveryUpdateMany },
  pushSubscription: {
    findMany: mocks.subscriptionFindMany,
    updateMany: mocks.subscriptionUpdateMany,
    upsert: mocks.subscriptionUpsert,
  },
}

vi.mock("../config/env", () => ({
  env: {
    databaseUrl: "postgresql://example.test/db",
    vapidPrivateKey: "private",
    vapidPublicKey: "public",
    vapidSubject: "mailto:test@example.com",
  },
}))
vi.mock("../lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}))

import type { SerializedProfile } from "./auth.service"
import { revokePushSubscriptionForUser, savePushSubscriptionForUser } from "./push-notification.service"

const profile = { id: "user-b", role: "trainee" as UserRole } as SerializedProfile
const input = {
  endpoint: "https://push.example/device",
  keys: { auth: "auth", p256dh: "p256dh" },
  locale: "vi" as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (callback: (transaction: typeof transactionClient) => unknown) => callback(transactionClient))
  mocks.subscriptionUpsert.mockResolvedValue({ endpoint: input.endpoint, id: "subscription-1" })
  mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 })
})

describe("push subscription ownership", () => {
  it("rebinds the endpoint and terminates queued deliveries belonging to another account", async () => {
    await savePushSubscriptionForUser(profile, input, "test-agent")

    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ locale: "vi", userId: "user-b" }),
    }))
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      data: {
        lastError: "Subscription rebound to another account",
        status: PushDeliveryStatus.failed,
      },
      where: {
        notification: { userId: { not: "user-b" } },
        status: { in: [PushDeliveryStatus.pending, PushDeliveryStatus.processing, PushDeliveryStatus.retrying] },
        subscriptionId: "subscription-1",
      },
    })
  })

  it("revokes ownership and terminates outstanding deliveries on logout", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([{ id: "subscription-1" }])

    await revokePushSubscriptionForUser(profile, input.endpoint)

    expect(mocks.subscriptionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["subscription-1"] } },
    }))
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { lastError: "Subscription revoked", status: PushDeliveryStatus.failed },
    }))
  })
})
