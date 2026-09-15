import { addUtcDays, formatUtcDateOnly } from "./dates"

/**
 * Pure builders behind the coach's trainee overview.
 *
 * Like `analytics.ts`, these take already-fetched rows and return plain data, so
 * the numbers a coach sees can be tested without a database.
 */

type OverviewWeekLog = {
  completedAt: Date | null
  exercises: Array<{ sets: Array<{ completed?: boolean }> }>
  startedAt: Date
  totalVolume?: number | null
}

/**
 * Seven Monday-first UTC days, the same week and day keys as the trainee's own
 * schedule. A session counts once it is completed; sets and volume count from
 * whatever was logged, so a session still in progress already shows its work.
 */
function buildTraineeWeekOverview(logs: readonly OverviewWeekLog[], weekStart: Date, plannedSessions: number) {
  const days = Array.from({ length: 7 }, (_value, index) => ({
    date: formatUtcDateOnly(addUtcDays(weekStart, index)),
    sessions: 0,
    sets: 0,
    volume: 0,
  }))
  const dayByKey = new Map(days.map((day) => [day.date, day]))

  for (const log of logs) {
    const day = dayByKey.get(formatUtcDateOnly(log.startedAt))

    if (!day) continue

    day.sets += log.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0)
    day.volume += log.totalVolume ?? 0

    if (log.completedAt) day.sessions += 1
  }

  for (const day of days) day.volume = Math.round(day.volume)

  return {
    completedSessions: days.reduce((sum, day) => sum + day.sessions, 0),
    days,
    plannedSessions,
    totalSets: days.reduce((sum, day) => sum + day.sets, 0),
    totalVolume: days.reduce((sum, day) => sum + day.volume, 0),
    weekStart: days[0].date,
  }
}

type BodyMetricOverviewInput = {
  bodyFat: { bodyFatPct: number | null; recordedAt: Date } | null
  waist: { recordedAt: Date; waistCm: number | null } | null
  /** Newest first; the second entry is the previous weigh-in for the delta. */
  weights: ReadonlyArray<{ recordedAt: Date; weightKg: number | null }>
}

/**
 * Each field comes from its own latest entry. Trainees weigh in far more often
 * than they measure, so reading one latest row would blank out waist and body
 * fat every time a weight-only entry lands.
 */
function buildBodyMetricOverview({ bodyFat, waist, weights }: BodyMetricOverviewInput) {
  const [latest, previous] = weights.filter((entry) => entry.weightKg != null)

  return {
    bodyFatPct: bodyFat?.bodyFatPct != null
      ? { recordedAt: formatUtcDateOnly(bodyFat.recordedAt), value: bodyFat.bodyFatPct }
      : null,
    waistCm: waist?.waistCm != null
      ? { recordedAt: formatUtcDateOnly(waist.recordedAt), value: waist.waistCm }
      : null,
    weightKg: latest?.weightKg != null
      ? {
          deltaKg: previous?.weightKg != null ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : null,
          recordedAt: formatUtcDateOnly(latest.recordedAt),
          value: latest.weightKg,
        }
      : null,
  }
}

export { buildBodyMetricOverview, buildTraineeWeekOverview }
export type { OverviewWeekLog }
