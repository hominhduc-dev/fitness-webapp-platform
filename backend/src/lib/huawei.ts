import { randomUUID } from "node:crypto"

import { env } from "../config/env"
import { BadRequestError, ExternalServiceError } from "../services/errors"

const HUAWEI_AUTH_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize"
const HUAWEI_TOKEN_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/token"
const REQUEST_TIMEOUT_MS = 15_000
const EXPIRY_SKEW_MS = 60_000

const SCOPES = [
  "openid",
  "https://www.huawei.com/healthkit/sleep.read",
  "https://www.huawei.com/healthkit/heartrate.read",
  "https://www.huawei.com/healthkit/stress.read",
  "https://www.huawei.com/healthkit/step.read",
  "https://www.huawei.com/healthkit/distance.read",
  "https://www.huawei.com/healthkit/calories.read",
  "https://www.huawei.com/healthkit/heightweight.read",
  "https://www.huawei.com/healthkit/activityrecord.read",
  "https://www.huawei.com/healthkit/activity.read",
] as const

const ALLOWED_HEALTH_API_HOSTS = new Set([
  "health-api.cloud.huawei.com",
  "health-api.cloud.huawei.eu",
])

type HuaweiTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

type HuaweiTokens = {
  accessToken: string
  expiresAt: Date
  refreshToken?: string
  scope: string
}

type HuaweiHealthResult<T> = {
  data: T
  baseUrl: string
}

function isHuaweiOAuthConfigured() {
  return Boolean(
    env.huaweiClientId &&
      env.huaweiClientSecret &&
      env.huaweiOauthRedirectUri &&
      env.huaweiHealthApiBase,
  )
}

function requireHuaweiOAuthConfig() {
  if (!isHuaweiOAuthConfigured()) {
    throw new BadRequestError("Máy chủ chưa cấu hình Huawei Health.", {
      code: "HUAWEI_OAUTH_NOT_CONFIGURED",
    })
  }

  return {
    clientId: env.huaweiClientId!,
    clientSecret: env.huaweiClientSecret!,
    healthApiBase: env.huaweiHealthApiBase,
    redirectUri: env.huaweiOauthRedirectUri!,
  }
}

function buildHuaweiAuthorizationUrl(state: string) {
  const config = requireHuaweiOAuthConfig()
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: config.clientId,
    display: "touch",
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
  })

  return `${HUAWEI_AUTH_URL}?${params.toString()}`
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function tokenRequest(body: URLSearchParams) {
  let response: Response
  try {
    response = await fetch(HUAWEI_TOKEN_URL, {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ExternalServiceError("Không thể kết nối dịch vụ đăng nhập Huawei.", {
      cause: error,
      code: "HUAWEI_OAUTH_UNAVAILABLE",
    })
  }

  const payload = await readJson<HuaweiTokenResponse & { error?: string; error_description?: string }>(response)

  if (!response.ok || !payload?.access_token || !payload.expires_in) {
    throw new ExternalServiceError("Huawei không cấp được access token.", {
      code: "HUAWEI_TOKEN_EXCHANGE_FAILED",
      details: payload?.error ? { error: payload.error } : undefined,
    })
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000),
    refreshToken: payload.refresh_token,
    scope: payload.scope ?? SCOPES.join(" "),
  } satisfies HuaweiTokens
}

function exchangeCodeForTokens(code: string) {
  const config = requireHuaweiOAuthConfig()
  return tokenRequest(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  )
}

function refreshAccessToken(refreshToken: string) {
  const config = requireHuaweiOAuthConfig()
  return tokenRequest(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  )
}

function normalizeHealthApiBase(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ExternalServiceError("Huawei trả về Health API URL không hợp lệ.", {
      code: "HUAWEI_HEALTH_REGION_INVALID",
    })
  }

  if (url.protocol !== "https:" || !ALLOWED_HEALTH_API_HOSTS.has(url.hostname)) {
    throw new ExternalServiceError("Huawei trả về Health API region không được hỗ trợ.", {
      code: "HUAWEI_HEALTH_REGION_INVALID",
    })
  }

  return url.origin
}

async function executeHealthRequest<T>(
  accessToken: string,
  url: URL,
  init: RequestInit,
): Promise<{ payload: T | null; response: Response }> {
  const config = requireHuaweiOAuthConfig()

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-caller-trace-id": randomUUID(),
        "x-client-id": config.clientId,
        ...init.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ExternalServiceError("Không thể kết nối Huawei Health Service Kit.", {
      cause: error,
      code: "HUAWEI_HEALTH_UNAVAILABLE",
    })
  }

  return { payload: await readJson<T>(response), response }
}

async function requestHuaweiHealth<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  preferredBaseUrl?: string | null,
): Promise<HuaweiHealthResult<T>> {
  const initialBase = normalizeHealthApiBase(preferredBaseUrl ?? requireHuaweiOAuthConfig().healthApiBase)
  const initialUrl = new URL(path, `${initialBase}/`)
  const first = await executeHealthRequest<T & { error?: { code?: number; message?: string } }>(
    accessToken,
    initialUrl,
    init,
  )

  if (first.response.ok && first.payload) {
    return { data: first.payload as T, baseUrl: initialBase }
  }

  const errorCode = (first.payload as { error?: { code?: number } } | null)?.error?.code
  const redirectLocation = first.response.headers.get("location")

  if (first.response.status === 403 && errorCode === 121001 && redirectLocation) {
    const redirectUrl = new URL(redirectLocation)
    const redirectedBase = normalizeHealthApiBase(redirectUrl.origin)
    const second = await executeHealthRequest<T>(accessToken, redirectUrl, init)

    if (second.response.ok && second.payload) {
      return { data: second.payload, baseUrl: redirectedBase }
    }
  }

  throw new ExternalServiceError("Huawei Health không trả về dữ liệu hợp lệ.", {
    code: "HUAWEI_HEALTH_REQUEST_FAILED",
    details: { status: first.response.status },
  })
}

type HuaweiValue = {
  fieldName?: string
  floatValue?: number
  integerValue?: number
  longValue?: number
  stringValue?: string
}

type HuaweiSamplePoint = {
  dataTypeName?: string
  endTime?: number | string
  startTime?: number | string
  value?: HuaweiValue[]
}

type HuaweiSampleSet = {
  dataCollectorId?: string
  samplePoints?: HuaweiSamplePoint[]
}

type HuaweiPolymerizeGroup = {
  endTime?: number
  sampleSet?: HuaweiSampleSet[]
  startTime?: number
}

type HuaweiPolymerizeResponse = {
  group?: HuaweiPolymerizeGroup[]
}

type HuaweiHealthRecord = {
  dataTypeName?: string
  endTime?: number | string
  id?: string
  startTime?: number | string
  subData?: unknown[]
  value?: HuaweiValue[]
  [key: string]: unknown
}

type HuaweiHealthRecordsResponse = {
  healthRecords?: HuaweiHealthRecord[]
}

type HuaweiActivitySummary = {
  dataSummary?: Array<{
    dataTypeName?: string
    value?: HuaweiValue[]
  }>
}

type HuaweiActivityRecord = {
  activitySummary?: HuaweiActivitySummary
  activityType?: number | string
  desc?: string
  endTime?: number
  id?: string
  name?: string
  startTime?: number
  [key: string]: unknown
}

type HuaweiActivityRecordsResponse = {
  activityRecord?: HuaweiActivityRecord[]
}

function polymerizeDaily(
  accessToken: string,
  input: {
    dataTypes: string[]
    endTime: number
    startTime: number
    timeZone: string
  },
  preferredBaseUrl?: string | null,
) {
  return requestHuaweiHealth<HuaweiPolymerizeResponse>(
    accessToken,
    "/healthkit/v2/sampleSet:polymerize",
    {
      body: JSON.stringify({
        polymerizeWith: input.dataTypes.map((dataTypeName) => ({ dataTypeName })),
        endTime: input.endTime,
        groupByTime: {
          groupPeriod: { timeZone: input.timeZone, unit: "day", value: 1 },
        },
        startTime: input.startTime,
      }),
      method: "POST",
    },
    preferredBaseUrl,
  )
}

function fetchSleepRecords(
  accessToken: string,
  input: { endTimeNs: string; startTimeNs: string },
  preferredBaseUrl?: string | null,
) {
  const params = new URLSearchParams({
    dataType: "com.huawei.health.record.sleep",
    endTime: input.endTimeNs,
    startTime: input.startTimeNs,
  })

  return requestHuaweiHealth<HuaweiHealthRecordsResponse>(
    accessToken,
    `/healthkit/v2/healthRecords?${params.toString()}`,
    { method: "GET" },
    preferredBaseUrl,
  )
}

function fetchActivityRecords(
  accessToken: string,
  input: { endTime: number; startTime: number },
  preferredBaseUrl?: string | null,
) {
  const params = new URLSearchParams({
    endTime: String(input.endTime),
    startTime: String(input.startTime),
  })

  return requestHuaweiHealth<HuaweiActivityRecordsResponse>(
    accessToken,
    `/healthkit/v2/activityRecords?${params.toString()}`,
    { method: "GET" },
    preferredBaseUrl,
  )
}

export {
  buildHuaweiAuthorizationUrl,
  exchangeCodeForTokens,
  EXPIRY_SKEW_MS,
  fetchActivityRecords,
  fetchSleepRecords,
  isHuaweiOAuthConfigured,
  polymerizeDaily,
  refreshAccessToken,
  requestHuaweiHealth,
  SCOPES,
}

export type {
  HuaweiActivityRecord,
  HuaweiActivityRecordsResponse,
  HuaweiHealthRecord,
  HuaweiHealthRecordsResponse,
  HuaweiPolymerizeGroup,
  HuaweiPolymerizeResponse,
  HuaweiSamplePoint,
  HuaweiTokens,
  HuaweiValue,
}
