import type { NutrientCode } from "./nutrients"

/**
 * Daily micronutrient targets from the NIH Dietary Reference Intakes
 * (RDA where one exists, otherwise AI), by sex and age.
 *
 * "Reach" targets are minimums; "limit" targets are ceilings (sodium from the
 * Chronic Disease Risk Reduction intake, saturated fat from the Dietary
 * Guidelines' 10 % of energy). Sugar and cholesterol are tracked without a
 * target: the guidelines limit *added* sugar, which a food label's total sugar
 * cannot separate from fruit and milk, and there is no longer a numeric
 * cholesterol limit. Showing a line for either would warn people about fruit
 * and eggs.
 *
 * Under-14s are out of scope for the app and get the 14–18 values.
 */
type Sex = "male" | "female" | "other" | null | undefined

type NutrientTarget = { amount: number; kind: "reach" | "limit" }
type NutrientTargets = Partial<Record<NutrientCode, NutrientTarget>>

type Band = { male: number; female: number }
type AgeTable = Array<{ minAge: number; value: Band }>

// Rows are age bands, youngest first; each applies from `minAge` upwards.
const REACH_TABLES: Partial<Record<NutrientCode, AgeTable>> = {
  potassium: [
    { minAge: 0, value: { male: 3000, female: 2300 } },
    { minAge: 19, value: { male: 3400, female: 2600 } },
  ],
  calcium: [
    { minAge: 0, value: { male: 1300, female: 1300 } },
    { minAge: 19, value: { male: 1000, female: 1000 } },
    { minAge: 51, value: { male: 1000, female: 1200 } },
    { minAge: 71, value: { male: 1200, female: 1200 } },
  ],
  iron: [
    { minAge: 0, value: { male: 11, female: 15 } },
    { minAge: 19, value: { male: 8, female: 18 } },
    { minAge: 51, value: { male: 8, female: 8 } },
  ],
  magnesium: [
    { minAge: 0, value: { male: 410, female: 360 } },
    { minAge: 19, value: { male: 400, female: 310 } },
    { minAge: 31, value: { male: 420, female: 320 } },
  ],
  zinc: [
    { minAge: 0, value: { male: 11, female: 9 } },
    { minAge: 19, value: { male: 11, female: 8 } },
  ],
  vitamin_a: [{ minAge: 0, value: { male: 900, female: 700 } }],
  vitamin_c: [
    { minAge: 0, value: { male: 75, female: 65 } },
    { minAge: 19, value: { male: 90, female: 75 } },
  ],
  vitamin_d: [
    { minAge: 0, value: { male: 15, female: 15 } },
    { minAge: 71, value: { male: 20, female: 20 } },
  ],
  vitamin_b12: [{ minAge: 0, value: { male: 2.4, female: 2.4 } }],
  folate: [{ minAge: 0, value: { male: 400, female: 400 } }],
}

const DEFAULT_AGE = 30
const SODIUM_LIMIT_MG = 2300
const FIBER_G_PER_1000_KCAL = 14

function ageOn(birthDate: Date | string | null | undefined, today: Date) {
  if (!birthDate) return DEFAULT_AGE
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return DEFAULT_AGE
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
  if (beforeBirthday) age -= 1
  return age > 0 && age < 130 ? age : DEFAULT_AGE
}

/** Without a recorded sex, the midpoint: neither sex's number is a safer guess than the other. */
function valueFor(band: Band, sex: Sex) {
  if (sex === "male") return band.male
  if (sex === "female") return band.female
  return Math.round(((band.male + band.female) / 2) * 10) / 10
}

function pick(table: AgeTable, age: number) {
  let row = table[0]
  for (const candidate of table) if (age >= candidate.minAge) row = candidate
  return row.value
}

function buildNutrientTargets(
  profile: { sex?: Sex; birthDate?: Date | string | null; dailyCalorieGoal?: number | null },
  today = new Date(),
): NutrientTargets {
  const age = ageOn(profile.birthDate, today)
  const calories = profile.dailyCalorieGoal && profile.dailyCalorieGoal > 0 ? profile.dailyCalorieGoal : 2000
  const targets: NutrientTargets = {
    fiber: { amount: Math.round((calories / 1000) * FIBER_G_PER_1000_KCAL), kind: "reach" },
    sodium: { amount: SODIUM_LIMIT_MG, kind: "limit" },
    saturated_fat: { amount: Math.round((calories * 0.1) / 9), kind: "limit" },
  }

  for (const [code, table] of Object.entries(REACH_TABLES) as Array<[NutrientCode, AgeTable]>) {
    targets[code] = { amount: valueFor(pick(table, age), profile.sex), kind: "reach" }
  }

  return targets
}

export { buildNutrientTargets, type NutrientTarget, type NutrientTargets }
