import { describe, expect, it } from "vitest"

import {
  buildSetIntensityTagMap,
  normalizeSetIntensityAssignments,
  parseSetIntensityMethodCell,
  parseSetIntensityTag,
} from "./set-intensity-tag"

describe("method cell parsing", () => {
  it("treats blank, dash and 'normal' as an untagged exercise", () => {
    for (const raw of ["", "  ", "-", "—", "normal", undefined, null]) {
      expect(parseSetIntensityMethodCell(raw, 3)).toEqual({ assignments: [] })
    }
  })

  it("puts a bare method on the last set, where a finisher belongs", () => {
    expect(parseSetIntensityMethodCell("mrm", 3)).toEqual({ assignments: [{ setNumber: 3, tag: "mrm" }] })
    expect(parseSetIntensityMethodCell("Myo-Rep Match", 2)).toEqual({ assignments: [{ setNumber: 2, tag: "mrm" }] })
  })

  it("spreads 'all:' across every set", () => {
    expect(parseSetIntensityMethodCell("all:drop", 3)).toEqual({
      assignments: [
        { setNumber: 1, tag: "drop_set" },
        { setNumber: 2, tag: "drop_set" },
        { setNumber: 3, tag: "drop_set" },
      ],
    })
  })

  it("reads explicit set numbers and a positional list", () => {
    expect(parseSetIntensityMethodCell("1:warmup,3:mrm", 3)).toEqual({
      assignments: [
        { setNumber: 1, tag: "warmup" },
        { setNumber: 3, tag: "mrm" },
      ],
    })
    expect(parseSetIntensityMethodCell("-, -, rp", 3)).toEqual({ assignments: [{ setNumber: 3, tag: "rest_pause" }] })
  })

  it("reports a typo or an out-of-range set rather than dropping the coach's intent", () => {
    expect(parseSetIntensityMethodCell("myorep", 3).error).toMatch(/myorep/)
    expect(parseSetIntensityMethodCell("1:mrm,5:drop", 3).error).toMatch(/1-3/)
    expect(parseSetIntensityMethodCell("-, -, mrm, drop", 3).error).toMatch(/4 giá trị/)
    expect(parseSetIntensityMethodCell("mrm", 0).error).toBeDefined()
  })
})

describe("assignment normalisation", () => {
  it("drops sets the exercise no longer has and keeps the last write per set", () => {
    const assignments = [
      { setNumber: 1, tag: "warmup" as const },
      { setNumber: 4, tag: "mrm" as const },
      { setNumber: 1, tag: "failure" as const },
    ]

    expect(normalizeSetIntensityAssignments(assignments, 3)).toEqual([{ setNumber: 1, tag: "failure" }])
    expect(buildSetIntensityTagMap(assignments, 3).get(1)).toBe("failure")
    expect(buildSetIntensityTagMap(assignments, 3).has(4)).toBe(false)
  })
})

describe("alias resolution", () => {
  it("accepts the spellings coaches actually write", () => {
    expect(parseSetIntensityTag("Drop Set")).toBe("drop_set")
    expect(parseSetIntensityTag("rest-pause")).toBe("rest_pause")
    expect(parseSetIntensityTag("fail")).toBe("failure")
    expect(parseSetIntensityTag("warm up")).toBe("warmup")
    expect(parseSetIntensityTag("cluster")).toBe("cluster")
    expect(parseSetIntensityTag("superset")).toBeUndefined()
  })
})
