import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { canShowPushPrompt } from "@/lib/pwa/push-prompt-state"

import { PushPermissionPrompt } from "./push-permission-prompt"

const state = vi.hoisted(() => ({
  activeSessions: [] as unknown[],
  push: {
    enabled: false,
    isBusy: false,
    state: "disabled" as string,
    subscribe: vi.fn(),
  },
  session: { access_token: "token" } as { access_token: string } | null,
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ session: state.session }) }))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

vi.mock("@/components/providers/toast-provider", () => ({ useToast: () => ({ toast: state.toast }) }))

vi.mock("@/lib/push-notifications", () => ({ usePushNotifications: () => state.push }))

vi.mock("@/lib/workout/session-storage", () => ({ scanActiveSessions: () => state.activeSessions }))

function resetState() {
  state.activeSessions = []
  state.push = { enabled: false, isBusy: false, state: "disabled", subscribe: vi.fn().mockResolvedValue(undefined) }
  state.session = { access_token: "token" }
  state.toast = vi.fn()
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.localStorage.clear()
  resetState()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function renderAfterDelay() {
  render(<PushPermissionPrompt />)
  await advance(8_000)
}

describe("PushPermissionPrompt", () => {
  it("stays hidden until the visit has lasted a few seconds", async () => {
    render(<PushPermissionPrompt />)
    await advance(3_000)
    expect(screen.queryByText("Turn on notifications")).not.toBeInTheDocument()

    await advance(5_000)
    expect(screen.getByText("Turn on notifications")).toBeInTheDocument()
  })

  it("subscribes from the tap and stops asking once notifications are on", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAfterDelay()

    await user.click(screen.getByRole("button", { name: "Turn on" }))

    await waitFor(() => expect(state.push.subscribe).toHaveBeenCalledOnce())
    expect(screen.queryByText("Turn on notifications")).not.toBeInTheDocument()
    expect(canShowPushPrompt()).toBe(false)
  })

  it("snoozes instead of silencing when the ask is postponed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await renderAfterDelay()

    await user.click(screen.getByRole("button", { name: "Not now" }))

    expect(state.push.subscribe).not.toHaveBeenCalled()
    expect(canShowPushPrompt()).toBe(false)
    expect(canShowPushPrompt(Date.now() + 4 * 86_400_000)).toBe(true)
  })

  it("explains the Home Screen install on iOS instead of asking for permission", async () => {
    state.push.state = "ios_install_required"
    await renderAfterDelay()

    expect(screen.getByText("Add YeahBuddy to your Home Screen")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument()
  })

  it("restores a lost subscription silently when permission is already granted", async () => {
    state.push.state = "granted"
    await renderAfterDelay()

    expect(state.push.subscribe).toHaveBeenCalledOnce()
    expect(screen.queryByText("Turn on notifications")).not.toBeInTheDocument()
  })

  it("keeps quiet for signed-out visitors and while a workout is in progress", async () => {
    state.session = null
    await renderAfterDelay()
    expect(screen.queryByText("Turn on notifications")).not.toBeInTheDocument()

    cleanup()
    resetState()
    state.activeSessions = [{ workoutId: "w1" }]
    await renderAfterDelay()
    expect(screen.queryByText("Turn on notifications")).not.toBeInTheDocument()
  })
})
