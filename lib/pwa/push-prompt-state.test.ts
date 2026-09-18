import { beforeEach, describe, expect, it } from "vitest"

import { canShowPushPrompt, resetPushPrompt, snoozePushPrompt, stopAskingForPushPrompt } from "./push-prompt-state"

const DAY_MS = 86_400_000
const NOW = Date.UTC(2026, 8, 18, 9, 0, 0)

beforeEach(() => {
  window.localStorage.clear()
})

describe("push prompt scheduling", () => {
  it("shows the soft-ask when it has never been dismissed", () => {
    expect(canShowPushPrompt(NOW)).toBe(true)
  })

  it("holds the prompt for three days after the first dismissal", () => {
    snoozePushPrompt(NOW)

    expect(canShowPushPrompt(NOW + 2 * DAY_MS)).toBe(false)
    expect(canShowPushPrompt(NOW + 3 * DAY_MS)).toBe(true)
  })

  it("widens the window on the second dismissal and stops asking after the third", () => {
    snoozePushPrompt(NOW)
    snoozePushPrompt(NOW + 3 * DAY_MS)

    expect(canShowPushPrompt(NOW + 10 * DAY_MS)).toBe(false)
    expect(canShowPushPrompt(NOW + 17 * DAY_MS)).toBe(true)

    snoozePushPrompt(NOW + 17 * DAY_MS)
    expect(canShowPushPrompt(NOW + 400 * DAY_MS)).toBe(false)
  })

  it("stops asking once the permission question is settled", () => {
    stopAskingForPushPrompt()

    expect(canShowPushPrompt(NOW + 400 * DAY_MS)).toBe(false)
  })

  it("treats corrupted storage as never asked", () => {
    window.localStorage.setItem("yeahbuddy:push-prompt", "not json")

    expect(canShowPushPrompt(NOW)).toBe(true)
  })

  it("reopens the prompt after a reset", () => {
    stopAskingForPushPrompt()
    resetPushPrompt()

    expect(canShowPushPrompt(NOW)).toBe(true)
  })
})
