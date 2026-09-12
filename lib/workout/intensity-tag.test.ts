import { describe, expect, it } from "vitest"

import {
  INTENSITY_METHOD_CHOICES,
  normalizeSetIntensityAssignments,
  parseSetIntensityMethodCell,
  readSetIntensityAssignments,
} from "./intensity-tag"

describe("method cell parsing", () => {
  it("matches the backend mirror on every documented shape", () => {
    expect(parseSetIntensityMethodCell("", 3)).toEqual({ assignments: [] })
    expect(parseSetIntensityMethodCell("-", 3)).toEqual({ assignments: [] })
    expect(parseSetIntensityMethodCell("mrm", 3)).toEqual({ assignments: [{ setNumber: 3, tag: "mrm" }] })
    expect(parseSetIntensityMethodCell("all:drop", 2)).toEqual({
      assignments: [
        { setNumber: 1, tag: "drop_set" },
        { setNumber: 2, tag: "drop_set" },
      ],
    })
    expect(parseSetIntensityMethodCell("1:warmup,3:mrm", 3)).toEqual({
      assignments: [
        { setNumber: 1, tag: "warmup" },
        { setNumber: 3, tag: "mrm" },
      ],
    })
    expect(parseSetIntensityMethodCell("-, -, rp", 3)).toEqual({ assignments: [{ setNumber: 3, tag: "rest_pause" }] })
  })

  it("reports typos and out-of-range sets", () => {
    expect(parseSetIntensityMethodCell("myorep", 3).error).toMatch(/myorep/)
    expect(parseSetIntensityMethodCell("4:mrm", 3).error).toMatch(/1-3/)
  })
})

describe("the Method dropdown choices", () => {
  it("every choice parses, so the picker can never write something the importer rejects", () => {
    INTENSITY_METHOD_CHOICES.forEach((choice) => {
      expect(parseSetIntensityMethodCell(choice, 3).error, choice).toBeUndefined()
    })
  })

  it("offers clearing, a last-set method and an every-set method", () => {
    expect(parseSetIntensityMethodCell("-", 3).assignments).toEqual([])
    expect(parseSetIntensityMethodCell("drop", 3).assignments).toEqual([{ setNumber: 3, tag: "drop_set" }])
    expect(parseSetIntensityMethodCell("all:rp", 2).assignments).toEqual([
      { setNumber: 1, tag: "rest_pause" },
      { setNumber: 2, tag: "rest_pause" },
    ])
  })

  it("holds no commas, which Excel would read as extra list items", () => {
    INTENSITY_METHOD_CHOICES.forEach((choice) => {
      expect(choice, choice).not.toContain(",")
    })
  })
})

describe("editor round trip", () => {
  it("reads tags back off saved sets and drops those past the set count", () => {
    const sets = [
      { intensityTag: "warmup" as const, setNumber: 1 },
      { setNumber: 2 },
      { intensityTag: "mrm" as const, setNumber: 3 },
    ]

    const assignments = readSetIntensityAssignments(sets)

    expect(assignments).toEqual([
      { setNumber: 1, tag: "warmup" },
      { setNumber: 3, tag: "mrm" },
    ])
    expect(normalizeSetIntensityAssignments(assignments, 2)).toEqual([{ setNumber: 1, tag: "warmup" }])
  })
})
