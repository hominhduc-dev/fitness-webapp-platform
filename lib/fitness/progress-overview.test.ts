import { describe, expect, it } from "vitest"

import {
  buildConsistencyGrid,
  buildInsightFacts,
  buildStrengthCards,
  rollingAverage,
  seriesChangePct,
  sparklinePath,
} from "./progress-overview"

describe("consistency grid", () => {
  // Thursday 1 Oct 2026; its week starts Monday 28 Sep.
  const today = new Date(2026, 9, 1, 9)

  it("lays out Monday-first weeks ending on the current one, with future days marked", () => {
    const grid = buildConsistencyGrid([], today, 2)

    expect(grid.columns).toHaveLength(2)
    expect(grid.columns[0][0].date).toBe("2026-09-21")
    expect(grid.columns[1][6].date).toBe("2026-10-04")
    expect(grid.columns[1][3]).toMatchObject({ date: "2026-10-01", isFuture: false })
    expect(grid.columns[1][4]).toMatchObject({ date: "2026-10-02", isFuture: true })
  })

  it("shades training days by volume quartile and counts the week streak", () => {
    const grid = buildConsistencyGrid(
      [
        { count: 1, date: "2026-09-14", volume: 1000 },
        { count: 1, date: "2026-09-22", volume: 4000 },
        { count: 1, date: "2026-09-24", volume: 8000 },
        { count: 1, date: "2026-09-29", volume: 12000 },
      ],
      today,
      3,
    )
    const levels = grid.columns.flat().filter((cell) => cell.count > 0).map((cell) => cell.level)

    expect(levels).toEqual([1, 2, 3, 4])
    expect(grid.activeDays).toBe(4)
    expect(grid.weekStreak).toBe(3)
  })

  it("keeps the streak alive through a current week not trained yet", () => {
    const grid = buildConsistencyGrid([{ count: 1, date: "2026-09-22", volume: 1 }], today, 3)
    expect(grid.weekStreak).toBe(1)
  })
})

describe("strength cards", () => {
  it("reads each lift's series, its change and whether it set a PR", () => {
    const cards = buildStrengthCards(
      {
        points: [
          { label: "W1", values: { bench: 100, squat: null } },
          { label: "W2", values: { bench: 105, squat: 140 } },
          { label: "W3", values: { bench: 110, squat: 140 } },
        ],
        series: [{ exerciseName: "Bench", key: "bench" }, { exerciseName: "Squat", key: "squat" }],
      },
      ["Bench"],
    )

    expect(cards).toEqual([
      { changePct: 10, current: 110, exerciseName: "Bench", hasRecentPR: true, key: "bench", values: [100, 105, 110] },
      { changePct: 0, current: 140, exerciseName: "Squat", hasRecentPR: false, key: "squat", values: [140, 140] },
    ])
  })
})

describe("chart helpers", () => {
  it("draws a sparkline across the box and centres a flat one", () => {
    expect(sparklinePath([0, 10], 100, 20)).toBe("M0.0,18.0 L100.0,2.0")
    expect(sparklinePath([5, 5, 5], 100, 20)).toBe("M0.0,10.0 L50.0,10.0 L100.0,10.0")
    expect(sparklinePath([], 100, 20)).toBe("")
  })

  it("computes a period change only from real points", () => {
    expect(seriesChangePct([0, 100, 150])).toBe(50)
    expect(seriesChangePct([0, 0])).toBeNull()
    expect(seriesChangePct([100])).toBeNull()
  })

  it("smooths daily weights with a trailing seven-day mean", () => {
    const day = (offset: number) => new Date(2026, 8, 1 + offset)
    const smoothed = rollingAverage([
      { date: day(0), value: 80 },
      { date: day(1), value: 81 },
      { date: day(8), value: 79 },
    ])

    expect(smoothed.map((point) => point.average)).toEqual([80, 80.5, 79])
  })
})

describe("insight facts", () => {
  it("picks the lift that improved most and counts muscles still to adjust", () => {
    const facts = buildInsightFacts({
      muscles: [
        { recommendation: { action: "decrease" } },
        { recommendation: { action: "increase", status: "dismissed" } },
        { recommendation: { action: "maintain" } },
      ],
      plannedThisWeek: 4,
      sessionsThisWeek: 3,
      strength: [
        { changePct: 2, current: 100, exerciseName: "Bench", hasRecentPR: false, key: "b", values: [] },
        { changePct: 5, current: 140, exerciseName: "Squat", hasRecentPR: false, key: "s", values: [] },
        { changePct: -1, current: 60, exerciseName: "OHP", hasRecentPR: false, key: "o", values: [] },
      ],
      weightRatePerWeekKg: -0.4,
    })

    expect(facts).toEqual({
      musclesToAdjust: 1,
      plannedThisWeek: 4,
      sessionsThisWeek: 3,
      strongestLift: { changePct: 5, name: "Squat" },
      weightRatePerWeekKg: -0.4,
    })
  })
})
