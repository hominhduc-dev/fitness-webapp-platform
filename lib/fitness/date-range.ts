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
 * Resolve a program's start date. Falls back to `durationWeeks` ago from now
 * when `assignedAt` is missing or invalid.
 */
export function getProgramStartDate(assignedAt: unknown, durationWeeks: number): Date {
  const parsedAssignedAt = parseValidDate(assignedAt)

  if (parsedAssignedAt) {
    return parsedAssignedAt
  }

  return new Date(Date.now() - durationWeeks * 7 * 24 * 60 * 60 * 1000)
}
