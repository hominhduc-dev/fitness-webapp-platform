import { env } from "../config/env"
import { BadRequestError, ExternalServiceError } from "../services/errors"
import { logger } from "./logger"

/**
 * Minimal Google OAuth + Sheets client.
 *
 * Written against `fetch` rather than pulling in `googleapis`, which is a very large
 * dependency for the three calls this feature makes: exchange a code, refresh a
 * token, read a range. Fewer transitive packages also means a smaller supply-chain
 * surface for a credential-handling path.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
const OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets"

/**
 * Read/write Sheets access. The spreadsheets scope covers all spreadsheets;
 * drive.file does not narrow that scope and is retained for Picker/Drive operations.
 *
 * `drive.file` rather than `drive.readonly`: it grants access to files chosen
 * through the Google Picker rather than the coach's entire Drive. Sheets access
 * above is broader and requires its own consent/review.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
]

const REQUEST_TIMEOUT_MS = 15000

/** Refresh this far before the real expiry so an in-flight request never races it. */
const EXPIRY_SKEW_MS = 60_000

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

type SheetValuesResponse = {
  majorDimension?: string
  range?: string
  values?: unknown[][]
}

type SpreadsheetMetaResponse = {
  properties?: { title?: string }
  sheets?: Array<{ properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>
}

function isGoogleOAuthConfigured() {
  return Boolean(env.googleOauthClientId && env.googleOauthClientSecret && env.googleOauthRedirectUri)
}

function requireGoogleOAuthConfig() {
  if (!isGoogleOAuthConfigured()) {
    throw new BadRequestError("Máy chủ chưa cấu hình OAuth Google.", { code: "GOOGLE_OAUTH_NOT_CONFIGURED" })
  }

  return {
    clientId: env.googleOauthClientId!,
    clientSecret: env.googleOauthClientSecret!,
    redirectUri: env.googleOauthRedirectUri!,
  }
}

/**
 * Builds the consent URL.
 *
 * `access_type=offline` with `prompt=consent` is what makes Google return a refresh
 * token. Without `prompt=consent` a coach who has already authorised the app gets an
 * access token and no refresh token, so the connection silently dies in an hour.
 */
function buildAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = requireGoogleOAuthConfig()

  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
  })

  return `${OAUTH_AUTH_URL}?${params.toString()}`
}

async function googleFetch(url: string, init: RequestInit, label: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })

    if (!response.ok) {
      const body = await response.text()

      // The body carries Google's actual reason, which is the only way to tell a
      // malformed id from a missing share. Token responses are the one exception:
      // their body is the credential itself and must never reach the log.
      logger.warn("google request failed", {
        label,
        status: response.status,
        ...(label === "token" ? {} : { reason: body.slice(0, 300) }),
      })

      // A spreadsheet the coach uploaded but never converted is still an .xlsx on
      // Drive. It opens in the browser and looks native, so the only clue is this
      // reply. Translate it into the one action that fixes it, and use 400 rather
      // than 502 because nothing on Google's side is broken.
      if (response.status === 400 && body.includes("must not be an Office file")) {
        throw new BadRequestError(
          "File này vẫn ở định dạng Excel trên Drive nên Google Sheets API không đọc được. Mở file, chọn File rồi Save as Google Sheets, sau đó dán link của bản mới.",
          { code: "GOOGLE_SHEET_IS_OFFICE_FILE" },
        )
      }

      throw new ExternalServiceError(`Google trả về lỗi ${response.status}.`, {
        code: "GOOGLE_REQUEST_FAILED",
        details: { label, status: response.status, ...(label === "token" ? {} : { body: body.slice(0, 200) }) },
      })
    }

    return response
  } catch (error) {
    if (error instanceof ExternalServiceError || error instanceof BadRequestError) {
      throw error
    }

    throw new ExternalServiceError("Không gọi được API Google.", { cause: error, code: "GOOGLE_UNREACHABLE" })
  } finally {
    clearTimeout(timeout)
  }
}

function toTokenResult(payload: GoogleTokenResponse) {
  if (!payload.access_token) {
    throw new ExternalServiceError("Google không trả về access token.", { code: "GOOGLE_TOKEN_MISSING" })
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000),
    refreshToken: payload.refresh_token,
    scope: payload.scope ?? SCOPES.join(" "),
  }
}

/** Trades the one-time code from the callback for tokens. */
async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = requireGoogleOAuthConfig()

  const response = await googleFetch(
    OAUTH_TOKEN_URL,
    {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token",
  )

  return toTokenResult((await response.json()) as GoogleTokenResponse)
}

/**
 * Exchanges a refresh token for a fresh access token.
 *
 * Google does not return a new refresh token here, so callers must keep the one
 * they already stored rather than overwriting it with undefined.
 */
async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = requireGoogleOAuthConfig()

  const response = await googleFetch(
    OAUTH_TOKEN_URL,
    {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
    "token",
  )

  return toTokenResult((await response.json()) as GoogleTokenResponse)
}

/** Best-effort revocation; a failure here must not block disconnecting locally. */
async function revokeToken(token: string) {
  try {
    await googleFetch(
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
    logger.warn("google token revoke failed", { error })

    return false
  }
}

async function fetchGoogleEmail(accessToken: string) {
  try {
    const response = await googleFetch(
      USERINFO_URL,
      { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" },
      "userinfo",
    )
    const payload = (await response.json()) as { email?: unknown }

    return typeof payload.email === "string" ? payload.email : undefined
  } catch {
    // The connection still works without the label; it is only shown in the UI.
    return undefined
  }
}

/** Spreadsheet title and tab names, used to let the coach pick a tab. */
async function fetchSpreadsheetMeta(accessToken: string, spreadsheetId: string) {
  const response = await googleFetch(
    `${SHEETS_API_URL}/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties(sheetId,title,gridProperties)`,
    { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" },
    "spreadsheet_meta",
  )

  const payload = (await response.json()) as SpreadsheetMetaResponse

  return {
    sheetProperties: (payload.sheets ?? []).flatMap((sheet) => typeof sheet.properties?.sheetId === "number" && sheet.properties.title ? [sheet.properties as { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } }] : []),
    sheets: (payload.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === "string"),
    title: payload.properties?.title ?? "",
  }
}

/** One spreadsheet batch is atomic; callers must validate every row before submitting. */
async function batchUpdateSpreadsheet(accessToken: string, spreadsheetId: string, requests: unknown[]) {
  const response = await googleFetch(`${SHEETS_API_URL}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  }, "spreadsheet_write")
  return response.json()
}

/**
 * Reads a whole tab as a grid of strings.
 *
 * `UNFORMATTED_VALUE` would hand back Sheets' own date serial numbers for anything
 * the coach formatted as a date; `FORMATTED_VALUE` returns what they see on screen,
 * which is what the column parsers expect. Trailing empty cells are omitted by the
 * API, so rows come back ragged and every consumer must index defensively.
 */
async function fetchSheetValues(accessToken: string, spreadsheetId: string, sheetName: string) {
  const range = encodeURIComponent(`'${sheetName.replace(/'/g, "''")}'`)
  const response = await googleFetch(
    `${SHEETS_API_URL}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" },
    "sheet_values",
  )

  const payload = (await response.json()) as SheetValuesResponse

  return (payload.values ?? []).map((row) => (Array.isArray(row) ? row.map((cell) => (cell == null ? "" : String(cell))) : []))
}

/**
 * Pulls the spreadsheet id out of a pasted Google Sheets URL, or accepts a bare id.
 *
 * Sheet ids are 20 or more characters of the base64url alphabet, which is why this
 * cannot simply take the last path segment: `/edit` and `#gid=0` both trail it.
 */
function extractSpreadsheetId(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return undefined
  }

  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/)

  if (fromUrl?.[1]) {
    return fromUrl[1]
  }

  return /^[a-zA-Z0-9-_]{20,}$/.test(trimmed) ? trimmed : undefined
}

export {
  batchUpdateSpreadsheet,
  buildAuthorizationUrl,
  EXPIRY_SKEW_MS,
  exchangeCodeForTokens,
  extractSpreadsheetId,
  fetchGoogleEmail,
  fetchSheetValues,
  fetchSpreadsheetMeta,
  isGoogleOAuthConfigured,
  refreshAccessToken,
  requireGoogleOAuthConfig,
  revokeToken,
  SCOPES,
}
