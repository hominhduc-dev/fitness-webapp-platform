import { beforeEach, describe, expect, it } from "vitest"

import { canShowInstallPrompt, snoozeInstallPrompt, stopAskingForInstallPrompt } from "./install-prompt-state"
import { canShowPushPrompt } from "./push-prompt-state"

const DAY_MS = 86_400_000
const NOW = Date.UTC(2026, 9, 2, 9, 0, 0)

beforeEach(() => {
  window.localStorage.clear()
})

describe("install prompt scheduling", () => {
  it("backs off 3 days, then 14, then stops asking", () => {
    expect(canShowInstallPrompt(NOW)).toBe(true)

    snoozeInstallPrompt(NOW)
    expect(canShowInstallPrompt(NOW + 2 * DAY_MS)).toBe(false)
    expect(canShowInstallPrompt(NOW + 3 * DAY_MS)).toBe(true)

    snoozeInstallPrompt(NOW + 3 * DAY_MS)
    expect(canShowInstallPrompt(NOW + 16 * DAY_MS)).toBe(false)
    expect(canShowInstallPrompt(NOW + 17 * DAY_MS)).toBe(true)

    snoozeInstallPrompt(NOW + 17 * DAY_MS)
    expect(canShowInstallPrompt(NOW + 1000 * DAY_MS)).toBe(false)
  })

  it("stops for good when asked, without touching the push prompt", () => {
    stopAskingForInstallPrompt()

    expect(canShowInstallPrompt(NOW)).toBe(false)
    expect(canShowPushPrompt(NOW)).toBe(true)
  })
})
