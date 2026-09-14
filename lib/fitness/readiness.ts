/**
 * Readiness is stored and transported on a 0–100 scale — the database enforces
 * `CHECK (readinessScore BETWEEN 0 AND 100)` — but trainees read it on a 0–10
 * scale, the way a rating is normally spoken ("7.8 today"). The conversion
 * lives here so every surface shows the same number.
 */

const READINESS_SCALE_MAX = 10
const READINESS_STORED_MAX = 100

function toReadinessScale(score: number) {
  return (score / READINESS_STORED_MAX) * READINESS_SCALE_MAX
}

/**
 * One decimal, because whole numbers on a 0–10 scale hide the day-to-day
 * movement that makes the score worth checking.
 */
function formatReadinessScore(score?: number | null, placeholder = "—") {
  if (score == null || !Number.isFinite(score)) return placeholder
  return toReadinessScale(score).toFixed(1)
}

/** Fraction of the ring to fill, clamped so a stray value cannot overdraw it. */
function readinessRingProgress(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return 0
  return Math.max(0, Math.min(1, score / READINESS_STORED_MAX))
}

export { formatReadinessScore, READINESS_SCALE_MAX, readinessRingProgress, toReadinessScale }
