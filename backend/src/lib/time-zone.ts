import { getRequestContext } from "./logger"

/**
 * Calendar math in the client's time zone.
 *
 * "Today", "this week" and "the last 30 days" are the user's days, not the
 * server's: a VPS in UTC would otherwise file a 06:00 Monday workout in Vietnam
 * under Sunday. The browser sends its IANA zone in `X-Timezone`; the request
 * context middleware validates it and every helper here reads it from there.
 *
 * Implemented with `Intl` only, so no dependency and full DST support.
 */

/** Used when a request carries no valid zone: scripts, direct API calls, a first SSR render. */
const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh"
const TIME_ZONE_HEADER = "x-timezone"
const MAX_TIME_ZONE_LENGTH = 64

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone)

  if (!formatter) {
    // Throws a RangeError for an unknown zone, which isValidTimeZone relies on.
    formatter = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    })
    partsFormatters.set(timeZone, formatter)
  }

  return formatter
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TIME_ZONE_LENGTH) {
    return false
  }

  try {
    getPartsFormatter(value)
    return true
  } catch {
    return false
  }
}

function resolveTimeZone(value: unknown) {
  return isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE
}

/** The zone of the request being served, or the default outside a request. */
function getRequestTimeZone() {
  return getRequestContext()?.timeZone ?? DEFAULT_TIME_ZONE
}

function getZonedParts(instant: Date, timeZone: string) {
  const values: Record<string, number> = {}

  for (const part of getPartsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value)
    }
  }

  return {
    day: values.day,
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    month: values.month,
    second: values.second,
    year: values.year,
  }
}

/** `YYYY-MM-DD` of the calendar day `instant` falls on in `timeZone`. */
function toZonedDateKey(instant: Date, timeZone = getRequestTimeZone()) {
  const { day, month, year } = getZonedParts(instant, timeZone)
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds (UTC+07 is 25,200,000). */
function getTimeZoneOffsetMs(instant: Date, timeZone = getRequestTimeZone()) {
  const parts = getZonedParts(instant, timeZone)
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * The instant wall-clock midnight of `year-month-day` begins in `timeZone`.
 * `month` is 1-based and may overflow (13 is January of the next year), as with Date.UTC.
 */
function zonedMidnight(year: number, month: number, day: number, timeZone = getRequestTimeZone()) {
  const wallClock = Date.UTC(year, month - 1, day)
  // The offset at UTC midnight can differ from the offset at local midnight when a
  // DST change falls between them, so read it again at the first guess.
  const firstGuess = wallClock - getTimeZoneOffsetMs(new Date(wallClock), timeZone)
  return new Date(wallClock - getTimeZoneOffsetMs(new Date(firstGuess), timeZone))
}

export {
  DEFAULT_TIME_ZONE,
  getRequestTimeZone,
  getTimeZoneOffsetMs,
  getZonedParts,
  isValidTimeZone,
  resolveTimeZone,
  TIME_ZONE_HEADER,
  toZonedDateKey,
  zonedMidnight,
}
