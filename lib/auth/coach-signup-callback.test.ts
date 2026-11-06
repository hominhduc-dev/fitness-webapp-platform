import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/auth/callback/route"

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), signOut: vi.fn() }))
const claim = vi.hoisted(() => vi.fn())

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth }) }))
vi.mock("@/lib/auth/api", () => ({ claimOAuthRoleRequest: claim }))
vi.mock("@/lib/supabase/config", () => ({
  getSupabasePublicConfig: () => ({ url: "https://auth.example.com", publishableKey: "test" }),
}))

const origin = "https://yeahbuddy.test"

describe("coach signup callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes an implicit email return to the signup screen without exchanging a code", async () => {
    const response = await GET(new NextRequest(`${origin}/auth/callback?flow=coach-email`))

    expect(response.headers.get("location")).toBe(`${origin}/coach-signup?status=email-return`)
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })

  it("reports successful code-based email confirmation without claiming the OAuth role", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { email_confirmed_at: "2026-11-06T00:00:00Z" }, session: { access_token: "test" } },
      error: null,
    })
    auth.signOut.mockResolvedValue({ error: null })

    const response = await GET(new NextRequest(`${origin}/auth/callback?flow=coach-email&code=test`))

    expect(response.headers.get("location")).toBe(`${origin}/coach-signup?status=email-confirmed`)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(claim).not.toHaveBeenCalled()
  })

  it("passes an expired email error to the recoverable signup state", async () => {
    const response = await GET(new NextRequest(`${origin}/auth/callback?flow=coach-email&error_code=otp_expired`))

    expect(response.headers.get("location")).toBe(`${origin}/coach-signup?status=email-failed`)
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("keeps the OAuth coach review handoff", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: "test" } },
      error: null,
    })
    auth.signOut.mockResolvedValue({ error: null })
    claim.mockResolvedValue({ requiresApproval: true })

    const response = await GET(new NextRequest(`${origin}/auth/callback?role=coach&code=test`))

    expect(response.headers.get("location")).toBe(`${origin}/coach-signup?status=pending`)
    expect(claim).toHaveBeenCalledWith("test", "coach")
  })
})

