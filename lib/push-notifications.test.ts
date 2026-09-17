import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  deletePushSubscription: vi.fn(),
  savePushSubscription: vi.fn(),
}))

vi.mock("@/lib/fitness/api", () => ({
  deletePushSubscription: mocks.deletePushSubscription,
  fetchPushConfig: vi.fn(),
  savePushSubscription: mocks.savePushSubscription,
  sendTestPush: vi.fn(),
}))

import { revokeCurrentPushSubscription, syncCurrentPushSubscription } from "./push-notifications"

const json = {
  endpoint: "https://push.example/subscription",
  expirationTime: null,
  keys: { auth: "auth", p256dh: "p256dh" },
}
const subscription = {
  endpoint: json.endpoint,
  toJSON: () => json,
  unsubscribe: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission: "granted" },
  })
  Object.defineProperty(window, "PushManager", { configurable: true, value: class PushManager {} })
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  })
  Object.defineProperties(navigator, {
    maxTouchPoints: { configurable: true, value: 0 },
    platform: { configurable: true, value: "Linux" },
    serviceWorker: {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) },
    },
    userAgent: { configurable: true, value: "Mozilla/5.0 Chrome/140" },
  })
})

describe("push subscription account ownership", () => {
  it("rebinds an existing endpoint with the active account token and locale", async () => {
    await expect(syncCurrentPushSubscription("account-b-token", "vi")).resolves.toBe(true)
    expect(mocks.savePushSubscription).toHaveBeenCalledWith("account-b-token", json, "vi")
  })

  it("revokes server ownership without unsubscribing the reusable browser endpoint", async () => {
    await expect(revokeCurrentPushSubscription("account-a-token")).resolves.toBe(true)
    expect(mocks.deletePushSubscription).toHaveBeenCalledWith("account-a-token", json.endpoint)
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  it("invalidates the browser endpoint when server revocation is unavailable", async () => {
    mocks.deletePushSubscription.mockRejectedValueOnce(new Error("offline"))

    await expect(revokeCurrentPushSubscription("account-a-token")).rejects.toThrow("offline")
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })
})
