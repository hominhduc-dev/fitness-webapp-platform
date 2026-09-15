/**
 * Fits portion sizes to a nutrition target.
 *
 * The model is good at choosing foods that belong together and bad at
 * arithmetic, so it only proposes rough portions; the amounts that actually get
 * saved are solved here, deterministically, from catalog nutrition.
 */

type Nutrients = { calories: number; protein: number; carbs: number; fat: number }

type ScalableItem = {
  /** Nutrition contributed by one unit of `amount` (1 g, 1 ml or 1 serving). */
  perUnit: Nutrients
  /** Starting amount, usually the model's suggestion. */
  amount: number
  min: number
  max: number
  /** Kitchen-friendly increment the final amount is snapped to. */
  step: number
}

const NUTRIENT_KEYS = ["calories", "protein", "carbs", "fat"] as const
const EPSILON = 1e-9

function totalsFor(items: ScalableItem[], amounts: number[]): Nutrients {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  items.forEach((item, index) => {
    for (const key of NUTRIENT_KEYS) totals[key] += item.perUnit[key] * amounts[index]
  })
  return totals
}

/** Weighted squared *relative* error, so 10 g of fat and 100 kcal are comparable. */
function fitError(totals: Nutrients, target: Nutrients, weights: Nutrients) {
  let error = 0
  for (const key of NUTRIENT_KEYS) {
    if (target[key] <= 0 || weights[key] <= 0) continue
    const relative = (totals[key] - target[key]) / target[key]
    error += weights[key] * relative * relative
  }
  return error
}

function clamp(value: number, item: ScalableItem) {
  return Math.min(item.max, Math.max(item.min, value))
}

/**
 * Returns one amount per item. Bounds are honoured exactly and every amount is a
 * multiple of its step; the target itself may be unreachable within bounds, in
 * which case the closest reachable combination is returned.
 */
function fitPortions(items: ScalableItem[], target: Nutrients, weights: Nutrients): number[] {
  const bounded = items.map((item) => {
    const min = Math.max(item.step, Math.ceil(item.min / item.step - EPSILON) * item.step)
    const max = Math.max(min, Math.floor(item.max / item.step + EPSILON) * item.step)
    return { ...item, min, max }
  })
  const amounts = bounded.map((item) => clamp(item.amount, item))

  // Continuous pass: each item moves to the exact minimum of the quadratic with
  // the others held fixed. Converges quickly for the handful of items in a day.
  for (let sweep = 0; sweep < 40; sweep++) {
    bounded.forEach((item, index) => {
      const totals = totalsFor(bounded, amounts)
      let numerator = 0
      let denominator = 0
      for (const key of NUTRIENT_KEYS) {
        if (target[key] <= 0 || weights[key] <= 0) continue
        const perUnit = item.perUnit[key]
        const others = totals[key] - perUnit * amounts[index]
        numerator += (weights[key] * perUnit * (target[key] - others)) / target[key] ** 2
        denominator += (weights[key] * perUnit * perUnit) / target[key] ** 2
      }
      if (denominator > 0) amounts[index] = clamp(numerator / denominator, item)
    })
  }

  // Snap to steps, then repair the rounding drift one step at a time.
  bounded.forEach((item, index) => {
    amounts[index] = clamp(Math.round(amounts[index] / item.step) * item.step, item)
  })
  let current = fitError(totalsFor(bounded, amounts), target, weights)
  for (let iteration = 0; iteration < 500; iteration++) {
    let best = { error: current, index: -1, value: 0 }
    bounded.forEach((item, index) => {
      for (const direction of [-1, 1]) {
        const value = amounts[index] + direction * item.step
        if (value < item.min - EPSILON || value > item.max + EPSILON) continue
        const previous = amounts[index]
        amounts[index] = value
        const error = fitError(totalsFor(bounded, amounts), target, weights)
        amounts[index] = previous
        if (error < best.error - EPSILON * EPSILON) best = { error, index, value }
      }
    })
    if (best.index < 0) break
    amounts[best.index] = best.value
    current = best.error
  }

  return amounts.map((amount) => Number(amount.toFixed(4)))
}

export { fitPortions }
export type { Nutrients, ScalableItem }
