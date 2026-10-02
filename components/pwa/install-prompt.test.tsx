import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { canShowInstallPrompt } from "@/lib/pwa/install-prompt-state"

import { InstallPrompt } from "./install-prompt"

const state = vi.hoisted(() => ({
  activeSessions: [] as unknown[],
  pathname: "/dashboard",
  platform: "ios-safari" as string,
}))

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")
  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

vi.mock("@/lib/pwa/install-platform", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pwa/install-platform")>("@/lib/pwa/install-platform")
  return { ...actual, readInstallPlatform: () => state.platform }
})

vi.mock("@/lib/workout/session-storage", () => ({ scanActiveSessions: () => state.activeSessions }))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.localStorage.clear()
  state.activeSessions = []
  state.pathname = "/dashboard"
  state.platform = "ios-safari"
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function renderAfterDelay() {
  render(<InstallPrompt />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8_000)
  })
}

describe("InstallPrompt", () => {
  it("waits for the visit to look intentional, then shows the iPhone steps from Share on", async () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })

    expect(screen.getByText("Add YeahBuddy to your Home Screen")).toBeInTheDocument()
    expect(screen.getByText("Open the Share menu")).toBeInTheDocument()
    expect(screen.queryByText("Open this page in Safari")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See the full guide" })).toHaveAttribute("href", "/install")
  })

  it("never asks when opened from the Home Screen or on a desktop", async () => {
    state.platform = "installed"
    await renderAfterDelay()
    expect(screen.queryByText("Add YeahBuddy to your Home Screen")).not.toBeInTheDocument()
    cleanup()

    state.platform = "desktop"
    await renderAfterDelay()
    expect(screen.queryByText("Add YeahBuddy to your Home Screen")).not.toBeInTheDocument()
  })

  it("stays out of the way during a workout", async () => {
    state.pathname = "/workout/abc/start"
    await renderAfterDelay()
    expect(screen.queryByText("Add YeahBuddy to your Home Screen")).not.toBeInTheDocument()
    cleanup()

    state.pathname = "/dashboard"
    state.activeSessions = [{}]
    await renderAfterDelay()
    expect(screen.queryByText("Add YeahBuddy to your Home Screen")).not.toBeInTheDocument()
  })

  it("snoozes on Later and stops for good on Don't remind me", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAfterDelay()

    await user.click(screen.getByRole("button", { name: "Later" }))
    expect(screen.queryByText("Add YeahBuddy to your Home Screen")).not.toBeInTheDocument()
    expect(canShowInstallPrompt(Date.now() + 86_400_000)).toBe(false)
    expect(canShowInstallPrompt(Date.now() + 3 * 86_400_000)).toBe(true)

    window.localStorage.clear()
    cleanup()
    await renderAfterDelay()
    await user.click(screen.getByRole("button", { name: "Don't remind me" }))
    expect(canShowInstallPrompt(Date.now() + 1000 * 86_400_000)).toBe(false)
  })

  it("tells in-app browser users to reopen in Safari or Chrome", async () => {
    state.platform = "in-app"
    await renderAfterDelay()

    expect(screen.getByText(/can't add websites to the Home Screen/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
  })

  it("offers Chrome's install prompt on Android and stops asking once accepted", async () => {
    state.platform = "android"
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAfterDelay()
    expect(screen.queryByRole("button", { name: "Install YeahBuddy" })).not.toBeInTheDocument()

    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)

    await user.click(screen.getByRole("button", { name: "Install YeahBuddy" }))
    expect(prompt).toHaveBeenCalled()
    expect(canShowInstallPrompt(Date.now() + 1000 * 86_400_000)).toBe(false)
  })
})
