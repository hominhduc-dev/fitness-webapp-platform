import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { CoachSignupForm } from "./coach-signup-form"

const api = vi.hoisted(() => ({ registerRequest: vi.fn() }))

vi.mock("@/lib/auth/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/api")>("@/lib/auth/api")

  return { ApiError: actual.ApiError, registerRequest: api.registerRequest }
})
vi.mock("@/lib/analytics/registration", () => ({ trackRegistrationEvent: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({
  getAppBaseUrl: () => "https://yeahbuddy.test",
  getSupabasePublicConfigError: () => null,
}))
vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

function fillForm() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Coach Minh" } })
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "coach@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } })
  fireEvent.click(screen.getByRole("checkbox"))
}

describe("coach signup form", () => {
  beforeEach(() => {
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

  it("registers with the coach role and lands on the pending screen", async () => {
    render(<CoachSignupForm />)
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Apply as a coach/ }))

    await waitFor(() => expect(api.registerRequest).toHaveBeenCalled())
    expect(api.registerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ email: "coach@example.com", name: "Coach Minh", role: "coach" }),
    )

    // The account is locked until an admin approves it, so no redirect: the
    // form has to say what happens next.
    expect(await screen.findByText("Application received")).toBeInTheDocument()
  })

  it("keeps submit disabled until the terms are accepted", () => {
    render(<CoachSignupForm />)

    expect(screen.getByRole("button", { name: /Apply as a coach/ })).toBeDisabled()
  })

  it("surfaces the backend message when the signup is refused", async () => {
    api.registerRequest.mockRejectedValue(new Error("Email này đã được sử dụng."))
    render(<CoachSignupForm />)
    fillForm()
    fireEvent.click(screen.getByRole("button", { name: /Apply as a coach/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Email này đã được sử dụng.")
    expect(screen.queryByText("Application received")).not.toBeInTheDocument()
  })
})
