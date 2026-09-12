import { describe, expect, it } from "vitest"

import { buildProgramTreeCreateManyData } from "./core"

function buildRowsFor(exercise: { sets: number; setIntensityTags?: Array<{ setNumber: number; tag: "mrm" | "warmup" }> }) {
  return buildProgramTreeCreateManyData("program-1", [
    {
      exercises: [{ reps: 10, variationId: "variation-1", ...exercise }],
      name: "Day 1",
      scheduledDay: 1,
    },
  ]).setRows
}

describe("program set rows carry the coach's method tags", () => {
  it("writes the tag onto the set the coach named and leaves the rest untagged", () => {
    const setRows = buildRowsFor({ setIntensityTags: [{ setNumber: 3, tag: "mrm" }], sets: 3 })

    expect(setRows.map((row) => [row.setNumber, row.intensityTag])).toEqual([
      [1, undefined],
      [2, undefined],
      [3, "mrm"],
    ])
  })

  it("drops a tag on a set the exercise does not have", () => {
    const setRows = buildRowsFor({ setIntensityTags: [{ setNumber: 5, tag: "mrm" }], sets: 2 })

    expect(setRows.every((row) => row.intensityTag == null)).toBe(true)
  })

  it("leaves every set untagged when the coach prescribed no method", () => {
    const setRows = buildRowsFor({ sets: 2 })

    expect(setRows.every((row) => row.intensityTag == null)).toBe(true)
  })
})
