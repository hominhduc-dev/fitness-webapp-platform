/**
 * The smallest jump in load a piece of equipment actually allows, so a
 * progression suggestion lands on a weight the trainee can load: a barbell
 * moves in 2.5 kg (a pair of 1.25 kg plates), dumbbells in 2 kg pairs, a
 * selectorized machine in 5 kg pins. 51.25 kg on a bar is not a real option.
 *
 * Null means the load is not the thing that progresses (bodyweight, bands):
 * such an exercise moves on reps alone.
 */

type EquipmentRule = { increment: number | null; pattern: RegExp }

/** Most specific first: "smith machine" is a bar, not a pin-loaded machine. */
const EQUIPMENT_RULES: readonly EquipmentRule[] = [
  { increment: null, pattern: /body\s*weight|band|suspension|trx/ },
  { increment: 2.5, pattern: /smith|barbell|ez[\s-]?bar|trap[\s-]?bar|hex[\s-]?bar|landmine/ },
  { increment: 2, pattern: /dumbbell|\bdb\b/ },
  { increment: 4, pattern: /kettlebell|\bkb\b/ },
  { increment: 2.5, pattern: /cable|pulley/ },
  { increment: 5, pattern: /machine|lever|sled|plate[\s-]?loaded|selector/ },
]

const FALLBACK_INCREMENT = 2.5

/** The variation's own increment when one was set, else its equipment's. */
function resolveLoadIncrement(explicitKg: number | null | undefined, equipment: string | null | undefined) {
  if (explicitKg != null && explicitKg > 0) return explicitKg

  const normalized = (equipment ?? "").trim().toLowerCase()
  if (!normalized) return FALLBACK_INCREMENT
  const rule = EQUIPMENT_RULES.find((entry) => entry.pattern.test(normalized))
  return rule ? rule.increment : FALLBACK_INCREMENT
}

function roundTo(value: number, step: number) {
  // Rounding in whole steps keeps 0.1 + 0.2 style float error out of the result.
  return Math.round(Math.round(value / step) * step * 100) / 100
}

/**
 * The next loadable weight above `previous`: the percentage jump rounded to the
 * equipment's grid, and never less than the first grid step above `previous`.
 */
function nextLoad(previous: number, increment: number, pct: number) {
  const firstStepAbove = (Math.floor(previous / increment + 1e-9) + 1) * increment
  return roundTo(Math.max(roundTo(previous * (1 + pct), increment), firstStepAbove), increment)
}

/** The loadable weight nearest `previous × factor`, kept strictly below `previous`. */
function lowerLoad(previous: number, increment: number, factor: number) {
  const target = roundTo(previous * factor, increment)
  return Math.max(0, target < previous ? target : roundTo(previous - increment, increment))
}

export { lowerLoad, nextLoad, resolveLoadIncrement }
