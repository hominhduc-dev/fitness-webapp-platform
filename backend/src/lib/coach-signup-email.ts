import { env } from "../config/env"
import { renderBrandedEmail } from "./email/branded-email"
import { isEmailConfigured, sendEmail } from "./email/smtp"

type CoachSignupDecision = "approved" | "rejected"

/** What happened to the decision email: sent, not attempted (no SMTP set up), or failed. */
export type CoachSignupEmailStatus = "failed" | "sent" | "skipped"

/** Subject, HTML and plain text of the decision email, in the Auth emails' layout. */
export function buildCoachSignupDecisionEmail(input: { decision: CoachSignupDecision; name: string }) {
  const loginUrl = new URL("/?auth=login", env.frontendUrl).toString()
  const replyTo = env.smtp.replyTo
  const greeting = `Chào ${input.name},`

  if (input.decision === "approved") {
    const paragraphs = [
      `${greeting} hồ sơ đăng ký coach của bạn trên YeahBuddy Fitness đã được duyệt.`,
      "Đăng nhập để tạo chương trình tập, mời học viên và theo dõi tiến độ của họ.",
    ]
    const note = "Bạn nhận email này vì đã đăng ký làm coach trên YeahBuddy Fitness bằng địa chỉ này."
    return {
      subject: "Hồ sơ coach của bạn đã được duyệt",
      html: renderBrandedEmail({
        button: { label: "Đăng nhập YeahBuddy", url: loginUrl },
        heading: "Hồ sơ coach đã được duyệt",
        lang: "vi",
        note,
        paragraphs,
        preview: "Bạn có thể đăng nhập YeahBuddy Fitness với vai trò coach ngay bây giờ.",
        title: "Hồ sơ coach đã được duyệt",
      }),
      text: `${paragraphs.join("\n\n")}\n\nĐăng nhập: ${loginUrl}\n\n${note}\n\nYeahBuddy Fitness`,
    }
  }

  const paragraphs = [
    `${greeting} cảm ơn bạn đã đăng ký làm coach trên YeahBuddy Fitness.`,
    "Sau khi xem xét, hồ sơ của bạn chưa được duyệt ở thời điểm này.",
    replyTo
      ? "Nếu muốn trao đổi thêm hoặc bổ sung thông tin, bạn chỉ cần trả lời email này."
      : "Nếu muốn trao đổi thêm hoặc bổ sung thông tin, hãy liên hệ với đội ngũ YeahBuddy Fitness.",
  ]
  const note = "Bạn nhận email này vì đã đăng ký làm coach trên YeahBuddy Fitness bằng địa chỉ này."
  return {
    subject: "Kết quả đăng ký coach YeahBuddy",
    html: renderBrandedEmail({
      heading: "Hồ sơ coach chưa được duyệt",
      lang: "vi",
      note,
      paragraphs,
      preview: "Kết quả xem xét hồ sơ đăng ký coach của bạn trên YeahBuddy Fitness.",
      title: "Kết quả đăng ký coach",
    }),
    text: `${paragraphs.join("\n\n")}\n\n${note}\n\nYeahBuddy Fitness`,
  }
}

/**
 * Emails the applicant the admin's decision over the shared SMTP account.
 * Returns "skipped" when no SMTP is configured (local dev); a send that fails
 * throws, so the caller can report it without undoing the decision.
 */
export async function sendCoachSignupDecisionEmail(input: {
  decision: CoachSignupDecision
  email: string
  name: string
}): Promise<Exclude<CoachSignupEmailStatus, "failed">> {
  if (!isEmailConfigured()) return "skipped"

  const message = buildCoachSignupDecisionEmail(input)
  await sendEmail({
    ...message,
    // Only a rejection invites a reply, and only to a mailbox someone reads.
    replyTo: input.decision === "rejected" ? env.smtp.replyTo : undefined,
    to: input.email,
  })
  return "sent"
}
