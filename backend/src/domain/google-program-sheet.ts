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

/**
 * The reference tab every week grid resolves its rows against. Column D holds
 * the display name the lookups match on, so its order here is load-bearing.
 *
 * Sorted by muscle group, then exercise, then variation: it doubles as the
 * dropdown a coach picks from, and an unsorted one is unusable at library size.
 */
export function buildReferenceRows(
  variations: Array<{
    equipment?: string | null
    exerciseName: string
    id: string
    muscleGroup: string
    name: string
    variationName: string
  }>,
) {
  const sorted = [...variations].sort(
    (left, right) =>
      left.muscleGroup.localeCompare(right.muscleGroup, undefined, { sensitivity: "base" }) ||
      left.exerciseName.localeCompare(right.exerciseName, undefined, { sensitivity: "base" }) ||
      left.variationName.localeCompare(right.variationName, undefined, { sensitivity: "base" }),
  )

  return [
    ["variation_id", "exercise_name", "variation_name", "display_name", "muscle_group", "equipment"],
    ...sorted.map((variation) => [
      variation.id,
      variation.exerciseName,
      variation.variationName,
      variation.name,
      variation.muscleGroup,
      variation.equipment ?? "",
    ]),
  ]
}
