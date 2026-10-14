import { describe, expect, it } from "vitest"

import { libraryGroupOf, LIBRARY_GROUPS, sortEquipmentChips } from "./exercise-library-groups"

describe("libraryGroupOf", () => {
  it("files an exercise under its first primary muscle", () => {
    expect(libraryGroupOf({ primaryMuscles: ["triceps", "chest"] })).toBe("triceps")
    expect(libraryGroupOf({ primaryMuscles: ["obliques"] })).toBe("abs")
    expect(libraryGroupOf({ primaryMuscles: ["trapezius"] })).toBe("back")
    expect(libraryGroupOf({ primaryMuscles: ["tibialis"] })).toBe("calves")
  })

  it("puts cardio and mobility work in their own cards whatever the muscles", () => {
    expect(libraryGroupOf({ activityType: "cardio", primaryMuscles: ["quadriceps"] })).toBe("cardio")
    expect(libraryGroupOf({ movementPattern: "mobility", primaryMuscles: ["upper-back"] })).toBe("other")
    expect(libraryGroupOf({ movementPattern: "carry", primaryMuscles: ["forearm"] })).toBe("other")
  })

  it("falls back to the old muscle group without a muscle profile", () => {
    expect(libraryGroupOf({ muscleGroup: "Core", primaryMuscles: [] })).toBe("abs")
    expect(libraryGroupOf({ muscleGroup: "Full body", primaryMuscles: [] })).toBe("other")
  })

  it("covers every muscle slug with exactly one card", () => {
    const slugs = LIBRARY_GROUPS.flatMap((group) => group.slugs)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toHaveLength(16)
  })
})

describe("sortEquipmentChips", () => {
  it("keeps the common equipment first and dedupes", () => {
    expect(sortEquipmentChips(["TRX", "Dumbbell", "Barbell", "Dumbbell", "Bench"])).toEqual(["Barbell", "Dumbbell", "Bench", "TRX"])
  })
})
