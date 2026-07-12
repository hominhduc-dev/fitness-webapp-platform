/**
 * Shared date helpers for log/program export date ranges.
 * Used by trainee + coach export flows so the windowing logic stays identical.
 */

/** Coerce an unknown value to a valid Date, or null when unparseable. */
export function parseValidDate(value: unknown): Date | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value as string | number)
  return Number.isFinite(date.getTime()) ? date : null
}

/** Format a Date as a UTC `YYYY-MM-DD` string. */
export function formatDateToISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Format a `YYYY-MM-DD` string (or Date) as `DD/MM/YYYY` for display. */
export function formatDisplayDate(value: string | Date): string {
  const iso = typeof value === "string" ? value : formatDateToISO(value)
  const [year, month, day] = iso.split("-")
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

/**
 * Snap a Date back to the Monday of its ISO week (computed in local time),
 * returned as UTC noon on that calendar date.
 *
 * Rationale: callers pass this Date through `formatDateToISO`, which uses
 * `toISOString().slice(0, 10)` — i.e. UTC-based. If we returned local midnight,
 * a VN user (UTC+7) would see the ISO slice shift back a day. Anchoring at UTC
 * noon means the ISO slice matches the local Monday's calendar date and the
 * Date remains unambiguously "that day" everywhere else it's read (getDate,
 * setDate arithmetic, etc.).
 */
function startOfIsoWeek(date: Date): Date {
  const local = new Date(date)
  const day = local.getDay()
  const diff = day === 0 ? -6 : 1 - day
  local.setDate(local.getDate() + diff)
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0))
}

/**
 * Resolve a program's start date, snapped to the Monday of the assignment week.
 *
 * Program weeks are Monday-aligned everywhere in the app (schedule, weekly
 * report sheets). If assignment happens mid-week (e.g. Tuesday), we still want
 * the export window to include that Monday, otherwise any log/planned session
 * on that Monday is silently dropped.
 *
 * Falls back to `durationWeeks` weeks ago (also Monday-snapped) when
 * `assignedAt` is missing or invalid.
 */
export function getProgramStartDate(assignedAt: unknown, durationWeeks: number): Date {
  const parsedAssignedAt = parseValidDate(assignedAt)

  if (parsedAssignedAt) {
    return startOfIsoWeek(parsedAssignedAt)
  }

  return startOfIsoWeek(new Date(Date.now() - durationWeeks * 7 * 24 * 60 * 60 * 1000))
}
