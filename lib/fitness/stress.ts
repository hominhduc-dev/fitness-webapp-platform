/**
 * Stress is scored 1–99, the scale Huawei Health uses, so a value the trainee
 * picks and one synced from their watch read the same way. The bands follow
 * Huawei's own levels (relaxed 1–29, normal 30–59, medium 60–79, high 80–99).
 */

type StressLevel = "none" | "low" | "medium" | "high"

const STRESS_MIN = 1
const STRESS_MAX = 99

const STRESS_LEVELS: ReadonlyArray<{ level: StressLevel; max: number; min: number }> = [
  { level: "none", min: 1, max: 29 },
  { level: "low", min: 30, max: 59 },
  { level: "medium", min: 60, max: 79 },
  { level: "high", min: 80, max: 99 },
]

function stressLevelFor(score?: number | null): StressLevel | null {
  if (score == null || !Number.isFinite(score)) return null
  const clamped = Math.min(STRESS_MAX, Math.max(STRESS_MIN, Math.round(score)))
  return STRESS_LEVELS.find((band) => clamped <= band.max)?.level ?? null
}

/** "42 · Low": the number for comparing days, the level for reading it at a glance. */
function formatStress(score: number, labels: Record<StressLevel, string>) {
  const level = stressLevelFor(score)
  return level ? `${Math.round(score)} · ${labels[level]}` : String(score)
}

export { formatStress, STRESS_LEVELS, STRESS_MAX, STRESS_MIN, stressLevelFor }
export type { StressLevel }
