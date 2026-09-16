import { getZonedParts, resolveTimeZone, zonedMidnight } from "../../lib/time-zone"

/**
 * Pure time rules for scheduled notifications. Kept free of Prisma so the
 * scheduler's "is it due?" decisions are unit-testable with a fixed clock.
 */

/**
 * How long after the chosen time a reminder may still go out. The scheduler polls,
 * so a reminder normally lands within one tick; the window covers a backend that
 * was restarting or down at 07:00 without sending yesterday's reminder at noon.
 */
const REMINDER_CATCH_UP_MINUTES = 90
/** A meal reminder more than an hour late is about the next meal, not this one. */
const MEAL_REMINDER_CATCH_UP_MINUTES = 60

/** Lead times offered for the "workout starts soon" reminder. */
const WORKOUT_REMINDER_OFFSETS = [15, 30, 60] as const

/** A session untouched this long after starting counts as left open. */
const OPEN_SESSION_MIN_AGE_MS = 2 * 60 * 60 * 1000
/** Still-active sessions (a set saved recently) are not nagged. */
const OPEN_SESSION_IDLE_MS = 30 * 60 * 1000
/** Drafts older than this are abandoned history, not something to resume today. */
const OPEN_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutes since local midnight for an `HH:mm` string, or null when malformed. */
function parseClockTime(value: string) {
  const match = CLOCK_TIME_PATTERN.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function formatDateKey(year: number, month: number, day: number) {
  // Normalises overflow (day 0, day 32) the way Date.UTC does.
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

/** The wall clock in `timeZone` at `now`: calendar day, weekday (0 = Sunday) and minute of day. */
function getLocalClock(now: Date, timeZone: string) {
  const zone = resolveTimeZone(timeZone)
  const { day, hour, minute, month, year } = getZonedParts(now, zone)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  // Weeks start on Monday, matching the schedule and progress screens.
  const daysSinceMonday = (weekday + 6) % 7

  return {
    dateKey: formatDateKey(year, month, day),
    /** Start of this local day as an instant, for "already logged today?" queries. */
    dayStart: zonedMidnight(year, month, day, zone),
    dayEnd: zonedMidnight(year, month, day + 1, zone),
    minutes: hour * 60 + minute,
    timeZone: zone,
    weekday,
    /** Monday of this local week, as a day key and as the instant it begins. */
    weekStartKey: formatDateKey(year, month, day - daysSinceMonday),
    weekStart: zonedMidnight(year, month, day - daysSinceMonday, zone),
  }
}

type LocalClock = ReturnType<typeof getLocalClock>

/**
 * Whether a daily reminder at `time` should fire on this local day.
 * Due from the chosen minute until the catch-up window closes; the caller dedupes
 * per local day, so returning true on every tick in that window is expected.
 */
function isDailyReminderDue(
  clock: LocalClock,
  time: string,
  days?: readonly number[],
  catchUpMinutes = REMINDER_CATCH_UP_MINUTES,
) {
  const target = parseClockTime(time)
  if (target === null) return false
  if (days && !days.includes(clock.weekday)) return false

  return clock.minutes >= target && clock.minutes < target + catchUpMinutes
}

/**
 * "Workout starts soon": due from `offsetMinutes` before the training time until
 * the training time itself — a reminder after the start is no longer useful.
 */
function isWorkoutReminderDue(clock: LocalClock, time: string, offsetMinutes: number) {
  const target = parseClockTime(time)
  if (target === null) return false

  return clock.minutes >= Math.max(0, target - offsetMinutes) && clock.minutes < target
}

function isWorkoutSessionLeftOpen(draft: { startedAt: Date; updatedAt: Date }, now: Date) {
  const age = now.getTime() - draft.startedAt.getTime()
  const idle = now.getTime() - draft.updatedAt.getTime()

  return age >= OPEN_SESSION_MIN_AGE_MS && age <= OPEN_SESSION_MAX_AGE_MS && idle >= OPEN_SESSION_IDLE_MS
}

/** "45 minutes", "1 hour", "3 hours" — the elapsed time in the open-session message. */
function formatElapsed(ms: number) {
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`

  const hours = Math.floor(minutes / 60)
  return `${hours} hour${hours === 1 ? "" : "s"}`
}

/** `18:00` → `6:00 PM`, the style push copy uses. */
function formatClockTime12h(time: string) {
  const minutes = parseClockTime(time)
  if (minutes === null) return time

  const hours = Math.floor(minutes / 60)
  const suffix = hours < 12 ? "AM" : "PM"
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`
}

export {
  CLOCK_TIME_PATTERN,
  formatClockTime12h,
  formatElapsed,
  getLocalClock,
  isDailyReminderDue,
  isWorkoutReminderDue,
  isWorkoutSessionLeftOpen,
  MEAL_REMINDER_CATCH_UP_MINUTES,
  OPEN_SESSION_IDLE_MS,
  OPEN_SESSION_MAX_AGE_MS,
  OPEN_SESSION_MIN_AGE_MS,
  parseClockTime,
  REMINDER_CATCH_UP_MINUTES,
  WORKOUT_REMINDER_OFFSETS,
}
export type { LocalClock }
