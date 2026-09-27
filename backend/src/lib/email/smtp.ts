import nodemailer, { type Transporter } from "nodemailer"

import { env } from "../../config/env"
import { ExternalServiceError } from "../../services/errors"

/**
 * Outgoing mail over the SMTP account Supabase Auth already uses (Hostinger,
 * the `no-reply@` alias), so app mail and auth mail share one sender and its
 * SPF/DKIM standing. Configured through the same SMTP_* names as
 * ~/supabase/.env.
 */

export type OutgoingEmail = {
  html: string
  replyTo?: string
  subject: string
  text: string
  to: string
}

/** Whether mail can go out at all; callers skip sending, not fail, when it can't. */
export function isEmailConfigured() {
  const { adminEmail, host, pass, user } = env.smtp
  return Boolean(host && user && pass && adminEmail)
}

let transporter: Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: { pass: env.smtp.pass, user: env.smtp.user },
      host: env.smtp.host,
      port: env.smtp.port,
      // 465 is implicit TLS; 587 and the rest upgrade with STARTTLS.
      secure: env.smtp.port === 465,
      // The admin waits on the send, so a stuck server must not hold the request.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 10_000,
    })
  }
  return transporter
}

export async function sendEmail(email: OutgoingEmail) {
  try {
    await getTransporter().sendMail({
      from: { address: env.smtp.adminEmail as string, name: env.smtp.senderName },
      html: email.html,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
      to: email.to,
    })
  } catch (error) {
    throw new ExternalServiceError("The SMTP server did not accept the email.", { cause: error })
  }
}
