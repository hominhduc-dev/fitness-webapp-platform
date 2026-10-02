/**
 * Wearable recovery signals, read against the trainee's own baseline.
 *
 * HRV and resting heart rate mean little as absolute numbers — an RMSSD of 40
 * is high for one person and low for another — so each day is compared with
 * the trainee's preceding four weeks. HRV is compared on a log scale (RMSSD is
 * right-skewed) as a z-score; resting heart rate as beats above the mean.
 */

type WearableDay = {
  date: Date
  hrvRmssd: number | null
  restingHeartRate: number | null
}

type WearableSignals = {
  /** Today's ln(RMSSD) in standard deviations from baseline; null without enough history. */
  hrvZScore: number | null
  /** Today's resting heart rate minus the baseline mean, in bpm; null without enough history. */
  restingHeartRateDelta: number | null
}

const BASELINE_DAYS = 28
/** Fewer days than this and a baseline is noise. */
const MIN_BASELINE_DAYS = 7
/** Floor on the HRV spread, so a near-constant baseline cannot blow a small change up. */
const MIN_LN_HRV_SD = 0.05
const DAY_MS = 24 * 60 * 60 * 1000

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]) {
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1))
}

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function wearableSignalsForDay(days: readonly WearableDay[], date: Date): WearableSignals {
  const dayStart = date.getTime()
  const today = days.find((day) => day.date.getTime() === dayStart)
  const baseline = days.filter((day) => {
    const time = day.date.getTime()
    return time < dayStart && time >= dayStart - BASELINE_DAYS * DAY_MS
  })

  let hrvZScore: number | null = null
  const lnHrv = baseline.flatMap((day) => (day.hrvRmssd != null && day.hrvRmssd > 0 ? [Math.log(day.hrvRmssd)] : []))
  if (today?.hrvRmssd != null && today.hrvRmssd > 0 && lnHrv.length >= MIN_BASELINE_DAYS) {
    const sd = Math.max(MIN_LN_HRV_SD, standardDeviation(lnHrv))
    hrvZScore = round((Math.log(today.hrvRmssd) - mean(lnHrv)) / sd, 2)
  }

  let restingHeartRateDelta: number | null = null
  const rhr = baseline.flatMap((day) => (day.restingHeartRate != null && day.restingHeartRate > 0 ? [day.restingHeartRate] : []))
  if (today?.restingHeartRate != null && today.restingHeartRate > 0 && rhr.length >= MIN_BASELINE_DAYS) {
    restingHeartRateDelta = round(today.restingHeartRate - mean(rhr), 1)
  }

  return { hrvZScore, restingHeartRateDelta }
}

export { BASELINE_DAYS, wearableSignalsForDay }
export type { WearableDay, WearableSignals }
