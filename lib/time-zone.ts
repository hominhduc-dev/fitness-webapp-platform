/**
 * The user's time zone, shared with the backend so "today", "this week" and
 * date-range exports follow the user's calendar rather than the server's.
 *
 * In the browser the zone comes from `Intl`. A server render has no browser to
 * ask, so the zone is mirrored into a cookie (see TimeZoneCookieSync) and read
 * back through a reader that server-only code registers.
 */

export const TIME_ZONE_HEADER = "X-Timezone"
export const TIME_ZONE_COOKIE = "tz"

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function getBrowserTimeZone() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(timeZone) ? timeZone : undefined
  } catch {
    return undefined
  }
}

type ServerTimeZoneReader = () => Promise<string | undefined>

let serverTimeZoneReader: ServerTimeZoneReader | undefined

/**
 * Lets server-only code supply the zone during a server render. Kept as a hook so
 * this module, which client components import, never touches `next/headers`.
 */
export function registerServerTimeZoneReader(reader: ServerTimeZoneReader) {
  serverTimeZoneReader = reader
}

async function resolveTimeZone() {
  if (typeof window !== "undefined") {
    return getBrowserTimeZone()
  }

  try {
    return await serverTimeZoneReader?.()
  } catch {
    // Outside a request scope (build, scripts) there is no cookie to read.
    return undefined
  }
}

/** The header to send with an API request; empty when the zone is unknown, so the backend default applies. */
export async function getTimeZoneHeaders(): Promise<Record<string, string>> {
  const timeZone = await resolveTimeZone()
  return timeZone ? { [TIME_ZONE_HEADER]: timeZone } : {}
}

/** `YYYY-MM-DD` of `date` in `timeZone`, or in the runtime's own zone when omitted. */
export function formatDateKey(date: Date, timeZone?: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: isValidTimeZone(timeZone) ? timeZone : undefined,
    year: "numeric",
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
