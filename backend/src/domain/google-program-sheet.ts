/**
 * The shape of a coach program sheet, shared by everything that touches one:
 * the template builder that creates it, the plan writer that fills it, the
 * importer that reads it back and the export that writes results into it.
 *
 * `parseGoogleProgramRows` locates the header row by `Day` in column A and
 * `Exercise` in column C, then asserts `Sets`, `Rep Range` and `Substitute
 * Exercise` sit at fixed offsets with `RIR` no earlier than column O. Reorder
 * these headers and every sheet already in the wild stops importing.
 */

export const WEEK_SHEET_TITLE = "Week 1"
export const REFERENCE_SHEET_TITLE = "Exercise Table"

export const WEEK_HEADERS = [
  "Day",
  "Muscle Group",
  "Exercise",
  "Variation",
  "",
  "Sets",
  "Rep Range",
  "Weight (kg)",
  "Substitute Exercise",
  "Actual rep per weight",
  "",
  "",
  "",
  "",
  "RIR",
  "Method",
  "Rest (s)",
  "Note",
]

export const METHOD_COLUMN_INDEX = WEEK_HEADERS.indexOf("Method")

export const DAYS = 6
export const ROWS_PER_DAY = 8
export const BANNER_ROW = 0
export const HEADER_ROW = 1
export const FIRST_DATA_ROW = 2
export const LAST_DATA_ROW = FIRST_DATA_ROW + DAYS * ROWS_PER_DAY

/**
 * Resolves one field of the exercise a row names, by matching its display name
 * against the reference tab. Keeping these as formulas rather than values is
 * what lets a row fill itself in when the coach picks from the dropdown.
 */
export function lookupFormula(row: number, referenceColumn: string) {
  return `=IFERROR(INDEX('${REFERENCE_SHEET_TITLE}'!$${referenceColumn}$2:$${referenceColumn},MATCH(C${row},'${REFERENCE_SHEET_TITLE}'!$D$2:$D,0)),"")`
}
