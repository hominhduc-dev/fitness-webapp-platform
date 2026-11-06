import { expect, it } from "vitest"

import { backoffWeightSuggestions } from "./set-targets"
import type { ExerciseSet } from "@/lib/types"

it("suggests Back-off weight only from the preceding completed Top set", () => {
  const sets: ExerciseSet[] = [
    { id: "top", setNumber: 1, targetReps: 8, intensityTag: "top_set", weight: 65, completed: false },
    { id: "back", setNumber: 2, targetReps: 10, intensityTag: "back_off", weight: 50, completed: false },
    { id: "logged", setNumber: 3, targetReps: 10, intensityTag: "back_off", completed: true },
  ]
  expect(backoffWeightSuggestions(sets, "kg").size).toBe(0)
  expect(backoffWeightSuggestions([{ ...sets[0], completed: true }, ...sets.slice(1)], "kg")).toEqual(new Map([["back", 55]]))
  expect(backoffWeightSuggestions([{ ...sets[0], completed: true, weight: 10 }, ...sets.slice(1)], "kg")).toEqual(new Map([["back", 5]]))
  expect(backoffWeightSuggestions([{ ...sets[0], completed: true, weight: 5 }, ...sets.slice(1)], "kg").size).toBe(0)
})
