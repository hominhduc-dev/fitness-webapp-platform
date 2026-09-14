/**
 * Ranges the progress screens query by default. The server seeds these exact
 * requests and the client hooks read them, so both sides must build the same
 * query key; a drifted value silently turns the seed into a second fetch.
 */
export const PROGRESS_OVERVIEW_WEIGHT_DAYS = 90
export const PROGRESS_OVERVIEW_RECOVERY_DAYS = 7
export const PROGRESS_OVERVIEW_ANALYTICS_DAYS = 90
export const READINESS_TREND_DEFAULT_DAYS = 30

/**
 * The analytics API reads whole UTC days, so the range is pinned to UTC
 * midnight. The server seed and the client key then serialise identically
 * instead of differing by the milliseconds between two `new Date()` calls.
 */
export function progressAnalyticsRange(now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - PROGRESS_OVERVIEW_ANALYTICS_DAYS)
  return { end, start }
}
