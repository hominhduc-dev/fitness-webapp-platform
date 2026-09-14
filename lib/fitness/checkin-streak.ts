const DAY_MS = 24 * 60 * 60 * 1000

function dayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/**
 * Consecutive days with a recovery check-in, ending today.
 *
 * `checkInDate` is the trainee's local calendar day ("YYYY-MM-DD"), so it is
 * compared against today's key in the same timezone. A streak that ended
 * yesterday still counts: the trainee has the rest of today to extend it, and
 * dropping to zero at midnight would punish people who check in later in the day.
 */
export function countCheckInStreak(entries: ReadonlyArray<{ checkInDate: string }>, todayKey: string) {
  const days = new Set(entries.map((entry) => dayNumber(entry.checkInDate)))
  const today = dayNumber(todayKey)

  let cursor = days.has(today) ? today : today - 1
  let streak = 0

  while (days.has(cursor)) {
    streak += 1
    cursor -= 1
  }

  return streak
}
