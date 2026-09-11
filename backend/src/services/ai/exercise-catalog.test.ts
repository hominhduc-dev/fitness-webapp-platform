import { describe, expect, it } from "vitest"
import { isEquipmentAllowed, selectCatalogForPrompt } from "./exercise-catalog"

describe("equipment-restricted prompt catalog", () => {
  it("includes IDs even when exactly one variation is usable", () => {
    const catalog = [{ id: "exercise", name: "Squat", muscleGroup: "Legs", createdById: null, variations: [
      { id: "barbell", name: "First", equipment: "Barbell" },
      { id: "body", name: "Default", equipment: "Bodyweight" },
      { id: "unknown", name: "Unknown", equipment: null },
    ] }]
    expect(selectCatalogForPrompt(catalog, { availableEquipment: "bodyweight" })[0].variations)
      .toEqual([{ id: "body", name: "Default", equipment: "Bodyweight" }])
  })
  it("does not assume unlisted equipment exists at home", () => {
    expect(isEquipmentAllowed("Dumbbell", "home_dumbbells")).toBe(true)
    expect(isEquipmentAllowed("Barbell", "home_dumbbells")).toBe(false)
    expect(isEquipmentAllowed("TRX", "bodyweight")).toBe(false)
    expect(isEquipmentAllowed(null, "bodyweight")).toBe(false)
    expect(isEquipmentAllowed("Barbell", "invented")).toBe(false)
    expect(isEquipmentAllowed(null, "full_gym")).toBe(true)
  })
})
