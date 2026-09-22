import { BadRequestError } from "./errors"
import {
  BANNER_ROW,
  DAYS,
  FIRST_DATA_ROW,
  lookupFormula,
  ROWS_PER_DAY,
  WEEK_HEADERS,
} from "../domain/google-program-sheet"

/**
 * One planned exercise, already resolved to the names the `Exercise Table` tab
 * holds, so a row can be written without another lookup.
 */
export type PlanExercise = {
  displayName: string
  method?: string
  muscleGroup: string
  notes?: string
  reps?: string
  restTime?: number
  rir?: number
  sets?: number
  variationId: string
  variationName: string
  weight?: number
}

/** Exercises are written top to bottom in the order given, which is the order the importer reads back. */
export type PlanDay = { day: number; exercises: readonly PlanExercise[] }

const MUSCLE_GROUP_COLUMN = WEEK_HEADERS.indexOf("Muscle Group")
const EXERCISE_COLUMN = WEEK_HEADERS.indexOf("Exercise")
const VARIATION_COLUMN = WEEK_HEADERS.indexOf("Variation")
/** Positional, like the importer reads it: its header is intentionally empty. */
const VARIATION_ID_COLUMN = VARIATION_COLUMN + 1
const SETS_COLUMN = WEEK_HEADERS.indexOf("Sets")
const REPS_COLUMN = WEEK_HEADERS.indexOf("Rep Range")
const WEIGHT_COLUMN = WEEK_HEADERS.indexOf("Weight (kg)")
const RIR_COLUMN = WEEK_HEADERS.indexOf("RIR")
const METHOD_COLUMN = WEEK_HEADERS.indexOf("Method")
const REST_COLUMN = WEEK_HEADERS.indexOf("Rest (s)")
const NOTE_COLUMN = WEEK_HEADERS.indexOf("Note")

type Cell = Record<string, unknown>

/** An empty cell clears the value under `fields: "userEnteredValue"`. */
const text = (value: string | undefined): Cell =>
  value?.trim() ? { userEnteredValue: { stringValue: value.trim() } } : {}

const number = (value: number | undefined): Cell =>
  typeof value === "number" && Number.isFinite(value) ? { userEnteredValue: { numberValue: value } } : {}

const formula = (value: string): Cell => ({ userEnteredValue: { formulaValue: value } })

function fill(startColumn: number, endColumn: number, put: (set: (column: number, cell: Cell) => void) => void) {
  const cells: Cell[] = Array.from({ length: endColumn - startColumn + 1 }, () => ({}))
  put((column, cell) => {
    cells[column - startColumn] = cell
  })
  return cells
}

/**
 * Columns B–H of one planned row.
 *
 * Muscle Group, Variation and the variation id are left to the template's own
 * INDEX/MATCH formulas so the row keeps filling itself in when the coach later
 * picks a different exercise from the dropdown. That lookup matches on the
 * display name, so a name two variations share would resolve to whichever sits
 * first in the reference tab — those rows get the resolved values written out
 * instead, trading the self-filling behaviour for being right.
 */
function planRowCells(exercise: PlanExercise, sheetRow: number, ambiguous: boolean) {
  return fill(MUSCLE_GROUP_COLUMN, WEIGHT_COLUMN, (set) => {
    set(MUSCLE_GROUP_COLUMN, ambiguous ? text(exercise.muscleGroup) : formula(lookupFormula(sheetRow, "E")))
    set(EXERCISE_COLUMN, text(exercise.displayName))
    set(VARIATION_COLUMN, ambiguous ? text(exercise.variationName) : formula(lookupFormula(sheetRow, "C")))
    set(VARIATION_ID_COLUMN, ambiguous ? text(exercise.variationId) : formula(lookupFormula(sheetRow, "A")))
    set(SETS_COLUMN, number(exercise.sets))
    set(REPS_COLUMN, text(exercise.reps))
    set(WEIGHT_COLUMN, number(exercise.weight))
  })
}

/** Columns O–R, past the result block the export writes into. */
function tailRowCells(exercise: PlanExercise) {
  return fill(RIR_COLUMN, NOTE_COLUMN, (set) => {
    set(RIR_COLUMN, number(exercise.rir))
    set(METHOD_COLUMN, text(exercise.method))
    set(REST_COLUMN, number(exercise.restTime))
    set(NOTE_COLUMN, text(exercise.notes))
  })
}

/**
 * The template's grid is fixed at `DAYS` day blocks, so a program that trains
 * more days than that has nowhere to put the rest.
 *
 * Exposed separately from `buildProgramPlanRequests` so a caller that is about
 * to create a spreadsheet can find out first, rather than leaving a half-built
 * file behind when the write is refused.
 */
export function assertPlanDaysFitTemplate(days: readonly PlanDay[]) {
  for (const { day } of days) {
    if (!Number.isInteger(day) || day < 1 || day > DAYS) {
      throw new BadRequestError(
        `Template Google Sheets chỉ có ${DAYS} buổi mỗi tuần nên không đưa được buổi ${day} lên sheet. Hãy giảm còn tối đa ${DAYS} buổi/tuần.`,
      )
    }
  }
}

/**
 * Writes one week of a program into a freshly created template tab.
 *
 * The template lays out a fixed grid of `DAYS` blocks of `ROWS_PER_DAY` rows. A
 * day with more exercises than that grows its own block, which pushes every
 * later day down — `insertedRows` carries that shift forward so each block is
 * addressed at the position it will actually occupy once the batch runs.
 *
 * Rows a day does not use are left alone rather than cleared, so the template's
 * blank-but-ready rows survive for the coach to fill in by hand.
 */
export function buildProgramPlanRequests(
  sheetId: number,
  days: readonly PlanDay[],
  options?: { ambiguousDisplayNames?: ReadonlySet<string>; weekTitle?: string },
) {
  assertPlanDaysFitTemplate(days)

  const ambiguous = options?.ambiguousDisplayNames ?? new Set<string>()
  const byDay = new Map(days.map((entry) => [entry.day, entry.exercises]))
  const requests: unknown[] = []

  if (options?.weekTitle) {
    requests.push({
      updateCells: {
        fields: "userEnteredValue",
        rows: [{ values: [text(options.weekTitle)] }],
        start: { columnIndex: 0, rowIndex: BANNER_ROW, sheetId },
      },
    })
  }

  let insertedRows = 0

  for (let day = 1; day <= DAYS; day += 1) {
    const exercises = byDay.get(day) ?? []
    if (exercises.length === 0) continue

    const blockStart = FIRST_DATA_ROW + (day - 1) * ROWS_PER_DAY + insertedRows
    const overflow = exercises.length - ROWS_PER_DAY

    if (overflow > 0) {
      // `inheritFromBefore` carries this day's banding onto the new rows; it does
      // not carry the formulas, which is why every row is written with its own.
      requests.push({
        insertDimension: {
          inheritFromBefore: true,
          range: {
            dimension: "ROWS",
            endIndex: blockStart + ROWS_PER_DAY + overflow,
            sheetId,
            startIndex: blockStart + ROWS_PER_DAY,
          },
        },
      })
      insertedRows += overflow
    }

    requests.push({
      updateCells: {
        fields: "userEnteredValue",
        rows: exercises.map((exercise, index) => ({
          values: planRowCells(exercise, blockStart + index + 1, ambiguous.has(exercise.displayName)),
        })),
        start: { columnIndex: MUSCLE_GROUP_COLUMN, rowIndex: blockStart, sheetId },
      },
    })

    requests.push({
      updateCells: {
        fields: "userEnteredValue",
        rows: exercises.map((exercise) => ({ values: tailRowCells(exercise) })),
        start: { columnIndex: RIR_COLUMN, rowIndex: blockStart, sheetId },
      },
    })
  }

  return requests
}

/**
 * Display names that more than one variation answers to, so `planRowCells` knows
 * which rows cannot trust the template's lookup.
 */
export function findAmbiguousDisplayNames(displayNames: readonly string[]) {
  const seen = new Set<string>()
  const ambiguous = new Set<string>()

  for (const name of displayNames) {
    if (seen.has(name)) ambiguous.add(name)
    seen.add(name)
  }

  return ambiguous
}
