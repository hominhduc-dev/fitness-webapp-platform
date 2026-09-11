// Fitness App uses Vietnamese calendar days. Date-only database columns remain
// UTC midnight keys; timestamp windows use the equivalent instant in UTC+07.
const OFFSET_MS = 7 * 60 * 60 * 1000
export const AI_TIME_ZONE = "Asia/Ho_Chi_Minh"
export function localDateKey(now = new Date()) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}
export function dateKeyInstant(key: string) { return new Date(`${key}T00:00:00.000Z`) }
export function dayKey(now = new Date()) { return dateKeyInstant(localDateKey(now)) }
export function startOfVietnamDay(now = new Date()) { return new Date(dayKey(now).getTime() - OFFSET_MS) }
export function plusDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000) }
export function validDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1 && Number.isFinite(dateKeyInstant(value).getTime()) && dateKeyInstant(value).toISOString().slice(0, 10) === value
}
