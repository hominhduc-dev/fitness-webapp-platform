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
 * Always a real weight where one is known, because "2 × 1 tô" is not something
 * anyone can put on a scale. A food still missing `servingGrams` keeps its own
 * serving label rather than inventing a number.
 */
function formatFoodQuantity(
  food: { servingAmount: number; servingGrams?: number | null; servingUnit: string; servingLabel: string },
  input: { amountValue: number; amountUnit: string },
) {
  if (input.amountUnit === "g" || input.amountUnit === "ml") {
    return `${roundNutrition(input.amountValue, 0)} ${input.amountUnit}`
  }

  // A food already measured by weight or volume keeps its own unit; a drink
  // belongs in millilitres rather than being converted to grams.
  if ((food.servingUnit === "g" || food.servingUnit === "ml") && food.servingAmount > 0) {
    return `${roundNutrition(input.amountValue * food.servingAmount, 0)} ${food.servingUnit}`
  }

  if (food.servingGrams != null && food.servingGrams > 0) {
    return `${roundNutrition(input.amountValue * food.servingGrams, 0)} g`
  }

  const label = food.servingLabel?.trim()
  if (!label) {
    return `${roundNutrition(input.amountValue, 1)} phần`
  }

  return input.amountValue === 1 ? label : `${roundNutrition(input.amountValue, 1)} × ${label}`
}

export { buildFoodSlug, formatFoodQuantity, parseServingLabel, roundNutrition }
