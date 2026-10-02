/**
 * Readiness is stored, transported and shown on a 0–100 scale — the database
 * enforces `CHECK (readinessScore BETWEEN 0 AND 100)` — the same range Huawei
 * Health uses for its own scores, so the numbers sit naturally beside synced
 * wearable data. The helpers live here so every surface shows the same number.
 */

const READINESS_SCALE_MAX = 100

/** Whole points: on 0–100 a decimal adds noise, not information. */
function formatReadinessScore(score?: number | null, placeholder = "—") {
  if (score == null || !Number.isFinite(score)) return placeholder
  return String(Math.round(Math.max(0, Math.min(READINESS_SCALE_MAX, score))))
}

/** Fraction of the ring to fill, clamped so a stray value cannot overdraw it. */
function readinessRingProgress(score?: number | null) {
  if (score == null || !Number.isFinite(score)) return 0
  return Math.max(0, Math.min(1, score / READINESS_SCALE_MAX))
}

export { formatReadinessScore, READINESS_SCALE_MAX, readinessRingProgress }
