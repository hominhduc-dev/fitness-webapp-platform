import { env } from "../config/env"
import { AppError, ExternalServiceError } from "../services/errors"

type CoachSignupDecision = "approved" | "rejected"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}

export async function sendCoachSignupDecisionEmail(input: {
  decision: CoachSignupDecision
  decidedAt: Date
  email: string
  name: string
  userId: string
}) {
  if (!env.resendApiKey || !env.emailFrom) {
    throw new AppError("Coach signup email is not configured (RESEND_API_KEY and EMAIL_FROM).")
  }

  const approved = input.decision === "approved"
  const subject = approved ? "Hồ sơ coach YeahBuddy đã được duyệt" : "Kết quả đăng ký coach YeahBuddy"
  const greeting = `Chào ${input.name},`
  const message = approved
    ? "Hồ sơ coach của bạn đã được duyệt. Bạn có thể đăng nhập và bắt đầu sử dụng workspace dành cho coach."
    : "Cảm ơn bạn đã đăng ký làm coach. Rất tiếc, hồ sơ của bạn chưa được duyệt ở thời điểm này. Nếu cần trao đổi thêm, vui lòng liên hệ quản trị viên."
  const loginUrl = new URL("/?auth=login", env.frontendUrl).toString()
  const text = `${greeting}\n\n${message}${approved ? `\n\nĐăng nhập: ${loginUrl}` : ""}\n\nYeahBuddy Fitness`
  const html = `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(message)}</p>${approved ? `<p><a href="${escapeHtml(loginUrl)}">Đăng nhập YeahBuddy</a></p>` : ""}<p>YeahBuddy Fitness</p>`

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `coach-signup-${input.userId}-${input.decision}-${input.decidedAt.getTime()}`,
    },
    body: JSON.stringify({ from: env.emailFrom, to: [input.email], subject, html, text }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    throw new ExternalServiceError(`Resend rejected coach signup email (HTTP ${response.status}).`)
  }
}
