import { afterEach, describe, expect, it, vi } from "vitest"

import { getPushCapability } from "./push-support"

function setNavigator(input: { maxTouchPoints?: number; platform?: string; userAgent: string }, standalone: boolean) {
  Object.defineProperties(navigator, {
    maxTouchPoints: { configurable: true, value: input.maxTouchPoints ?? 0 },
    platform: { configurable: true, value: input.platform ?? "", writable: true },
    userAgent: { configurable: true, value: input.userAgent, writable: true },
  })
  Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone })
  Object.defineProperty(window, "PushManager", { configurable: true, value: class PushManager {} })
  Object.defineProperty(window, "Notification", { configurable: true, value: class Notification {} })
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} })
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: standalone } as MediaQueryList)),
  })
}

afterEach(() => vi.restoreAllMocks())

describe("getPushCapability", () => {
  it("asks iPhone Safari users to install the Home Screen app", () => {
    setNavigator({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)" }, false)
    expect(getPushCapability()).toBe("ios_install_required")
  })

  it("supports an installed iPhone web app when Push APIs are exposed", () => {
    setNavigator({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)" }, true)
    expect(getPushCapability()).toBe("supported")
  })

  it("detects iPadOS desktop user agents", () => {
    setNavigator({ maxTouchPoints: 5, platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh)" }, false)
    expect(getPushCapability()).toBe("ios_install_required")
  })
})
