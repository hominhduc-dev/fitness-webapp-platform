import { env } from "../config/env"

type N8nWebhookPayload = {
  timestamp: string
  source: "backend"
  event: string
  exportedBy?: {
    email: string
    id: string
    name: string
  }
  filters?: Record<string, unknown>
  rowCount?: number
  rows?: Array<Record<string, unknown>>
}

const WEBHOOK_TIMEOUT_MS = 10000

function isN8nLogExportEnabled() {
  return typeof env.n8nLogsWebhookUrl === "string" && env.n8nLogsWebhookUrl.trim().length > 0
}

async function sendWebhookPayloadToN8n(payload: N8nWebhookPayload) {
  const webhookUrl = env.n8nLogsWebhookUrl?.trim()

  if (!webhookUrl || !isN8nLogExportEnabled()) {
    return {
      ok: false,
      reason: "not_configured" as const,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (env.nodeEnv !== "production") {
        console.error(`n8n log webhook failed with status ${response.status}`)
      }

      return {
        ok: false,
        reason: "webhook_failed" as const,
        statusCode: response.status,
      }
    }

    return {
      ok: true,
      statusCode: response.status,
    }
  } catch (error) {
    if (env.nodeEnv !== "production") {
      console.error("n8n log webhook error", error)
    }

    return {
      ok: false,
      reason: "request_failed" as const,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export type { N8nWebhookPayload }
export { isN8nLogExportEnabled, sendWebhookPayloadToN8n }
