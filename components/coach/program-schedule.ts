import type { Schedule, ScheduleSlot } from "@/components/coach/program-draft-storage"

const DAYS_IN_WEEK = 7

/** Training days (0 = Monday) of a brand-new program: Mon, Tue, Thu, Sat. */
const DEFAULT_TRAINING_DAYS = new Set([0, 1, 3, 5])

function defaultWeek(): ScheduleSlot[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_day, dayIndex) => (DEFAULT_TRAINING_DAYS.has(dayIndex) ? { routine: null } : null))
}

/** A week with the same training and rest days as `week`, and no sessions yet. */
function emptyWeekLike(week: ScheduleSlot[] | undefined): ScheduleSlot[] {
  return week ? week.map((slot) => (slot ? { routine: null } : null)) : defaultWeek()
}

function weekHasSessions(week: ScheduleSlot[] | undefined) {
  return Boolean(week?.some((slot) => slot?.routine))
}

export function makeEmptySchedule(weeks: number): Schedule {
  return Array.from({ length: weeks }, defaultWeek)
}

/**
 * The schedule at a new length. Existing weeks stay exactly as the coach
 * arranged them; each added week takes the training and rest days of the week
 * before it.
 */
export function resizeScheduleWeeks(current: Schedule, weeks: number): Schedule {
  const next = current.slice(0, weeks)
  while (next.length < weeks) {
    next.push(emptyWeekLike(next[next.length - 1]))
  }
  return next
}

/**
 * Lays out the days of a schedule loaded from the server, where only sessions
 * are stored: a rest day and an unfilled day both come back without a workout.
 *
 * In a week with sessions every other day is a rest day. A week without any
 * takes the layout of the nearest filled week before it (or the first filled
 * week), so the coach fills it in on the same days.
 */
export function layoutLoadedSchedule(schedule: Schedule): Schedule {
  const firstFilled = schedule.find(weekHasSessions)
  let previousFilled = firstFilled

  return schedule.map((week) => {
    if (!weekHasSessions(week)) return emptyWeekLike(previousFilled)
    const laidOut = week.map((slot) => (slot?.routine ? slot : null))
    previousFilled = laidOut
    return laidOut
  })
}
