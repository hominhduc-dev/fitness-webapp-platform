import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { AuthModal } from "./auth-modal"

const api = vi.hoisted(() => ({ registerRequest: vi.fn(), signInWithOAuth: vi.fn() }))

vi.mock("@/lib/auth/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/api")>("@/lib/auth/api")

  return {
    ApiError: actual.ApiError,
    forgotPasswordRequest: vi.fn(),
    loginRequest: vi.fn(),
    registerRequest: api.registerRequest,
  }
})
vi.mock("@/lib/analytics/registration", () => ({ trackRegistrationEvent: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({
  getOptionalBrowserSupabaseClient: () => ({ auth: { signInWithOAuth: api.signInWithOAuth } }),
}))
vi.mock("@/lib/supabase/config", () => ({
  getAppBaseUrl: () => "https://yeahbuddy.test",
  getSupabasePublicConfigError: () => null,
}))
vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

function renderRegisterModal() {
  render(<AuthModal defaultTab="register" onOpenChange={vi.fn()} open />)
}

function fillRegisterForm() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Coach Minh" } })
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "coach@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } })
  fireEvent.click(screen.getByRole("checkbox"))
}

describe("AuthModal signup role picker", () => {
  beforeEach(() => {
    api.signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null })
    api.registerRequest.mockReset().mockResolvedValue({
      message: "pending",
      profile: null,
      requiresApproval: true,
      requiresEmailConfirmation: false,
      session: null,
      user: null,
    })
  })

  afterEach(cleanup)

  it("lets a signup choose coach and sends that role to the API", async () => {
    renderRegisterModal()

    expect(screen.getByRole("button", { name: /I'm a Client/ })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: /I'm a Coach/ }))
    fillRegisterForm()
    fireEvent.click(screen.getByRole("button", { name: /Create free account/ }))

    await waitFor(() => expect(api.registerRequest).toHaveBeenCalled())
    expect(api.registerRequest).toHaveBeenCalledWith(expect.objectContaining({
      email: "coach@example.com",
      name: "Coach Minh",
      role: "coach",
    }))
  })
})
