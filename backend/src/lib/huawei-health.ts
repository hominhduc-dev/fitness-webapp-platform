import { randomUUID } from "node:crypto"

import { env } from "../config/env"
import { BadRequestError, ExternalServiceError } from "../services/errors"
import { logger } from "./logger"

/**
 * Minimal Huawei ID OAuth + Health Kit REST client, on `fetch` like lib/google.ts.
 *
 * Health Kit only answers for scopes Huawei approved for this app in the
 * developer console. Every endpoint, scope and data type name below must match
 * that approval; they are kept here so there is one place to check them against
 * the Health Kit REST reference.
 */

const OAUTH_AUTH_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize"
const OAUTH_TOKEN_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/token"
const OAUTH_REVOKE_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/revoke"
const HEALTH_API_URL = "https://health-api.cloud.huawei.com/healthkit/v2"

/** `openid` is mandatory for Huawei ID; the rest are read-only Health Kit scopes. */
const SCOPES = [
  "openid",
  "https://www.huawei.com/healthkit/step.read",
  "https://www.huawei.com/healthkit/calories.read",
  "https://www.huawei.com/healthkit/heartrate.read",
]

/** Raw data types passed to `sampleSet:dailyPolymerize`; Huawei returns one daily aggregate per type. */
const DAILY_DATA_TYPES = [
  "com.huawei.continuous.steps.delta",
  "com.huawei.continuous.calories.burnt",
  "com.huawei.instantaneous.heart_rate",
] as const

const REQUEST_TIMEOUT_MS = 15000

/** Refresh this far before the real expiry so an in-flight request never races it. */
const EXPIRY_SKEW_MS = 60_000

type HuaweiTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

type HuaweiFieldValue = {
  fieldName?: string
  floatValue?: number
  integerValue?: number
  longValue?: number
}

type HuaweiSamplePoint = {
  dataTypeName?: string
  endTime?: number | string
  startTime?: number | string
  value?: HuaweiFieldValue[]
}

type HuaweiDailyPolymerizeResponse = {
  group?: Array<{
    endTime?: number | string
    sampleSet?: Array<{ dataCollectorId?: string; samplePoints?: HuaweiSamplePoint[] }>
    startTime?: number | string
  }>
}

function isHuaweiOAuthConfigured() {
  return Boolean(env.huaweiHealthClientId && env.huaweiHealthClientSecret && env.huaweiHealthRedirectUri)
}

function requireHuaweiOAuthConfig() {
  if (!isHuaweiOAuthConfigured()) {
    throw new BadRequestError("Máy chủ chưa cấu hình OAuth Huawei.", { code: "HUAWEI_OAUTH_NOT_CONFIGURED" })
  }

  return {
    clientId: env.huaweiHealthClientId!,
    clientSecret: env.huaweiHealthClientSecret!,
    redirectUri: env.huaweiHealthRedirectUri!,
  }
}

/** `access_type=offline` is what makes Huawei return a refresh token for background sync. */
function buildAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = requireHuaweiOAuthConfig()

  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
  })

  return `${OAUTH_AUTH_URL}?${params.toString()}`
}

async function huaweiFetch(url: string, init: RequestInit, label: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })

    if (!response.ok) {
      const body = await response.text()

      // Token responses carry the credential itself and must never reach the log.
      logger.warn("huawei request failed", {
        label,
        status: response.status,
        ...(label === "token" ? {} : { reason: body.slice(0, 300) }),
      })

      throw new ExternalServiceError(`Huawei trả về lỗi ${response.status}.`, {
        code: response.status === 401 || (label === "token" && response.status === 400) ? "HUAWEI_AUTH_REJECTED" : "HUAWEI_REQUEST_FAILED",
        details: { label, status: response.status },
      })
    }

    return response
  } catch (error) {
    if (error instanceof ExternalServiceError || error instanceof BadRequestError) {
      throw error
    }

    throw new ExternalServiceError("Không gọi được API Huawei.", { cause: error, code: "HUAWEI_UNREACHABLE" })
  } finally {
    clearTimeout(timeout)
  }
}

function toTokenResult(payload: HuaweiTokenResponse) {
  if (!payload.access_token) {
    throw new ExternalServiceError("Huawei không trả về access token.", { code: "HUAWEI_TOKEN_MISSING" })
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000),
    refreshToken: payload.refresh_token,
    scope: payload.scope ?? SCOPES.join(" "),
  }
}

async function postTokenForm(params: Record<string, string>) {
  const response = await huaweiFetch(
    OAUTH_TOKEN_URL,
    {
      body: new URLSearchParams(params),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token",
  )

  return toTokenResult((await response.json()) as HuaweiTokenResponse)
}

/** Trades the one-time code from the callback for tokens. */
async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = requireHuaweiOAuthConfig()

  return postTokenForm({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  })
}

/** Huawei may or may not rotate the refresh token; callers keep the stored one when none comes back. */
async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = requireHuaweiOAuthConfig()

  return postTokenForm({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
}

/** Best-effort revocation; a failure here must not block disconnecting locally. */
async function revokeToken(token: string) {
  try {
    await huaweiFetch(
      OAUTH_REVOKE_URL,
      {
        body: new URLSearchParams({ token }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
      "revoke",
    )

    return true
  } catch (error) {
    logger.warn("huawei token revoke failed", { error })

    return false
  }
}

/**
 * Daily aggregates for one data type over an inclusive day range.
 *
 * `startDay`/`endDay` are `YYYYMMDD` and `timeZone` is a UTC offset like
 * `+0700`: Huawei cuts the days in that offset, so it must be the user's own.
 */
async function fetchDailyPolymerize(
  accessToken: string,
  input: { dataType: string; endDay: string; startDay: string; timeZone: string },
) {
  const { clientId } = requireHuaweiOAuthConfig()

  const response = await huaweiFetch(
    `${HEALTH_API_URL}/sampleSet:dailyPolymerize`,
    {
      body: JSON.stringify({
        dataTypes: [input.dataType],
        endDay: input.endDay,
        startDay: input.startDay,
        timeZone: input.timeZone,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-caller-trace-id": randomUUID(),
        "x-client-id": clientId,
        "x-version": "1.0",
      },
      method: "POST",
    },
    "daily_polymerize",
  )

  return (await response.json()) as HuaweiDailyPolymerizeResponse
}

export {
  buildAuthorizationUrl,
  DAILY_DATA_TYPES,
  exchangeCodeForTokens,
  EXPIRY_SKEW_MS,
  fetchDailyPolymerize,
  isHuaweiOAuthConfigured,
  refreshAccessToken,
  revokeToken,
  SCOPES,
}
export type { HuaweiDailyPolymerizeResponse, HuaweiFieldValue, HuaweiSamplePoint }
