import { describe, expect, it } from "vitest"

import { collectSummaryMuscleGroups } from "@/components/coach/trainee-workout-logs-excel"

const rows = (...groups: string[]) => groups.map((muscleGroup) => ({ muscleGroup }))

describe("collectSummaryMuscleGroups", () => {
  it("lists the app's muscle groups the week's exercises belong to, once each", () => {
    expect(collectSummaryMuscleGroups(rows("Shoulders", "Chest", "Shoulders", "Arms", "Back", "Back"))).toEqual([
      "Chest",
      "Back",
      "Shoulders",
      "Arms",
    ])
  })

  it("skips rest and synthetic rows, which have no muscle group", () => {
    expect(collectSummaryMuscleGroups(rows("", "Legs", "  "))).toEqual(["Legs"])
  })

  it("merges groups that differ only in case, keeping the first spelling", () => {
    expect(collectSummaryMuscleGroups(rows("back", "Back"))).toEqual(["back"])
  })

  it("puts groups outside the usual order last, alphabetically", () => {
    expect(collectSummaryMuscleGroups(rows("Neck", "Core", "Forearms", "Chest"))).toEqual(["Chest", "Core", "Forearms", "Neck"])
  })

  it("keeps to the summary's twelve slots above the total", () => {
    const many = Array.from({ length: 15 }, (_value, index) => `Group ${String(index).padStart(2, "0")}`)
    expect(collectSummaryMuscleGroups(rows(...many))).toHaveLength(12)
  })
})
