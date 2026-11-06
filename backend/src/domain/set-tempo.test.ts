import { describe, expect, it } from "vitest"

import {
  buildSetTempoMap,
  formatSetTempoCell,
  normalizeSetTempoAssignments,
  parseSetTempo,
  parseSetTempoCell,
  repTutSeconds,
} from "./set-tempo"

describe("repTutSeconds", () => {
  it("adds the four phases up", () => {
    expect(repTutSeconds("2-0-1-0")).toBe(3)
    expect(repTutSeconds("4-1-1-0")).toBe(6)
    expect(repTutSeconds("10-0-1-0")).toBe(11)
  })

  it("counts an explosive concentric as a second rather than as free", () => {
    expect(repTutSeconds("3-0-X-0")).toBe(4)
    expect(repTutSeconds("3-0-X-0")).toBe(repTutSeconds("3-0-1-0"))
  })

  it("has no answer for a cadence it cannot read", () => {
    expect(repTutSeconds("3-1-1")).toBeUndefined()
    expect(repTutSeconds(null)).toBeUndefined()
  })
})

describe("parseSetTempo", () => {
  it("reads the spellings coaches write and returns one canonical form", () => {
    for (const written of ["3110", "3-1-1-0", "3 1 1 0", "3/1/1/0", " 3-1-1-0 "]) {
      expect(parseSetTempo(written)).toBe("3-1-1-0")
    }
  })

  it("keeps an explosive concentric, and only in the concentric", () => {
    expect(parseSetTempo("30X0")).toBe("3-0-X-0")
    expect(parseSetTempo("3-0-x-0")).toBe("3-0-X-0")
    expect(parseSetTempo("X-0-1-0")).toBeUndefined()
    expect(parseSetTempo("3-0-1-X")).toBeUndefined()
  })

  it("reads a phase longer than one digit only when the phases are separated", () => {
    expect(parseSetTempo("10-0-1-0")).toBe("10-0-1-0")
    // 31010 could be 3-10-1-0 or 3-1-0-10; refusing it beats guessing.
    expect(parseSetTempo("31010")).toBeUndefined()
  })

  it("refuses anything that is not four phases", () => {
    for (const written of ["3-1-1", "3-1-1-0-2", "311", "abc", "", "-", "normal", "3-1-1-99"]) {
      expect(parseSetTempo(written)).toBeUndefined()
    }
  })
})

describe("parseSetTempoCell", () => {
  it("treats a lone cadence as the whole exercise, not one set", () => {
    // Unlike a method, tempo describes how the reps are done, so a coach who
    // writes one cadence means all of them.
    expect(parseSetTempoCell("3-1-1-0", 3).assignments).toEqual([
      { setNumber: 1, tempo: "3-1-1-0" },
      { setNumber: 2, tempo: "3-1-1-0" },
      { setNumber: 3, tempo: "3-1-1-0" },
    ])
  })

  it("reads a top set and its back-off as different cadences", () => {
    expect(parseSetTempoCell("1:2-0-1-0,2:4-1-1-0", 2).assignments).toEqual([
      { setNumber: 1, tempo: "2-0-1-0" },
      { setNumber: 2, tempo: "4-1-1-0" },
    ])
  })

  it("reads bare cadences in set order, and all: for every set", () => {
    expect(parseSetTempoCell("2-0-1-0, 4-1-1-0", 3).assignments).toEqual([
      { setNumber: 1, tempo: "2-0-1-0" },
      { setNumber: 2, tempo: "4-1-1-0" },
    ])
    expect(parseSetTempoCell("all:3-1-1-0", 2).assignments).toEqual([
      { setNumber: 1, tempo: "3-1-1-0" },
      { setNumber: 2, tempo: "3-1-1-0" },
    ])
  })

  it("reads an empty cell as no tempo at all", () => {
    for (const written of ["", "  ", "-", "normal", "n/a"]) {
      expect(parseSetTempoCell(written, 3).assignments).toEqual([])
    }
  })

  it("reports a typo rather than dropping what the coach asked for", () => {
    expect(parseSetTempoCell("3-1-1", 3).error).toMatch(/Tempo/)
    expect(parseSetTempoCell("1:3-1-1-0,9:2-0-1-0", 3).error).toMatch(/ngoài phạm vi/)
    expect(parseSetTempoCell("a,b,c,d", 3).error).toMatch(/4 giá trị/)
    expect(parseSetTempoCell("3-1-1-0", 0).error).toMatch(/Sets/)
  })
})

describe("writing tempo back", () => {
  it("round-trips a cell through parse and format", () => {
    for (const [cell, setCount] of [["all:3-1-1-0", 3], ["1:2-0-1-0,2:4-1-1-0", 2]] as const) {
      const parsed = parseSetTempoCell(cell, setCount)
      expect(formatSetTempoCell(parsed.assignments, setCount)).toBe(cell)
    }
  })

  it("collapses to all: only when every set really shares the cadence", () => {
    const assignments = [{ setNumber: 1, tempo: "3-1-1-0" }, { setNumber: 2, tempo: "3-1-1-0" }]

    expect(formatSetTempoCell(assignments, 2)).toBe("all:3-1-1-0")
    // The third set has none, so the cell must stay explicit about which do.
    expect(formatSetTempoCell(assignments, 3)).toBe("1:3-1-1-0,2:3-1-1-0")
    expect(formatSetTempoCell([], 3)).toBe("")
  })

  it("drops assignments the exercise has no set for, keeping the last write", () => {
    const assignments = [
      { setNumber: 1, tempo: "3-1-1-0" },
      { setNumber: 1, tempo: "2-0-1-0" },
      { setNumber: 4, tempo: "4-1-1-0" },
      { setNumber: 0, tempo: "3-1-1-0" },
      { setNumber: 2, tempo: "nonsense" },
    ]

    expect(normalizeSetTempoAssignments(assignments, 2)).toEqual([{ setNumber: 1, tempo: "2-0-1-0" }])
    expect(buildSetTempoMap(assignments, 2).get(1)).toBe("2-0-1-0")
  })
})
