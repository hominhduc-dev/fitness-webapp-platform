import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SESSION_LAYOUT,
  parseSessionLayout,
  readSessionLayout,
  sessionLayoutStorageKey,
  useSessionLayout,
} from "./use-session-layout"

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("the stored session layout", () => {
  it("reads back a known layout and falls back to the default otherwise", () => {
    expect(parseSessionLayout("stack")).toBe("stack")
    expect(parseSessionLayout("single")).toBe("single")
    expect(parseSessionLayout("grid")).toBe(DEFAULT_SESSION_LAYOUT)
    expect(parseSessionLayout(null)).toBe(DEFAULT_SESSION_LAYOUT)
  })

  it("starts as one exercise at a time", () => {
    expect(DEFAULT_SESSION_LAYOUT).toBe("single")
    expect(readSessionLayout("user-1")).toBe("single")
  })

  it("is kept per account", () => {
    window.localStorage.setItem(sessionLayoutStorageKey("user-1"), "stack")
    expect(readSessionLayout("user-1")).toBe("stack")
    expect(readSessionLayout("user-2")).toBe("single")
    expect(readSessionLayout(null)).toBe("single")
  })

  it("uses the default when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readSessionLayout("user-1")).toBe("single")
  })
})

describe("useSessionLayout", () => {
  it("saves the choice so a reload comes back to it", () => {
    const { result, unmount } = renderHook(() => useSessionLayout("user-1"))
    expect(result.current[0]).toBe("single")

    act(() => result.current[1]("stack"))
    expect(result.current[0]).toBe("stack")
    expect(window.localStorage.getItem(sessionLayoutStorageKey("user-1"))).toBe("stack")

    // A fresh mount stands in for the page loading again.
    unmount()
    const reloaded = renderHook(() => useSessionLayout("user-1"))
    expect(reloaded.result.current[0]).toBe("stack")
  })

  it("keeps nothing before the account is known", () => {
    const { result } = renderHook(() => useSessionLayout(null))
    act(() => result.current[1]("stack"))
    expect(result.current[0]).toBe("single")
    expect(window.localStorage.length).toBe(0)
  })
})
