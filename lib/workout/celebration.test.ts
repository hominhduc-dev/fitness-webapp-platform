import { afterEach, describe, expect, it, vi } from "vitest"

import { consumeWorkoutCelebration, markWorkoutCelebration, prefersReducedMotion } from "./celebration"

const KEY = "yeahbuddy-workout-celebration"

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe("workout celebration flag", () => {
  it("hands the finished session across the navigation", () => {
    markWorkoutCelebration({ savedOnline: true, workoutName: "Push Day A" })

    expect(consumeWorkoutCelebration()).toEqual({ savedOnline: true, workoutName: "Push Day A" })
  })

  /** The whole point of the flag: one finish must not celebrate twice. */
  it("is spent by the first read", () => {
    markWorkoutCelebration({ savedOnline: true, workoutName: "Push Day A" })

    expect(consumeWorkoutCelebration()).not.toBeNull()
    expect(consumeWorkoutCelebration()).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("returns nothing when no session was finished", () => {
    expect(consumeWorkoutCelebration()).toBeNull()
  })

  it("keeps the offline flag, so a queued log is not announced as uploaded", () => {
    markWorkoutCelebration({ savedOnline: false, workoutName: "Leg Day" })

    expect(consumeWorkoutCelebration()).toEqual({ savedOnline: false, workoutName: "Leg Day" })
  })

  it("ignores a malformed entry instead of rendering it", () => {
    window.sessionStorage.setItem(KEY, "{not json")
    expect(consumeWorkoutCelebration()).toBeNull()

    window.sessionStorage.setItem(KEY, JSON.stringify({ savedOnline: true }))
    expect(consumeWorkoutCelebration()).toBeNull()

    window.sessionStorage.setItem(KEY, JSON.stringify("just a string"))
    expect(consumeWorkoutCelebration()).toBeNull()
  })

  it("treats a missing savedOnline as offline rather than claiming an upload", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ workoutName: "Pull Day" }))

    expect(consumeWorkoutCelebration()).toEqual({ savedOnline: false, workoutName: "Pull Day" })
  })

  /**
   * Safari in private mode throws on setItem. Losing the confetti is fine;
   * taking the finish flow down with it is not.
   */
  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(() => markWorkoutCelebration({ savedOnline: true, workoutName: "Push" })).not.toThrow()

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(consumeWorkoutCelebration()).toBeNull()
  })
})

/** jsdom ships no matchMedia at all, so each case installs the one it needs. */
describe("prefersReducedMotion", () => {
  const original = window.matchMedia

  afterEach(() => {
    window.matchMedia = original
  })

  function stubMatchMedia(matches: boolean | undefined) {
    window.matchMedia = (matches === undefined
      ? undefined
      : (() => ({ matches }))) as unknown as typeof window.matchMedia
  }

  it("reports what the media query says", () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)

    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  /** Older WebKit and any non-browser runtime reach here without matchMedia. */
  it("falls back to allowing motion when matchMedia is missing", () => {
    stubMatchMedia(undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
