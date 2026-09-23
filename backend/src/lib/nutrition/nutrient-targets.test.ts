import { describe, expect, it } from "vitest"

import { buildNutrientTargets } from "./nutrient-targets"

const today = new Date("2026-09-23T00:00:00Z")

describe("buildNutrientTargets", () => {
  it("uses the adult female values for a 25-year-old woman", () => {
    const targets = buildNutrientTargets({ sex: "female", birthDate: "2001-01-01", dailyCalorieGoal: 2000 }, today)
    expect(targets.iron).toEqual({ amount: 18, kind: "reach" })
    expect(targets.potassium?.amount).toBe(2600)
    expect(targets.magnesium?.amount).toBe(310)
    expect(targets.fiber).toEqual({ amount: 28, kind: "reach" })
  })

  it("moves to the next band on the birthday, not before", () => {
    const dayBefore = buildNutrientTargets({ sex: "male", birthDate: "1995-09-24" }, today)
    const onBirthday = buildNutrientTargets({ sex: "male", birthDate: "1995-09-23" }, today)
    expect(dayBefore.magnesium?.amount).toBe(400)
    expect(onBirthday.magnesium?.amount).toBe(420)
  })

  it("drops women's iron and raises calcium after 50", () => {
    const targets = buildNutrientTargets({ sex: "female", birthDate: "1970-01-01" }, today)
    expect(targets.iron?.amount).toBe(8)
    expect(targets.calcium?.amount).toBe(1200)
  })

  it("uses the midpoint when sex is unknown and an adult age when birth date is", () => {
    const targets = buildNutrientTargets({}, today)
    expect(targets.iron?.amount).toBe(13)
    expect(targets.potassium?.amount).toBe(3000)
  })

  it("treats sodium and saturated fat as ceilings and leaves sugar untargeted", () => {
    const targets = buildNutrientTargets({ dailyCalorieGoal: 2700 }, today)
    expect(targets.sodium).toEqual({ amount: 2300, kind: "limit" })
    expect(targets.saturated_fat).toEqual({ amount: 30, kind: "limit" })
    expect(targets.sugar).toBeUndefined()
    expect(targets.cholesterol).toBeUndefined()
  })
})
