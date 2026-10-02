import { describe, expect, it, vi } from "vitest"
vi.mock("../lib/prisma", () => ({ prisma: null }))
import { parseGoogleProgramRows } from "./google-program-import.service"
import { buildGoogleResultRequests } from "./google-program-export.service"
import { refreshWeekPlan } from "./google-program-plan-refresh"
import type { PlanExercise } from "./google-program-plan.service"

// An exported tab: one set column was inserted, so RIR sits at 15, not 14.
const headers = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "", "RIR", "Method", "Rest (s)", "Note"]
const sheet = () => [
  ["Week 1"],
  headers,
  ["1", "Legs", "Leg Press", "Default", "v-press", "3", "10", "200", "", "10 × 200 kg"],
  ["", "Legs", "Deadlift", "Default", "v-dead", "3", "5", "140", "", "5 × 140 kg"],
  ["", "Legs", "Leg Curl", "Default", "v-curl-old", "3", "12", "40", "", "12 × 40 kg"],
  ["", "Legs", "Calf Raise", "Default", "v-calf", "3", "15"],
  [],
  [],
  [],
  [],
  ["2", "Chest", "Bench", "Default", "v-bench", "3", "8"],
]

const planned = (variationId: string, displayName: string, extra: Partial<PlanExercise> = {}): PlanExercise => ({
  displayName, muscleGroup: "Legs", reps: "10", sets: 3, variationId, variationName: "Default", ...extra,
})

describe("refreshWeekPlan", () => {
  const day1 = [
    planned("v-press", "Leg Press"),
    planned("v-dead", "Deadlift"),
    planned("v-curl", "lever lying leg curl", { rir: 2, notes: "Slow eccentric" }),
  ]

  it("rewrites a day to the app's plan and clears rows the plan dropped", () => {
    const { values } = refreshWeekPlan(sheet(), 7, 50, [{ day: 1, exercises: day1 }, { day: 2, exercises: [planned("v-bench", "Bench")] }])
    const rows = parseGoogleProgramRows(values)

    expect(rows.filter((row) => row.scheduledDay === 1).map((row) => [row.order, row.variationId])).toEqual([
      [1, "v-press"], [2, "v-dead"], [3, "v-curl"],
    ])
    // The RIR, note and results land in this tab's own columns, wherever they moved to.
    expect(values[4][15]).toBe("2")
    expect(values[4][18]).toBe("Slow eccentric")
    // Calf Raise is gone from the plan, so its row is gone from the sheet.
    expect(values[5].slice(1).some(Boolean)).toBe(false)
  })

  it("keeps results on rows that still plan the same exercise and clears the rest", () => {
    const { values } = refreshWeekPlan(sheet(), 7, 50, [{ day: 1, exercises: day1 }])

    expect(values[2][9]).toBe("10 × 200 kg")
    expect(values[3][9]).toBe("5 × 140 kg")
    expect(values[4][9]).toBe("")
  })

  it("grows a day that now has more exercises than its block, shifting later days", () => {
    const eight = Array.from({ length: 10 }, (_, index) => planned(`v-${index}`, `Exercise ${index}`))
    const result = refreshWeekPlan(sheet(), 7, 50, [{ day: 1, exercises: eight }, { day: 2, exercises: [planned("v-bench", "Bench")] }])

    expect(result.requests).toContainEqual({ insertDimension: { inheritFromBefore: true, range: { dimension: "ROWS", endIndex: 12, sheetId: 7, startIndex: 10 } } })
    expect(result.rowCount).toBe(52)
    const rows = parseGoogleProgramRows(result.values)
    expect(rows.filter((row) => row.scheduledDay === 1)).toHaveLength(10)
    expect(rows.find((row) => row.scheduledDay === 2)).toMatchObject({ order: 1, sourceRow: 13, variationId: "v-bench" })
  })

  it("refuses a day the sheet has no block for", () => {
    expect(() => refreshWeekPlan(sheet(), 7, 50, [{ day: 5, exercises: [planned("v", "X")] }])).toThrow(/Day 5/)
  })

  it("adds missing prescription tail columns on older sheets", () => {
    const legacyHeaders = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Rest (s)", "Note"]
    const legacySheet = [
      ["Week 1"],
      legacyHeaders,
      ["1", "Legs", "Leg Press", "Default", "v-press", "3", "10", "200"],
    ]

    const result = refreshWeekPlan(legacySheet, 7, 50, [{
      day: 1,
      exercises: [planned("v-press", "Leg Press", { method: "3:mrm", restTime: 90, rir: 2 })],
    }])

    expect(result.values[1].slice(14, 18)).toEqual(["RIR", "Method", "Rest (s)", "Note"])
    expect(result.values[2].slice(14, 17)).toEqual(["2", "3:mrm", "90"])
    expect(result.requests).toContainEqual({
      insertDimension: {
        inheritFromBefore: true,
        range: { dimension: "COLUMNS", endIndex: 16, sheetId: 7, startIndex: 15 },
      },
    })
  })
})

describe("results against a refreshed plan", () => {
  const set = { setNumber: 1, completed: true, actualReps: 10, intensityTag: "mrm", rir: 1, weight: 40 }

  it("places an exercise the coach has since replaced on its row, naming what was trained", () => {
    const { values } = refreshWeekPlan(sheet(), 7, 50, [{ day: 1, exercises: [
      planned("v-press", "Leg Press"), planned("v-dead", "Deadlift"), planned("v-curl", "lever lying leg curl"),
    ] }])
    const session = { day: 1, week: 0, exercises: [
      // Trained before the coach changed exercise 3.
      { order: 3, variation: { id: "v-curl-old", name: "Default" }, exercise: { name: "Leg Curl" }, sets: [set] },
      // Trained before the coach moved Deadlift; it is found by exercise, not position.
      { order: 1, variation: { id: "v-dead", name: "Default" }, exercise: { name: "Deadlift" }, sets: [set] },
      // Nothing on the day is left for it.
      { order: 9, variation: { id: "v-extra", name: "Default" }, exercise: { name: "Extra" }, sets: [set] },
    ] }

    const result = buildGoogleResultRequests(values, [session], 7, 50, false, false, true)

    expect(result).toMatchObject({ rowCount: 2, skippedExerciseCount: 1 })
    const writes = result.requests.map((request) => (request as { updateCells: { start: { columnIndex?: number; rowIndex: number }; rows: Array<{ values: Array<{ userEnteredValue?: { numberValue?: number; stringValue?: string } }> }> } }).updateCells)
    const resultWrites = writes.filter((write) => write.start.columnIndex === 8)
    expect(writes.map((write) => [write.start.rowIndex, write.rows[0].values[0].userEnteredValue?.stringValue])).toEqual([
      [4, "Leg Curl / Default"],
      [4, undefined],
      [3, undefined],
      [3, undefined],
    ])
    expect(resultWrites.map((write) => [write.start.rowIndex, write.rows[0].values[0].userEnteredValue?.stringValue])).toEqual([
      [4, "Leg Curl / Default"],
      [3, undefined],
    ])
    const tailWrite = writes.find((write) => write.start.columnIndex === 15 && write.start.rowIndex === 4)
    expect(tailWrite?.rows[0].values[0].userEnteredValue?.numberValue).toBe(1)
    expect(tailWrite?.rows[0].values[1].userEnteredValue?.stringValue).toBe("all:mrm")
  })

  it("still refuses two logs of the same day in one week", () => {
    const session = { day: 1, week: 0, exercises: [] }
    expect(() => buildGoogleResultRequests(sheet(), [session, session], 7, 50, false, false, true)).toThrow(/nhiều log/)
  })
})
