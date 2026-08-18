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

export type ProgramWeekPlacement =
  | { kind: "active"; weekIndex: number }
  | { kind: "before" }
  | { kind: "after" }
  | null

/**
 * Where an arbitrary calendar week falls relative to a program's span.
 *
 * `weekStartCalendarDate` is a **local-midnight** Date whose calendar date is
 * the UTC Monday of that week — the shape `startOfUtcWeekAsLocal` produces in
 * the weekly calendar. Handing it straight to `startOfUtcWeek` would land on
 * the previous Monday in any positive-offset timezone, so the UTC instant is
 * rebuilt from its calendar fields first.
 */
export function resolveProgramWeekForWeekStart(
  assignedAt: unknown,
  totalWeeks: number,
  weekStartCalendarDate: Date,
): ProgramWeekPlacement {
  const assignedDate = parseValidDate(assignedAt)
  if (!assignedDate) return null

  const weekStartUtc = Date.UTC(
    weekStartCalendarDate.getFullYear(),
    weekStartCalendarDate.getMonth(),
    weekStartCalendarDate.getDate(),
  )
  const assignmentWeekStart = startOfUtcWeek(assignedDate)
  const elapsedWeeks = Math.round((weekStartUtc - assignmentWeekStart.getTime()) / (DAY_IN_MS * 7))
  const lastWeekIndex = Math.max(0, clampWeeks(totalWeeks) - 1)

  if (elapsedWeeks < 0) return { kind: "before" }
  if (elapsedWeeks > lastWeekIndex) return { kind: "after" }
  return { kind: "active", weekIndex: elapsedWeeks }
}

/**
 * Which authored week to actually show for a target week.
 *
 * A program that stops short repeats its last authored week rather than going
 * blank — the AI generator writes only week 0 and expects it to repeat. This
 * mirrors `selectVisibleWorkoutsForAssignmentWeek` on the backend; the two must
 * agree or /schedule and /workout will disagree about the same week.
 */
export function resolveEffectiveWeekIndex(authoredWeeks: number[], targetWeekIndex: number) {
  if (authoredWeeks.length === 0) return null

  const atOrBefore = authoredWeeks.filter((weekIndex) => weekIndex <= targetWeekIndex)
  return atOrBefore.length > 0 ? Math.max(...atOrBefore) : Math.min(...authoredWeeks)
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
