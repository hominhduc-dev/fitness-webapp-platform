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

export { buildFoodSlug, parseServingLabel, roundNutrition }
