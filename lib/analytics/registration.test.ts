import { beforeEach, describe, expect, it, vi } from "vitest"

const track = vi.hoisted(() => vi.fn())
vi.mock("@vercel/analytics", () => ({ track }))

import { trackRegistrationEvent } from "./registration"

describe("registration analytics", () => {
  beforeEach(() => {
    track.mockReset()
    delete (window as Window & { gtag?: unknown }).gtag
  })

  it("sends the successful signup event to both configured analytics destinations", () => {
    const gtag = vi.fn()
    ;(window as Window & { gtag?: typeof gtag }).gtag = gtag

    trackRegistrationEvent("sign_up", { method: "email", email_confirmation_required: true })

    expect(track).toHaveBeenCalledWith("sign_up", { method: "email", email_confirmation_required: true })
    expect(gtag).toHaveBeenCalledWith("event", "sign_up", { method: "email", email_confirmation_required: true })
  })

  it("still records form activity when GA4 is not configured", () => {
    expect(() => trackRegistrationEvent("form_view")).not.toThrow()
    expect(track).toHaveBeenCalledWith("registration_form_view", undefined)
  })
})
