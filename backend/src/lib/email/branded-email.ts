/**
 * The YeahBuddy email layout, as a function for mail the backend sends itself.
 *
 * It reproduces the markup and inline styles of the Supabase Auth templates in
 * `public/email-templates/` (recovery.html, confirmation.html…): the grey
 * #f5f7fa ground, a 560px white card, the header logo, a 26px heading, the
 * #155EEF button with a copy-paste fallback link, a muted note and the
 * "Train. Track. Progress." footer. Keep the two in step when either changes.
 *
 * Every value is escaped here, so callers pass plain text.
 */

export type BrandedEmail = {
  /** A call to action, rendered as the blue button plus a fallback link. */
  button?: { label: string; url: string }
  heading: string
  lang: "en" | "vi"
  /** The small grey line under the content (why they got it, expiry…). */
  note?: string
  paragraphs: string[]
  /** Inbox preview text, shown after the subject line. */
  preview: string
  title: string
}

const LOGO_URL = "https://www.hominhduc.me/header-logo.png"

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character,
  )
}

function renderButton(button: NonNullable<BrandedEmail["button"]>, fallbackLabel: string) {
  const url = escapeHtml(button.url)
  return `
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center">
                <tr>
                  <td align="center" bgcolor="#155EEF" style="border-radius:10px;">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;background-color:#155EEF;border-radius:10px;">${escapeHtml(button.label)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${escapeHtml(fallbackLabel)}</p>
              <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${url}" target="_blank" style="color:#155EEF;text-decoration:underline;">${url}</a>
              </p>`
}

export function renderBrandedEmail(email: BrandedEmail) {
  const fallbackLabel =
    email.lang === "vi"
      ? "Nút không hoạt động? Sao chép đường dẫn này và dán vào trình duyệt:"
      : "Button not working? Copy and paste this link into your browser:"
  const paragraphs = email.paragraphs
    .map((paragraph, index) => {
      // The last paragraph leaves room above the button, like the templates.
      const bottom = index === email.paragraphs.length - 1 ? (email.button ? 28 : 0) : 10
      return `<p style="margin:0 0 ${bottom}px 0;font-size:15px;line-height:1.7;color:#4b5563;">${escapeHtml(paragraph)}</p>`
    })
    .join("\n              ")

  return `<!DOCTYPE html>
<html lang="${email.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(email.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(email.preview)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#f5f7fa;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
          <tr>
            <td align="center" style="padding:36px 36px 18px 36px;">
              <img src="${LOGO_URL}" alt="YeahBuddy Fitness" width="220" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 40px 36px 40px;">
              <h1 style="margin:0 0 14px 0;font-size:26px;line-height:1.3;font-weight:700;color:#111827;">${escapeHtml(email.heading)}</h1>
              ${paragraphs}${email.button ? renderButton(email.button, fallbackLabel) : ""}${
                email.note
                  ? `
              <p style="margin:28px 0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">${escapeHtml(email.note)}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top:1px solid #f0f0f0;padding:22px 36px;">
              <p style="margin:0 0 5px 0;font-size:12px;color:#9ca3af;">© YeahBuddy Fitness</p>
              <p style="margin:0;font-size:12px;font-weight:600;color:#6b7280;">Train. Track. Progress.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
