import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), signUp: vi.fn() }))

vi.mock("../../lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }))
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: null,
  supabasePublic: { auth: { signUp: mocks.signUp } },
}))

import { registerUser } from "./core"

describe("registerUser", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue(null)
    mocks.signUp.mockReset().mockResolvedValue({ data: { session: null, user: null }, error: null })
  })

  it("creates an email signup without requiring or sending phone and username", async () => {
    const result = await registerUser({ email: "Trainee@Example.com", name: " New Trainee ", password: "password123" })

    expect(mocks.findUnique).toHaveBeenCalledTimes(1)
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "trainee@example.com",
      options: expect.objectContaining({ data: { name: "New Trainee", role: "trainee" } }),
      password: "password123",
    }))
    expect(result.requiresEmailConfirmation).toBe(true)
  })

  it("still checks and sends optional identifiers for older clients", async () => {
    await registerUser({
      email: "trainee@example.com",
      name: "New Trainee",
      password: "password123",
      phone: "0912345678",
      username: "newtrainee",
    })

    expect(mocks.findUnique).toHaveBeenCalledTimes(3)
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        data: { name: "New Trainee", phone: "+84912345678", role: "trainee", username: "newtrainee" },
      }),
    }))
  })

  it("forwards a Turnstile token to Supabase", async () => {
    await registerUser({
      captchaToken: "turnstile-token",
      email: "trainee@example.com",
      name: "New Trainee",
      password: "password123",
    })

    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ captchaToken: "turnstile-token" }),
    }))
  })
})
