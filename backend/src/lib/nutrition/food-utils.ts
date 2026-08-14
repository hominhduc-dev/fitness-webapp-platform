function normalizeSlugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildFoodSlug(name: string, scope: "system" | { userId: string }) {
  const normalizedName = normalizeSlugPart(name)
  return typeof scope === "string" ? `system-${normalizedName}` : `user-${scope.userId}-${normalizedName}`
}

function parseServingLabel(servingLabel: string) {
  const match = servingLabel.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i)

  if (!match) {
    return {
      servingAmount: 1,
      servingUnit: "serving",
    }
  }

  return {
    servingAmount: Number(match[1].replace(",", ".")),
    servingUnit: match[2].toLowerCase(),
  }
}

function roundNutrition(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

/**
 * How much of a food to show the trainee.
 *
 * Prefers real weight — most of the library stores its serving in grams (or
 * millilitres for drinks), so "2 serving" can be shown as the "200 g" it
 * actually is. Prepared dishes ("1 tô", "1 dĩa") carry no weight anywhere in
 * the data, so those keep their own label rather than inventing a number.
 */
function formatFoodQuantity(
  food: { servingAmount: number; servingUnit: string; servingLabel: string },
  input: { amountValue: number; amountUnit: string },
) {
  if (input.amountUnit === "g" || input.amountUnit === "ml") {
    return `${roundNutrition(input.amountValue, 0)} ${input.amountUnit}`
  }

  if ((food.servingUnit === "g" || food.servingUnit === "ml") && food.servingAmount > 0) {
    return `${roundNutrition(input.amountValue * food.servingAmount, 0)} ${food.servingUnit}`
  }

  const label = food.servingLabel?.trim()
  if (!label) {
    return `${roundNutrition(input.amountValue, 1)} phần`
  }

  return input.amountValue === 1 ? label : `${roundNutrition(input.amountValue, 1)} × ${label}`
}

export { buildFoodSlug, formatFoodQuantity, parseServingLabel, roundNutrition }
