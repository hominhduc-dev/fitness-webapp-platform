import { getRequestTimeZone, toZonedDateKey, zonedMidnight } from "../time-zone"

// Calendar days follow the requesting client's time zone (X-Timezone), falling
// back to Vietnam. Date-only database columns remain UTC midnight keys; timestamp
// windows use the instant that client day begins.
/** The zone to describe to the model for the current request. */
export function getAiTimeZone() { return getRequestTimeZone() }
export function localDateKey(now = new Date()) {
  return toZonedDateKey(now)
}
export function dateKeyInstant(key: string) { return new Date(`${key}T00:00:00.000Z`) }
export function dayKey(now = new Date()) { return dateKeyInstant(localDateKey(now)) }
/** The instant the client's current calendar day begins. */
export function startOfClientDay(now = new Date()) {
  const key = dayKey(now)
  return zonedMidnight(key.getUTCFullYear(), key.getUTCMonth() + 1, key.getUTCDate())
}
export function plusDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000) }
export function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1 && Number.isFinite(dateKeyInstant(value).getTime()) && dateKeyInstant(value).toISOString().slice(0, 10) === value
}
