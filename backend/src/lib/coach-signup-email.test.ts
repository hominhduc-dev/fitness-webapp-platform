import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const configuration = vi.hoisted(() => ({
  emailFrom: "YeahBuddy Fitness <hello@yeahbuddy.fit>" as string | undefined,
  frontendUrl: "https://yeahbuddy.fit",
  resendApiKey: "test-key" as string | undefined,
}))

vi.mock("../config/env", () => ({ env: configuration }))

import { sendCoachSignupDecisionEmail } from "./coach-signup-email"

const applicant = {
  decidedAt: new Date("2026-09-27T01:00:00.000Z"),
  email: "coach@example.com",
  name: "Minh <Coach>",
  userId: "coach-123",
}

describe("coach signup decision email", () => {
  beforeEach(() => {
    configuration.resendApiKey = "test-key"
    configuration.emailFrom = "YeahBuddy Fitness <hello@yeahbuddy.fit>"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it("sends approval with a login link and escapes the coach name", async () => {
    await sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(String(init?.body))
    expect(url).toBe("https://api.resend.com/emails")
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Idempotency-Key": `coach-signup-coach-123-approved-${applicant.decidedAt.getTime()}`,
    })
    expect(body.to).toEqual(["coach@example.com"])
    expect(body.html).toContain("Minh &lt;Coach&gt;")
    expect(body.html).toContain("https://yeahbuddy.fit/?auth=login")
    expect(body.text).toContain("đã được duyệt")
  })

  it("sends rejection without a sign-in link", async () => {
    await sendCoachSignupDecisionEmail({ ...applicant, decision: "rejected" })

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))
    expect(body.text).toContain("chưa được duyệt")
    expect(body.html).not.toContain("Đăng nhập YeahBuddy")
  })

  it("reports missing configuration and provider failures", async () => {
    configuration.resendApiKey = undefined
    await expect(sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })).rejects.toThrow("not configured")
    expect(fetch).not.toHaveBeenCalled()

    configuration.resendApiKey = "test-key"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })).rejects.toThrow("HTTP 403")
  })
})
