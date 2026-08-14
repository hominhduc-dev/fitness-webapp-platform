/**
 * Date helpers shared across the fitness-data services.
 *
 * Two calendars coexist here and mixing them causes off-by-one-day bugs:
 *
 * - **UTC helpers** (`*Utc*`, `parseScheduledDateInput`) operate on the day keys
 *   persisted in the database. A workout scheduled for "2026-08-14" must mean the
 *   same day for every trainee regardless of server timezone.
 * - **Local helpers** (`toDateRange`, `toRecentWindow`, `parseLocalDateInput`)
 *   operate in the server's timezone and back the "today"/"last N days" views.
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

function getUtcMonthBounds(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1))
  return { end, start }
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

/** As `parseScheduledDateInput`, but anchored to local midnight. */
function parseLocalDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return undefined
  }

  const [yearText, monthText, dayText] = trimmedValue.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return parsedDate
}

/** The local-time [start, end] bounds of a single day, for "today" queries. */
function toDateRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(-1)

  return { end, start }
}

/** The local-time bounds of the last `days` days, inclusive of today. */
function toRecentWindow(days: number) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { end, start }
}

export {
  addUtcDays,
  DAY_IN_MS,
  DAY_LABELS,
  DISPLAY_WEEKDAY_ORDER,
  formatMonthDayLabel,
  formatUtcDateOnly,
  formatWeekdayLabel,
  getUtcMonthBounds,
  parseLocalDateInput,
  parseScheduledDateInput,
  startOfUtcDay,
  startOfUtcWeek,
  toDateRange,
  toRecentWindow,
  toUtcDayStart,
}
