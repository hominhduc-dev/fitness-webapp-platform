import { beforeEach, describe, expect, it, vi } from "vitest"

const configuration = vi.hoisted(() => ({
  frontendUrl: "https://yeahbuddy.fit",
  smtp: {
    adminEmail: "no-reply@hominhduc.me" as string | undefined,
    host: "smtp.hostinger.com" as string | undefined,
    pass: "secret" as string | undefined,
    port: 465,
    replyTo: "admin@hominhduc.me" as string | undefined,
    senderName: "YeahBuddy Fitness",
    user: "admin@hominhduc.me" as string | undefined,
  },
}))
const sendMail = vi.hoisted(() => vi.fn())

vi.mock("../config/env", () => ({ env: configuration }))
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }))

import { buildCoachSignupDecisionEmail, sendCoachSignupDecisionEmail } from "./coach-signup-email"

const applicant = { email: "coach@example.com", name: "Minh <Coach>" }

describe("coach signup decision email", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: "1" })
    configuration.smtp.host = "smtp.hostinger.com"
    configuration.smtp.replyTo = "admin@hominhduc.me"
  })

  it("sends the approval from the shared SMTP sender with a sign-in button", async () => {
    await expect(sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })).resolves.toBe("sent")

    const message = sendMail.mock.calls[0][0]
    expect(message.from).toEqual({ address: "no-reply@hominhduc.me", name: "YeahBuddy Fitness" })
    expect(message.to).toBe("coach@example.com")
    expect(message.subject).toBe("Hồ sơ coach của bạn đã được duyệt")
    expect(message.replyTo).toBeUndefined()
    expect(message.html).toContain("Minh &lt;Coach&gt;")
    expect(message.html).toContain('href="https://yeahbuddy.fit/?auth=login"')
    expect(message.text).toContain("đã được duyệt")
  })

  it("keeps the layout of the Auth email templates", () => {
    const { html } = buildCoachSignupDecisionEmail({ ...applicant, decision: "approved" })

    expect(html).toContain('lang="vi"')
    expect(html).toContain("background-color:#f5f7fa")
    expect(html).toContain("max-width:560px")
    expect(html).toContain("https://www.hominhduc.me/header-logo.png")
    expect(html).toContain('bgcolor="#155EEF"')
    expect(html).toContain("Train. Track. Progress.")
  })

  it("sends the rejection without a button, inviting a reply to a read mailbox", async () => {
    await sendCoachSignupDecisionEmail({ ...applicant, decision: "rejected" })

    const message = sendMail.mock.calls[0][0]
    expect(message.subject).toBe("Kết quả đăng ký coach YeahBuddy")
    expect(message.replyTo).toBe("admin@hominhduc.me")
    expect(message.html).not.toContain("#155EEF")
    expect(message.text).toContain("chưa được duyệt")
    expect(message.text).toContain("trả lời email này")
  })

  it("skips sending when no SMTP is configured", async () => {
    configuration.smtp.host = undefined

    await expect(sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })).resolves.toBe("skipped")
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("throws when the SMTP server refuses the message", async () => {
    sendMail.mockRejectedValue(new Error("535 Authentication failed"))

    await expect(sendCoachSignupDecisionEmail({ ...applicant, decision: "approved" })).rejects.toThrow("did not accept")
  })
})
