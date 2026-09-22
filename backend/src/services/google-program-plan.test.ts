import { describe, expect, it } from "vitest"
import {
  BANNER_ROW,
  FIRST_DATA_ROW,
  lookupFormula,
  ROWS_PER_DAY,
  WEEK_HEADERS,
} from "../domain/google-program-sheet"
import { buildProgramPlanRequests, findAmbiguousDisplayNames, type PlanExercise } from "./google-program-plan.service"

const SHEET_ID = 42
const PLAN_START = WEEK_HEADERS.indexOf("Muscle Group")
const TAIL_START = WEEK_HEADERS.indexOf("RIR")
/** The variation id column is positional — its header is intentionally empty. */
const VARIATION_ID_COLUMN = WEEK_HEADERS.indexOf("Variation") + 1

type CellValue = { formulaValue?: string; numberValue?: number; stringValue?: string }
type Cell = { userEnteredValue?: CellValue }
type UpdateCells = {
  updateCells?: {
    fields: string
    rows: Array<{ values: Cell[] }>
    start: { columnIndex: number; rowIndex: number; sheetId: number }
  }
}
type InsertDimension = {
  insertDimension?: {
    inheritFromBefore: boolean
    range: { dimension: string; endIndex: number; sheetId: number; startIndex: number }
  }
}

const exercise = (overrides: Partial<PlanExercise> = {}): PlanExercise => ({
  displayName: "Bench Press",
  muscleGroup: "Chest",
  variationId: "var-1",
  variationName: "Barbell",
  ...overrides,
})

const writesAt = (requests: unknown[], columnIndex: number) =>
  (requests as UpdateCells[]).filter((request) => request.updateCells?.start.columnIndex === columnIndex)

const inserts = (requests: unknown[]) => (requests as InsertDimension[]).filter((request) => request.insertDimension)

/** Reads a cell by its header, so a column move breaks the assertion honestly. */
const cellAt = (values: Cell[], startColumn: number, column: number) => values[column - startColumn]

describe("buildProgramPlanRequests", () => {
  it("writes each planned field into the column the importer reads it back from", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [
      {
        day: 1,
        exercises: [
          exercise({ method: "Drop set", notes: "Nhẹ tay", reps: "8-12", restTime: 90, rir: 2, sets: 4, weight: 60 }),
        ],
      },
    ])

    const plan = writesAt(requests, PLAN_START)[0].updateCells!.rows[0].values
    const planCell = (header: string) => cellAt(plan, PLAN_START, WEEK_HEADERS.indexOf(header)).userEnteredValue
    expect(planCell("Exercise")?.stringValue).toBe("Bench Press")
    expect(planCell("Sets")?.numberValue).toBe(4)
    expect(planCell("Rep Range")?.stringValue).toBe("8-12")
    expect(planCell("Weight (kg)")?.numberValue).toBe(60)

    const tail = writesAt(requests, TAIL_START)[0].updateCells!.rows[0].values
    const tailCell = (header: string) => cellAt(tail, TAIL_START, WEEK_HEADERS.indexOf(header)).userEnteredValue
    expect(tailCell("RIR")?.numberValue).toBe(2)
    expect(tailCell("Method")?.stringValue).toBe("Drop set")
    expect(tailCell("Rest (s)")?.numberValue).toBe(90)
    expect(tailCell("Note")?.stringValue).toBe("Nhẹ tay")
  })

  it("never writes over the result block the export owns", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [{ day: 1, exercises: [exercise()] }])

    for (const request of requests as UpdateCells[]) {
      const start = request.updateCells!.start.columnIndex
      const end = start + request.updateCells!.rows[0].values.length - 1
      const substitute = WEEK_HEADERS.indexOf("Substitute Exercise")
      expect(start > substitute || end < substitute).toBe(true)
    }
  })

  it("keeps the lookup formulas, aimed at the row each one sits on", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [{ day: 2, exercises: [exercise()] }])
    const write = writesAt(requests, PLAN_START)[0].updateCells!

    // Day 2 starts one block below day 1; the formula's row reference is 1-indexed.
    expect(write.start.rowIndex).toBe(FIRST_DATA_ROW + ROWS_PER_DAY)
    const sheetRow = FIRST_DATA_ROW + ROWS_PER_DAY + 1
    const cell = (column: number) => cellAt(write.rows[0].values, PLAN_START, column).userEnteredValue

    expect(cell(WEEK_HEADERS.indexOf("Muscle Group"))?.formulaValue).toBe(lookupFormula(sheetRow, "E"))
    expect(cell(WEEK_HEADERS.indexOf("Variation"))?.formulaValue).toBe(lookupFormula(sheetRow, "C"))
    expect(cell(VARIATION_ID_COLUMN)?.formulaValue).toBe(lookupFormula(sheetRow, "A"))
  })

  it("writes resolved values instead of a lookup when two variations share a display name", () => {
    // MATCH would return whichever of the two sits first in the reference tab, so
    // the row would silently carry the wrong variation id into every later export.
    const requests = buildProgramPlanRequests(
      SHEET_ID,
      [{ day: 1, exercises: [exercise({ displayName: "Row", variationId: "var-9", variationName: "Cable" })] }],
      { ambiguousDisplayNames: new Set(["Row"]) },
    )

    const values = writesAt(requests, PLAN_START)[0].updateCells!.rows[0].values
    const id = cellAt(values, PLAN_START, VARIATION_ID_COLUMN).userEnteredValue
    expect(id?.stringValue).toBe("var-9")
    expect(id?.formulaValue).toBeUndefined()
    expect(cellAt(values, PLAN_START, WEEK_HEADERS.indexOf("Variation")).userEnteredValue?.stringValue).toBe("Cable")
    expect(cellAt(values, PLAN_START, WEEK_HEADERS.indexOf("Muscle Group")).userEnteredValue?.stringValue).toBe("Chest")
  })

  it("grows a day past the template's eight rows and pushes the later days down", () => {
    const nine = Array.from({ length: 9 }, (_, index) =>
      exercise({ displayName: `Ex ${index}`, variationId: `var-${index}` }),
    )
    const requests = buildProgramPlanRequests(SHEET_ID, [
      { day: 1, exercises: nine },
      { day: 2, exercises: [exercise()] },
    ])

    expect(inserts(requests)[0].insertDimension!.range).toMatchObject({
      endIndex: FIRST_DATA_ROW + ROWS_PER_DAY + 1,
      sheetId: SHEET_ID,
      startIndex: FIRST_DATA_ROW + ROWS_PER_DAY,
    })

    const [dayOne, dayTwo] = writesAt(requests, PLAN_START)
    expect(dayOne.updateCells!.start.rowIndex).toBe(FIRST_DATA_ROW)
    expect(dayOne.updateCells!.rows).toHaveLength(9)
    // Day 2's block sat at FIRST_DATA_ROW + 8; the inserted row moved it down one.
    expect(dayTwo.updateCells!.start.rowIndex).toBe(FIRST_DATA_ROW + ROWS_PER_DAY + 1)
  })

  it("accumulates the shift when more than one day overflows", () => {
    const ten = Array.from({ length: 10 }, () => exercise())
    const requests = buildProgramPlanRequests(SHEET_ID, [
      { day: 1, exercises: ten },
      { day: 2, exercises: ten },
      { day: 3, exercises: [exercise()] },
    ])

    // Two rows added by day 1, two more by day 2.
    const [, , dayThree] = writesAt(requests, PLAN_START)
    expect(dayThree.updateCells!.start.rowIndex).toBe(FIRST_DATA_ROW + 2 * ROWS_PER_DAY + 4)
  })

  it("inserts the new rows before writing onto them", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [
      { day: 1, exercises: Array.from({ length: 9 }, () => exercise()) },
    ])

    const insertIndex = requests.findIndex((request) => (request as InsertDimension).insertDimension)
    const writeIndex = requests.findIndex((request) => (request as UpdateCells).updateCells)
    expect(insertIndex).toBeGreaterThanOrEqual(0)
    expect(insertIndex).toBeLessThan(writeIndex)
  })

  it("leaves a rest day's blank-but-ready rows alone", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [
      { day: 1, exercises: [] },
      { day: 3, exercises: [exercise()] },
    ])

    const writes = writesAt(requests, PLAN_START)
    expect(writes).toHaveLength(1)
    expect(writes[0].updateCells!.start.rowIndex).toBe(FIRST_DATA_ROW + 2 * ROWS_PER_DAY)
  })

  it("writes the week banner when one is given", () => {
    const requests = buildProgramPlanRequests(SHEET_ID, [{ day: 1, exercises: [exercise()] }], { weekTitle: "Week 3" })
    const banner = writesAt(requests, 0)[0].updateCells!

    expect(banner.start.rowIndex).toBe(BANNER_ROW)
    expect(banner.rows[0].values[0].userEnteredValue?.stringValue).toBe("Week 3")
  })

  it("refuses a day the template has no block for", () => {
    expect(() => buildProgramPlanRequests(SHEET_ID, [{ day: 7, exercises: [exercise()] }])).toThrow(
      /6 buổi mỗi tuần/,
    )
  })
})

describe("findAmbiguousDisplayNames", () => {
  it("returns only the names more than one variation answers to", () => {
    expect(findAmbiguousDisplayNames(["Squat", "Row", "Squat", "Press", "Row"])).toEqual(new Set(["Squat", "Row"]))
  })

  it("returns nothing when every name is unique", () => {
    expect(findAmbiguousDisplayNames(["Squat", "Row"])).toEqual(new Set())
  })
})
