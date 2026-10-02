import { ROWS_PER_DAY } from "../domain/google-program-sheet"
import { BadRequestError } from "./errors"
import type { PlanDay, PlanExercise } from "./google-program-plan.service"

/**
 * Rewrites a week tab's plan to match the program in the app, before a log
 * export writes results into it.
 *
 * The app is where a coach edits a program after importing it, and the import
 * is one-way: without this, the sheet keeps the plan as it was imported and a
 * log trained against the edited program has no row to land on.
 *
 * Works from the tab as it is, not from the template's fixed grid: a coach's
 * sheet may have rows added to a day, and earlier exports insert set columns,
 * which moves RIR and everything after it. Day blocks are found by the day
 * number in column A and the tail columns by their headers.
 *
 * Returns the tab's values as they will read once the requests are applied, so
 * results can be matched against the refreshed plan in the same batch.
 */

type Cell = Record<string, unknown>

const MUSCLE_GROUP_COLUMN = 1
const EXERCISE_COLUMN = 2
const VARIATION_COLUMN = 3
const VARIATION_ID_COLUMN = 4
const SETS_COLUMN = 5
const REPS_COLUMN = 6
const WEIGHT_COLUMN = 7
const SUBSTITUTE_COLUMN = 8
const DEFAULT_RIR_COLUMN = 14

const textCell = (value: string | undefined): Cell =>
  value?.trim() ? { userEnteredValue: { stringValue: value.trim() } } : {}

const numberCell = (value: number | undefined): Cell =>
  typeof value === "number" && Number.isFinite(value) ? { userEnteredValue: { numberValue: value } } : {}

const shown = (value: string | number | undefined) => (value == null ? "" : String(value).trim())

/** Any planned content past column A, which only carries the day number. */
function hasPlanContent(row: readonly string[] | undefined) {
  return Boolean(row?.slice(1).some((cell) => cell?.trim()))
}

function ensureHeaderColumn(
  next: string[][],
  requests: unknown[],
  sheetId: number,
  headerIndex: number,
  headerName: string,
  options: { after?: string; fallbackIndex: number },
) {
  const header = next[headerIndex]
  const existing = header.indexOf(headerName)
  if (existing >= 0) return existing

  const afterIndex = options.after ? header.indexOf(options.after) : -1
  const insertAt = afterIndex >= 0 ? afterIndex + 1 : Math.min(options.fallbackIndex, header.length)
  requests.push({ insertDimension: {
    inheritFromBefore: true,
    range: { dimension: "COLUMNS", endIndex: insertAt + 1, sheetId, startIndex: insertAt },
  } })

  for (const row of next) {
    row.splice(insertAt, 0, "")
  }
  next[headerIndex][insertAt] = headerName
  requests.push({ updateCells: {
    fields: "userEnteredValue",
    rows: [{ values: [textCell(headerName)] }],
    start: { columnIndex: insertAt, rowIndex: headerIndex, sheetId },
  } })

  return insertAt
}

export function refreshWeekPlan(
  values: readonly (readonly string[])[],
  sheetId: number,
  gridRowCount: number,
  days: readonly PlanDay[],
  weekTitle?: string,
) {
  const headerIndex = values.findIndex((row) => row[0]?.trim() === "Day" && row[2]?.trim() === "Exercise")
  if (headerIndex < 0) throw new BadRequestError("Không tìm thấy bảng Day / Exercise trong sheet.")

  const next = values.map((row) => [...row])
  const requests: unknown[] = []
  const rirColumn = ensureHeaderColumn(next, requests, sheetId, headerIndex, "RIR", { fallbackIndex: DEFAULT_RIR_COLUMN })
  const methodColumn = ensureHeaderColumn(next, requests, sheetId, headerIndex, "Method", { after: "RIR", fallbackIndex: rirColumn + 1 })
  const restColumn = ensureHeaderColumn(next, requests, sheetId, headerIndex, "Rest (s)", { after: "Method", fallbackIndex: methodColumn + 1 })
  const noteColumn = ensureHeaderColumn(next, requests, sheetId, headerIndex, "Note", { after: "Rest (s)", fallbackIndex: restColumn + 1 })
  const lastColumn = Math.max(rirColumn, methodColumn, restColumn, noteColumn)

  if (weekTitle && /^Week\s*\d+$/i.test(next[0]?.[0]?.trim() ?? "")) {
    next[0][0] = weekTitle
    requests.push({ updateCells: { fields: "userEnteredValue", rows: [{ values: [textCell(weekTitle)] }], start: { columnIndex: 0, rowIndex: 0, sheetId } } })
  }

  const markers = next.flatMap((row, index) => {
    if (index <= headerIndex) return []
    const day = Number(row[0]?.trim())
    return row[0]?.trim() && Number.isInteger(day) ? [{ day, row: index }] : []
  })
  const planByDay = new Map(days.map((entry) => [entry.day, entry.exercises]))
  for (const { day } of days) {
    if (!markers.some((marker) => marker.day === day)) {
      throw new BadRequestError(`Sheet không có khối Day ${day} để ghi buổi tập của chương trình.`)
    }
  }

  let rowCount = Math.max(gridRowCount, next.length)
  let inserted = 0

  markers.forEach((marker, index) => {
    const start = marker.row + inserted
    const originalEnd = index + 1 < markers.length
      ? markers[index + 1].row
      : Math.min(Math.max(values.length, marker.row + ROWS_PER_DAY), gridRowCount)
    let capacity = originalEnd - marker.row
    const exercises: readonly PlanExercise[] = planByDay.get(marker.day) ?? []

    if (exercises.length > capacity) {
      const extra = exercises.length - capacity
      requests.push({ insertDimension: { inheritFromBefore: true, range: { dimension: "ROWS", endIndex: start + capacity + extra, sheetId, startIndex: start + capacity } } })
      next.splice(start + capacity, 0, ...Array.from({ length: extra }, () => [] as string[]))
      inserted += extra
      rowCount += extra
      capacity = exercises.length
    }

    exercises.forEach((exercise, offset) => {
      const rowIndex = start + offset
      const row = next[rowIndex] ?? (next[rowIndex] = [])
      // Results already exported for this row stay only while it is still the
      // same exercise; under a different one they would be misattributed.
      const keepResults = row[VARIATION_ID_COLUMN]?.trim() === exercise.variationId

      requests.push({ updateCells: {
        fields: "userEnteredValue",
        rows: [{ values: [
          textCell(exercise.muscleGroup),
          textCell(exercise.displayName),
          textCell(exercise.variationName),
          textCell(exercise.variationId),
          numberCell(exercise.sets),
          textCell(exercise.reps),
          numberCell(exercise.weight),
        ] }],
        start: { columnIndex: MUSCLE_GROUP_COLUMN, rowIndex, sheetId },
      } })
      row[MUSCLE_GROUP_COLUMN] = shown(exercise.muscleGroup)
      row[EXERCISE_COLUMN] = shown(exercise.displayName)
      row[VARIATION_COLUMN] = shown(exercise.variationName)
      row[VARIATION_ID_COLUMN] = exercise.variationId
      row[SETS_COLUMN] = shown(exercise.sets)
      row[REPS_COLUMN] = shown(exercise.reps)
      row[WEIGHT_COLUMN] = shown(exercise.weight)

      if (!keepResults) {
        requests.push({ updateCells: {
          fields: "userEnteredValue",
          rows: [{ values: Array.from({ length: rirColumn - SUBSTITUTE_COLUMN }, () => ({})) }],
          start: { columnIndex: SUBSTITUTE_COLUMN, rowIndex, sheetId },
        } })
        for (let column = SUBSTITUTE_COLUMN; column < rirColumn; column += 1) row[column] = ""
      }

      const tail: Cell[] = Array.from({ length: lastColumn - rirColumn + 1 }, () => ({}))
      const put = (column: number, cell: Cell, value: string | number | undefined) => {
        if (column < 0) return
        tail[column - rirColumn] = cell
        row[column] = shown(value)
      }
      put(rirColumn, numberCell(exercise.rir), exercise.rir)
      put(methodColumn, textCell(exercise.method), exercise.method)
      put(restColumn, numberCell(exercise.restTime), exercise.restTime)
      put(noteColumn, textCell(exercise.notes), exercise.notes)
      requests.push({ updateCells: { fields: "userEnteredValue", rows: [{ values: tail }], start: { columnIndex: rirColumn, rowIndex, sheetId } } })
    })

    // Rows the app's plan no longer has: cleared rather than left to be read
    // back as exercises that are not in the program.
    for (let offset = exercises.length; offset < capacity; offset += 1) {
      const rowIndex = start + offset
      if (!hasPlanContent(next[rowIndex])) continue
      requests.push({ repeatCell: {
        cell: {},
        fields: "userEnteredValue",
        range: { endColumnIndex: lastColumn + 1, endRowIndex: rowIndex + 1, sheetId, startColumnIndex: 1, startRowIndex: rowIndex },
      } })
      next[rowIndex] = [next[rowIndex]?.[0] ?? ""]
    }
  })

  return { requests, rowCount, values: next }
}
