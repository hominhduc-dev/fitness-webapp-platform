import {
  batchUpdateSpreadsheet,
  createSpreadsheet,
  extractDriveFolderId,
  findOrCreateDriveFolder,
  moveFileToFolder,
  updateSpreadsheetValues,
} from "../lib/google"
import { BadRequestError } from "./errors"
import { getGoogleAccessToken } from "./google-connection.service"
import { assertCoach, ensurePrisma } from "./fitness-data/shared/guards"
import { listExerciseLibrary } from "./fitness-data/core"
import { SET_INTENSITY_METHOD_CHOICES } from "../domain/set-intensity-tag"
import type { SerializedProfile } from "./auth.service"

/**
 * Creates the coach program template straight in the coach's Google Drive.
 *
 * The alternative is downloading the .xlsx and letting Drive convert it, which
 * silently drops the exercise dropdown — the one control that stops a coach
 * mistyping a name the importer then cannot resolve. Building the sheet through
 * the API sets that validation explicitly, so it survives.
 *
 * The grid must stay byte-compatible with `parseGoogleProgramRows`: the header
 * row is located by `Day` in column A and `Exercise` in column C, and the parser
 * then asserts `Sets`, `Rep Range` and `Substitute Exercise` sit at fixed offsets
 * with `RIR` no earlier than column O. Reorder these headers and every existing
 * sheet stops importing.
 */

/** Where templates go when the coach does not nominate a folder. */
const DEFAULT_FOLDER_NAME = "YeahBuddy program templates"

const WEEK_SHEET_TITLE = "Week 1"
const PROGRAM_SHEET_TITLE = "Program"
const INSTRUCTIONS_SHEET_TITLE = "Instructions"
const REFERENCE_SHEET_TITLE = "Exercise Table"
const TRAINEES_SHEET_TITLE = "Trainees"

const WEEK_HEADERS = [
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

/** Excel character widths from the .xlsx template, converted to pixels below. */
const WEEK_COLUMN_WIDTHS = [7, 20, 44, 22, 38, 8, 12, 12, 44, 16, 16, 16, 16, 16, 8, 18, 12, 30]

const METHOD_COLUMN_INDEX = WEEK_HEADERS.indexOf("Method")

const DAYS = 6
const ROWS_PER_DAY = 8
const BANNER_ROW = 0
const HEADER_ROW = 1
const FIRST_DATA_ROW = 2
const LAST_DATA_ROW = FIRST_DATA_ROW + DAYS * ROWS_PER_DAY

const BANNER_COLOR = { blue: 0.9412, green: 0.6902, red: 0 }
const DAY_COLORS = [
  { blue: 0.3137, green: 0.6902, red: 0 },
  { blue: 0, green: 1, red: 1 },
]
const HEADER_TEXT_COLOR = { blue: 1, green: 1, red: 1 }
const HEADER_FILL_COLOR = { blue: 0.102, green: 0.102, red: 0.102 }

const INSTRUCTIONS = [
  "Coach program import template",
  "1. Fill Program metadata, then author Week 1 only. The app repeats the template for the requested weeks.",
  "2. Select Exercise from the dropdown. Muscle Group, Variation and the hidden ID are formulas.",
  "3. Fill Sets, Rep Range, Weight (kg), RIR, Rest (s) and Note. Keep prescription columns in order.",
  "3b. Method tags one set with a training method: mrm, drop, rp, cluster, failure, warmup.",
  "    Leave it blank for normal sets. 'mrm' = last set, 'all:drop' = every set,",
  "    '1:warmup,3:mrm' = those sets, '-, -, rp' = one value per set in order.",
  "4. Leave Substitute Exercise and Actual rep per weight blank; completed sessions fill these cells.",
  "5. Each trainee uses a separate spreadsheet. Export creates Week N and extra set columns when needed.",
  "6. This sheet was created by the app, so the exercise dropdowns are already in place.",
]

function toPixels(characterWidth: number) {
  return characterWidth * 7 + 5
}

/** `'Exercise Table'!$D$2:$D` style lookup against the reference sheet. */
function lookupFormula(row: number, referenceColumn: string) {
  return `=IFERROR(INDEX('${REFERENCE_SHEET_TITLE}'!$${referenceColumn}$2:$${referenceColumn},MATCH(C${row},'${REFERENCE_SHEET_TITLE}'!$D$2:$D,0)),"")`
}

function buildWeekRows() {
  const rows: Array<Array<string | number>> = []

  rows.push([WEEK_SHEET_TITLE])
  rows.push(WEEK_HEADERS)

  for (let day = 1; day <= DAYS; day += 1) {
    for (let offset = 0; offset < ROWS_PER_DAY; offset += 1) {
      // 1-indexed for the A1 references inside the formulas.
      const sheetRow = FIRST_DATA_ROW + (day - 1) * ROWS_PER_DAY + offset + 1

      rows.push([
        offset === 0 ? day : "",
        lookupFormula(sheetRow, "E"),
        "",
        lookupFormula(sheetRow, "C"),
        lookupFormula(sheetRow, "A"),
      ])
    }
  }

  return rows
}

function buildReferenceRows(
  variations: Array<{
    equipment?: string
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

function buildFormattingRequests(sheetIds: Map<string, number>) {
  const weekSheetId = sheetIds.get(WEEK_SHEET_TITLE)!
  const requests: unknown[] = []

  const headerFormat = (sheetId: number, endColumnIndex: number) => ({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: HEADER_FILL_COLOR,
          textFormat: { bold: true, fontSize: 10, foregroundColor: HEADER_TEXT_COLOR },
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
      range: { endColumnIndex, endRowIndex: 1, sheetId, startColumnIndex: 0, startRowIndex: 0 },
    },
  })

  // ── Week 1: banner, header, day blocks ────────────────────────────────────
  requests.push({
    mergeCells: {
      mergeType: "MERGE_ALL",
      range: { endColumnIndex: 3, endRowIndex: 1, sheetId: weekSheetId, startColumnIndex: 0, startRowIndex: BANNER_ROW },
    },
  })
  requests.push({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: BANNER_COLOR,
          horizontalAlignment: "CENTER",
          textFormat: { bold: true, fontSize: 14 },
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,verticalAlignment)",
      range: { endColumnIndex: 3, endRowIndex: 1, sheetId: weekSheetId, startColumnIndex: 0, startRowIndex: BANNER_ROW },
    },
  })
  requests.push({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: BANNER_COLOR,
          horizontalAlignment: "CENTER",
          textFormat: { bold: true },
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
        },
      },
      fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,verticalAlignment,wrapStrategy)",
      range: {
        endColumnIndex: WEEK_HEADERS.length,
        endRowIndex: HEADER_ROW + 1,
        sheetId: weekSheetId,
        startColumnIndex: 0,
        startRowIndex: HEADER_ROW,
      },
    },
  })
  // "Actual rep per weight" spans the set-result columns, as in the .xlsx template.
  requests.push({
    mergeCells: {
      mergeType: "MERGE_ALL",
      range: {
        endColumnIndex: 14,
        endRowIndex: HEADER_ROW + 1,
        sheetId: weekSheetId,
        startColumnIndex: 9,
        startRowIndex: HEADER_ROW,
      },
    },
  })

  for (let day = 1; day <= DAYS; day += 1) {
    const startRowIndex = FIRST_DATA_ROW + (day - 1) * ROWS_PER_DAY
    const endRowIndex = startRowIndex + ROWS_PER_DAY
    const blockRange = {
      endColumnIndex: WEEK_HEADERS.length,
      endRowIndex,
      sheetId: weekSheetId,
      startColumnIndex: 0,
      startRowIndex,
    }

    requests.push({
      mergeCells: {
        mergeType: "MERGE_COLUMNS",
        range: { ...blockRange, endColumnIndex: 1 },
      },
    })
    requests.push({
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor: DAY_COLORS[(day - 1) % DAY_COLORS.length],
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment)",
        range: blockRange,
      },
    })
    // Exercise and Variation read as text, so they stay left aligned.
    requests.push({
      repeatCell: {
        cell: { userEnteredFormat: { horizontalAlignment: "LEFT" } },
        fields: "userEnteredFormat.horizontalAlignment",
        range: { ...blockRange, endColumnIndex: 4, startColumnIndex: 1 },
      },
    })
    requests.push({
      updateBorders: {
        bottom: { color: { blue: 0, green: 0, red: 0 }, style: "SOLID_MEDIUM" },
        innerHorizontal: { style: "SOLID" },
        innerVertical: { style: "SOLID" },
        left: { color: { blue: 0, green: 0, red: 0 }, style: "SOLID_MEDIUM" },
        range: blockRange,
        right: { color: { blue: 0, green: 0, red: 0 }, style: "SOLID_MEDIUM" },
        top: { color: { blue: 0, green: 0, red: 0 }, style: "SOLID_MEDIUM" },
      },
    })
  }

  // The dropdown this whole endpoint exists for.
  requests.push({
    setDataValidation: {
      range: {
        endColumnIndex: 3,
        endRowIndex: LAST_DATA_ROW,
        sheetId: weekSheetId,
        startColumnIndex: 2,
        startRowIndex: FIRST_DATA_ROW,
      },
      rule: {
        condition: {
          type: "ONE_OF_RANGE",
          values: [{ userEnteredValue: `='${REFERENCE_SHEET_TITLE}'!$D$2:$D` }],
        },
        inputMessage: "Chọn bài tập từ thư viện.",
        showCustomUi: true,
        strict: true,
      },
    },
  })

  // Method: a picker for the two common cases, still typeable for per-set work.
  // `strict: false` is the point — a strict list would reject `1:warmup,3:mrm`,
  // which the importer understands and the Instructions sheet documents.
  requests.push({
    setDataValidation: {
      range: {
        endColumnIndex: METHOD_COLUMN_INDEX + 1,
        endRowIndex: LAST_DATA_ROW,
        sheetId: weekSheetId,
        startColumnIndex: METHOD_COLUMN_INDEX,
        startRowIndex: FIRST_DATA_ROW,
      },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: SET_INTENSITY_METHOD_CHOICES.map((choice) => ({ userEnteredValue: choice })),
        },
        inputMessage: "Chọn method cho set cuối, hoặc all: cho mọi set. Gõ tay được dạng 1:warmup,3:mrm.",
        showCustomUi: true,
        strict: false,
      },
    },
  })

  WEEK_COLUMN_WIDTHS.forEach((width, index) => {
    requests.push({
      updateDimensionProperties: {
        fields: "pixelSize",
        properties: { pixelSize: toPixels(width) },
        range: { dimension: "COLUMNS", endIndex: index + 1, sheetId: weekSheetId, startIndex: index },
      },
    })
  })

  // Column E holds the resolved variation id. It is the importer's only reliable
  // signal, so it is hidden rather than removed.
  requests.push({
    updateDimensionProperties: {
      fields: "hiddenByUser",
      properties: { hiddenByUser: true },
      range: { dimension: "COLUMNS", endIndex: 5, sheetId: weekSheetId, startIndex: 4 },
    },
  })

  // ── The supporting sheets ─────────────────────────────────────────────────
  requests.push(headerFormat(sheetIds.get(REFERENCE_SHEET_TITLE)!, 6))
  requests.push(headerFormat(sheetIds.get(TRAINEES_SHEET_TITLE)!, 2))
  requests.push(headerFormat(sheetIds.get(PROGRAM_SHEET_TITLE)!, 2))

  ;[
    [REFERENCE_SHEET_TITLE, [40, 28, 22, 36, 18, 18]],
    [TRAINEES_SHEET_TITLE, [28, 34]],
    [PROGRAM_SHEET_TITLE, [22, 70]],
    [INSTRUCTIONS_SHEET_TITLE, [110]],
  ].forEach(([title, widths]) => {
    const sheetId = sheetIds.get(title as string)!
    ;(widths as number[]).forEach((width, index) => {
      requests.push({
        updateDimensionProperties: {
          fields: "pixelSize",
          properties: { pixelSize: toPixels(width) },
          range: { dimension: "COLUMNS", endIndex: index + 1, sheetId, startIndex: index },
        },
      })
    })
  })

  requests.push({
    repeatCell: {
      cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 13 } } },
      fields: "userEnteredFormat.textFormat",
      range: {
        endRowIndex: 1,
        sheetId: sheetIds.get(INSTRUCTIONS_SHEET_TITLE)!,
        startColumnIndex: 0,
        startRowIndex: 0,
      },
    },
  })

  return requests
}

/**
 * Resolves where the new template should live.
 *
 * A coach may paste a link to one of their own folders, but `drive.file` only
 * grants this app access to files it created, so Drive answers 404 for anything
 * else and the coach needs to know why rather than seeing a bare upstream error.
 * With no folder given, the app uses a folder of its own.
 */
async function resolveTargetFolder(accessToken: string, folder: string | undefined) {
  if (!folder?.trim()) {
    return findOrCreateDriveFolder(accessToken, DEFAULT_FOLDER_NAME)
  }

  const folderId = extractDriveFolderId(folder)

  if (!folderId) {
    throw new BadRequestError("Link thư mục Google Drive không hợp lệ.", { code: "GOOGLE_FOLDER_INVALID" })
  }

  return folderId
}

async function createGoogleProgramTemplate(
  profile: SerializedProfile,
  options?: { folder?: string; title?: string },
) {
  assertCoach(profile)
  const title = options?.title

  const db = ensurePrisma()
  const accessToken = await getGoogleAccessToken(profile)
  const [library, trainees] = await Promise.all([
    listExerciseLibrary(profile),
    db.user.findMany({
      orderBy: { name: "asc" },
      select: { email: true, name: true },
      where: { coachId: profile.id, role: "trainee" },
    }),
  ])

  // Mirrors `flattenExerciseLibraryToVariationOptions` on the frontend so the
  // dropdown labels match the names the .xlsx template offers.
  const variations = library.flatMap((exercise) =>
    exercise.variations.map((variation) => ({
      equipment: variation.equipment,
      exerciseName: exercise.name,
      id: variation.id,
      muscleGroup: exercise.muscleGroup,
      name: variation.isDefault ? exercise.name : `${exercise.name} (${variation.name})`,
      variationName: variation.name,
    })),
  )
  const referenceRows = buildReferenceRows(variations)
  const spreadsheetTitle = title?.trim() || `Program template — ${profile.name}`

  const created = await createSpreadsheet(accessToken, spreadsheetTitle, [
    { properties: { gridProperties: { columnCount: 4, rowCount: 20 }, index: 0, title: PROGRAM_SHEET_TITLE } },
    {
      properties: {
        gridProperties: { columnCount: 26, frozenColumnCount: 3, frozenRowCount: 2, rowCount: 200 },
        index: 1,
        title: WEEK_SHEET_TITLE,
      },
    },
    { properties: { gridProperties: { columnCount: 2, rowCount: 40 }, index: 2, title: INSTRUCTIONS_SHEET_TITLE } },
    {
      properties: {
        gridProperties: { columnCount: 8, frozenRowCount: 1, rowCount: Math.max(50, referenceRows.length + 10) },
        index: 3,
        title: REFERENCE_SHEET_TITLE,
      },
    },
    {
      properties: {
        gridProperties: { columnCount: 4, frozenRowCount: 1, rowCount: Math.max(20, trainees.length + 10) },
        index: 4,
        title: TRAINEES_SHEET_TITLE,
      },
    },
  ])

  // Values first: merging a range and then writing into its covered cells fails.
  await updateSpreadsheetValues(accessToken, created.spreadsheetId, [
    {
      range: `'${PROGRAM_SHEET_TITLE}'!A1`,
      values: [
        ["field", "value"],
        ["name", "Sample 4-Day Strength Program"],
        ["description", "Sample schedule generated from your exercise library. Edit before importing."],
        ["duration_weeks", "8"],
        ["difficulty", "intermediate"],
        ["assign_to_emails", ""],
      ],
    },
    { range: `'${WEEK_SHEET_TITLE}'!A1`, values: buildWeekRows() },
    { range: `'${INSTRUCTIONS_SHEET_TITLE}'!A1`, values: INSTRUCTIONS.map((line) => [line]) },
    { range: `'${REFERENCE_SHEET_TITLE}'!A1`, values: referenceRows },
    {
      range: `'${TRAINEES_SHEET_TITLE}'!A1`,
      values: [["trainee_name", "email"], ...trainees.map((trainee) => [trainee.name, trainee.email])],
    },
  ])

  await batchUpdateSpreadsheet(accessToken, created.spreadsheetId, buildFormattingRequests(created.sheetIdsByTitle))

  // Filing happens last. The sheet is already complete and usable at this point,
  // so a folder the app cannot reach costs the coach a drag in Drive, not the
  // template itself.
  let folderId: string | undefined

  try {
    folderId = await resolveTargetFolder(accessToken, options?.folder)
    await moveFileToFolder(accessToken, created.spreadsheetId, folderId)
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error
    }

    throw new BadRequestError(
      `Đã tạo template nhưng không chuyển được vào thư mục đã chọn. App chỉ truy cập được thư mục do chính nó tạo, nên hãy để trống ô thư mục hoặc tự kéo file vào: ${created.spreadsheetUrl}`,
      { cause: error, code: "GOOGLE_FOLDER_UNREACHABLE" },
    )
  }

  return {
    exerciseCount: variations.length,
    folderId,
    folderName: options?.folder?.trim() ? undefined : DEFAULT_FOLDER_NAME,
    sheetName: WEEK_SHEET_TITLE,
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    title: spreadsheetTitle,
  }
}

export { createGoogleProgramTemplate }
