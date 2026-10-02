/**
 * Hours slept, picked on a slider. The bands are the check-in's sleep-quality
 * answers, which the app already defines by hours (Very poor under 5, Poor
 * 5–6, Okay 6–7, Good 7–8, Great 8 or more), so one slider sets both the
 * duration and the quality score the readiness algorithm reads.
 */

const SLEEP_MIN_MINUTES = 2 * 60
const SLEEP_MAX_MINUTES = 10 * 60
const SLEEP_STEP_MINUTES = 15

/** Ordered short to long; `quality` is the 1–5 sleep-quality answer. */
const SLEEP_BANDS: ReadonlyArray<{ max: number; min: number; quality: 1 | 2 | 3 | 4 | 5; range: string }> = [
  { max: 299, min: SLEEP_MIN_MINUTES, quality: 1, range: "<5h" },
  { max: 359, min: 300, quality: 2, range: "5–6h" },
  { max: 419, min: 360, quality: 3, range: "6–7h" },
  { max: 479, min: 420, quality: 4, range: "7–8h" },
  { max: SLEEP_MAX_MINUTES, min: 480, quality: 5, range: "8h+" },
]

function sleepQualityFor(minutes?: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return null
  return (SLEEP_BANDS.find((band) => minutes <= band.max) ?? SLEEP_BANDS[SLEEP_BANDS.length - 1]).quality
}

/** Where a band's button puts the slider: the middle of it, on the step grid. */
function sleepBandMidpoint(band: { max: number; min: number }) {
  return Math.round((band.min + band.max) / 2 / SLEEP_STEP_MINUTES) * SLEEP_STEP_MINUTES
}

/** "7h 30m". */
function formatSleepDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export {
  formatSleepDuration,
  SLEEP_BANDS,
  SLEEP_MAX_MINUTES,
  SLEEP_MIN_MINUTES,
  SLEEP_STEP_MINUTES,
  sleepBandMidpoint,
  sleepQualityFor,
}
