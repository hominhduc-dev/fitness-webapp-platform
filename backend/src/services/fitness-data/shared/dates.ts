import { toZonedDateKey, zonedMidnight } from "../../../lib/time-zone"

/**
 * Date helpers shared across the fitness-data services.
 *
 * Two kinds of value coexist here and mixing them causes off-by-one-day bugs:
 *
 * - **Day keys** are dates without a time: `@db.Date` columns (`plannedDate`,
 *   `scheduledDate`, `loggedDate`, `weekStart`, ...) held as UTC midnight. The
 *   `*Utc*` helpers and `parseScheduledDateInput` do calendar math on them, and a
 *   workout scheduled for "2026-08-14" means that day for everyone.
 * - **Instants** are moments in time (`startedAt`, `recordedAt`, `assignedAt`).
 *   Which day an instant belongs to depends on the viewer, so the `client*`
 *   helpers use the requesting client's time zone (see lib/time-zone.ts), never
 *   the server's. `toDateRange`, `toRecentWindow`, `parseLocalDateInput` and
 *   `addLocalDays` return instants bounding the client's days.
 *
 * Bridge between them: `clientCalendarDay(instant)` gives the day key an instant
 * falls on, and `clientDayStart(dayKey)` gives the instant that day begins.
 */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
/** Monday-first ordering used by the schedule and calendar UIs. */
const DISPLAY_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_IN_MS = 24 * 60 * 60 * 1000

/** The `YYYY-MM-DD` day key used everywhere a date is stored or compared. */
function formatUtcDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toUtcDayStart(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** Monday-anchored, matching DISPLAY_WEEKDAY_ORDER. */
function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + offset)
  return start
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function formatMonthDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date)
}

function formatWeekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date)
}

/**
 * Parses a `YYYY-MM-DD` day key as UTC midnight, rejecting anything that is not
 * exactly that shape — including dates that roll over (`2026-02-30`), which the
 * Date constructor would otherwise silently accept.
 */
function parseScheduledDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return undefined
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00.000Z`)

  if (Number.isNaN(parsedDate.getTime()) || formatUtcDateOnly(parsedDate) !== trimmedValue) {
    return undefined
  }

  return parsedDate
}

/** The day key (UTC midnight) of the client's calendar day that contains `instant`. */
function clientCalendarDay(instant = new Date()) {
  return new Date(`${toZonedDateKey(instant)}T00:00:00.000Z`)
}

/** `YYYY-MM-DD` of the client's calendar day that contains `instant`. */
function formatClientDateKey(instant: Date) {
  return toZonedDateKey(instant)
}

/** The instant the client's calendar day `day` (a day key) begins. */
function clientDayStart(day: Date) {
  return zonedMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate())
}

/** As `parseScheduledDateInput`, but returns the instant that day begins for the client. */
function parseLocalDateInput(value: string) {
  const day = parseScheduledDateInput(value)
  return day ? clientDayStart(day) : undefined
}

/** Moves a client day-start instant by whole calendar days, staying on local midnight across DST. */
function addLocalDays(date: Date, days: number) {
  return clientDayStart(addUtcDays(clientCalendarDay(date), days))
}

/** The client's current month (shifted by `offsetMonths`) as a half-open interval of instants. */
function getClientMonthBounds(offsetMonths = 0) {
  const today = clientCalendarDay()
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth() + 1 + offsetMonths

  return {
    end: zonedMidnight(year, month + 1, 1),
    start: zonedMidnight(year, month, 1),
  }
}

/** The instant bounds of the client's calendar day containing `date`, for "today" queries. */
function toDateRange(date = new Date()) {
  const day = clientCalendarDay(date)

  return {
    end: new Date(clientDayStart(addUtcDays(day, 1)).getTime() - 1),
    start: clientDayStart(day),
  }
}

/** The instant bounds of the client's last `days` calendar days, inclusive of today. */
function toRecentWindow(days: number) {
  const today = clientCalendarDay()

  return {
    end: new Date(clientDayStart(addUtcDays(today, 1)).getTime() - 1),
    start: clientDayStart(addUtcDays(today, -(days - 1))),
  }
}

export {
  addLocalDays,
  addUtcDays,
  clientCalendarDay,
  clientDayStart,
  DAY_IN_MS,
  DAY_LABELS,
  DISPLAY_WEEKDAY_ORDER,
  formatClientDateKey,
  formatMonthDayLabel,
  formatUtcDateOnly,
  formatWeekdayLabel,
  getClientMonthBounds,
  parseLocalDateInput,
  parseScheduledDateInput,
  startOfUtcDay,
  startOfUtcWeek,
  toDateRange,
  toRecentWindow,
  toUtcDayStart,
}
