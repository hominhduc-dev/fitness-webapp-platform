/**
 * Bodyweight trend: daily scale readings swing by a kilo or more on water and
 * food alone, so the trend is read from weekly averages of one reading per day
 * rather than from any two single weigh-ins.
 */

type WeightReading = { recordedAt: Date; weightKg?: number | null }

type WeightTrend = {
  /** Mean of the daily weights over the last seven days. */
  sevenDayAverageKg: number | null
  /** That average minus the one for the seven days before, in kg per week. */
  ratePerWeekKg: number | null
  /** The weekly rate as a percentage of the previous week's average. */
  ratePerWeekPct: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000
/** Readings a week needs before its average says anything. */
const MIN_DAYS_PER_WEEK = 3

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** The day's last reading stands for the day. */
function dailyWeights(readings: readonly WeightReading[]) {
  const byDay = new Map<string, { day: Date; recordedAt: Date; weightKg: number }>()
  for (const reading of readings) {
    if (reading.weightKg == null || !Number.isFinite(reading.weightKg)) continue
    const key = dayKey(reading.recordedAt)
    const existing = byDay.get(key)
    if (!existing || reading.recordedAt > existing.recordedAt) {
      byDay.set(key, { day: startOfLocalDay(reading.recordedAt), recordedAt: reading.recordedAt, weightKg: reading.weightKg })
    }
  }
  return Array.from(byDay.values())
}

function average(values: readonly number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function buildWeightTrend(readings: readonly WeightReading[], now = new Date()): WeightTrend {
  const today = startOfLocalDay(now).getTime()
  const days = dailyWeights(readings)
  const inWindow = (fromDaysAgo: number, toDaysAgo: number) =>
    days.filter(({ day }) => {
      const age = Math.round((today - day.getTime()) / DAY_MS)
      return age >= fromDaysAgo && age < toDaysAgo
    }).map(({ weightKg }) => weightKg)

  const thisWeek = inWindow(0, 7)
  const lastWeek = inWindow(7, 14)
  const sevenDayAverage = average(thisWeek)
  const previousAverage = average(lastWeek)

  if (sevenDayAverage == null || previousAverage == null || thisWeek.length < MIN_DAYS_PER_WEEK || lastWeek.length < MIN_DAYS_PER_WEEK) {
    return { ratePerWeekKg: null, ratePerWeekPct: null, sevenDayAverageKg: sevenDayAverage == null ? null : round(sevenDayAverage, 2) }
  }

  const rate = sevenDayAverage - previousAverage
  return {
    ratePerWeekKg: round(rate, 2),
    ratePerWeekPct: round((rate / previousAverage) * 100, 2),
    sevenDayAverageKg: round(sevenDayAverage, 2),
  }
}

export { buildWeightTrend }
export type { WeightTrend }
