/**
 * Week arithmetic for multi-week programs, shared by the coach program editor
 * and the trainee routines board.
 *
 * This is a client-side mirror of the backend's `getAssignmentWeekIndex` and
 * `isAssignmentProgramFinished` (backend/src/services/fitness-data/core.ts).
 * The backend uses the same Monday-start UTC week to decide which workouts a
 * trainee may see, so the two must agree — if this drifts, the UI will label a
 * week the server never served.
 */

export type CurrentWeekProgress =
  | { kind: "active"; weekIndex: number }
  | { kind: "not-started" }
  | { kind: "completed" }
  | null

export const MIN_WEEKS = 1
export const MAX_WEEKS = 52

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function clampWeeks(value: number) {
  if (!Number.isFinite(value)) {
    return 8
  }

  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(value)))
}

export function parseValidDate(value: unknown) {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value as string | number)
  return Number.isFinite(date.getTime()) ? date : null
}

export function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + offset)
  return start
}

export function resolveCurrentWeekProgress(
  assignedAt: unknown,
  totalWeeks: number,
  now = new Date(),
): CurrentWeekProgress {
  const assignedDate = parseValidDate(assignedAt)
  if (!assignedDate) return null
  if (assignedDate.getTime() > now.getTime()) return { kind: "not-started" }

  const assignmentWeekStart = startOfUtcWeek(assignedDate)
  const currentWeekStart = startOfUtcWeek(now)
  const elapsedWeeks = Math.floor((currentWeekStart.getTime() - assignmentWeekStart.getTime()) / (DAY_IN_MS * 7))
  const lastWeekIndex = Math.max(0, clampWeeks(totalWeeks) - 1)

  if (elapsedWeeks > lastWeekIndex) return { kind: "completed" }
  return { kind: "active", weekIndex: Math.max(0, Math.min(lastWeekIndex, elapsedWeeks)) }
}
