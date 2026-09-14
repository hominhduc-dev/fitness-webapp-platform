/**
 * Weight is stored in kilograms everywhere; the display unit is a per-trainee
 * preference (`User.preferredWeightUnit`). Conversion and formatting live here
 * so a figure reads the same on the weight tracker, the progress overview and
 * anywhere else that shows a body weight.
 */

const KG_TO_LBS = 2.20462
const MISSING_WEIGHT_PLACEHOLDER = "--"

type WeightUnit = "kg" | "lbs"

function isFiniteNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function convertWeightFromKg(weightKg: number, unit: WeightUnit) {
  return unit === "lbs" ? weightKg * KG_TO_LBS : weightKg
}

function convertWeightToKg(weight: number, unit: WeightUnit) {
  return unit === "lbs" ? weight / KG_TO_LBS : weight
}

function formatWeight(weightKg: number | null | undefined, unit: WeightUnit, fractionDigits = 1) {
  if (!isFiniteNumber(weightKg)) return MISSING_WEIGHT_PLACEHOLDER
  return convertWeightFromKg(weightKg, unit).toFixed(fractionDigits)
}

/** Returns null rather than a placeholder: a missing delta has nothing to sign. */
function formatSignedWeight(weightKg: number | null | undefined, unit: WeightUnit, fractionDigits = 1) {
  if (!isFiniteNumber(weightKg)) return null
  const converted = convertWeightFromKg(weightKg, unit)
  const prefix = converted > 0 ? "+" : ""
  return `${prefix}${converted.toFixed(fractionDigits)}`
}

/**
 * Lean mass is not stored — it is what is left once body fat is taken off the
 * scale weight, so it only exists for an entry that recorded both.
 */
function calculateLeanMassKg(weightKg?: number | null, bodyFatPct?: number | null) {
  if (!isFiniteNumber(weightKg) || !isFiniteNumber(bodyFatPct)) return undefined
  if (bodyFatPct < 0 || bodyFatPct > 100) return undefined
  return weightKg * (1 - bodyFatPct / 100)
}

export {
  calculateLeanMassKg,
  convertWeightFromKg,
  convertWeightToKg,
  formatSignedWeight,
  formatWeight,
  KG_TO_LBS,
  type WeightUnit,
}
