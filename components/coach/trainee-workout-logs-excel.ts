import type { Cell, Worksheet } from "exceljs"

import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import type { WorkoutLog } from "@/lib/types"
import { formatRepTarget } from "@/lib/workout-reps"

type DownloadCoachWorkoutLogsWorkbookOptions = {
  traineeId: string
  traineeName?: string
  weekStart: string
}

type CoachWorkoutLogsWorkbookFile = {
  buffer: ArrayBuffer
  fileName: string
}

type CoachWorkoutLogsWorkbookPreview = CoachWorkoutLogsWorkbookFile & {
  sheets: Array<{
    html: string
    name: string
  }>
}

type ReportRow = {
  completedSets: number
  dayNumber: number
  exerciseName: string
  isFirstRowInDay: boolean
  muscleGroup: string
  note: string
  repCells: Array<number | null>
  rirSummary: string
  targetSummary: string
  variationName: string
  weightSummary: string
}

type DayMergeRange = {
  dayNumber: number
  endRow: number
  startRow: number
}

type TemplateStyles = {
  continuationDataHeight?: number
  continuationDataStyles: Record<number, Partial<Cell["style"]>>
  firstDataHeight?: number
  firstDataStyles: Record<number, Partial<Cell["style"]>>
  summaryHeaderStyles: Record<number, Partial<Cell["style"]>>
  summaryItemStyles: Record<number, Partial<Cell["style"]>>
  summaryTotalStyles: Record<number, Partial<Cell["style"]>>
}

const TEMPLATE_URL = "/templates/trainee-weekly-report-template.xlsx"
const TEMPLATE_MERGES = ["A5:A12", "A13:A20", "A21:A28", "A29:A36", "A37:A44", "A45:A51"]
const REPORT_START_ROW = 5
const DATA_END_COLUMN = 15
const SUMMARY_LABEL_COLUMN = 18
const SUMMARY_VALUE_COLUMN = 19
const SUMMARY_HEADER_ROW = 5
const SUMMARY_ITEM_START_ROW = 6
const SUMMARY_TOTAL_ROW = 18
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function cloneStyle(style: Partial<Cell["style"]>) {
  return JSON.parse(JSON.stringify(style ?? {})) as Partial<Cell["style"]>
}

function sanitizeFileNameSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function parseDateInputAsLocalDate(value: string, hour = 0) {
  const match = DATE_INPUT_PATTERN.exec(value.trim())

  if (!match) {
    return undefined
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(year, month - 1, day, hour, 0, 0, 0)

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return parsedDate
}

function startOfLocalWeek(date: Date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)

  const day = nextDate.getDay()
  const offset = day === 0 ? -6 : 1 - day
  nextDate.setDate(nextDate.getDate() + offset)
  return nextDate
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatWeekTitle(weekStart: string) {
  const start = parseDateInputAsLocalDate(weekStart, 12)

  if (!start) {
    return `WEEK OF ${weekStart}`
  }

  const end = addDays(start, 6)

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return `WEEK OF ${formatter.format(start)} - ${formatter.format(end)}`
}

function formatSessionTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value)
}

function formatNumericValue(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "")
}

function joinChunkMetricValues(values: Array<string | null>, compressRepeated = true) {
  const normalizedValues = values.map((value) => value?.trim() || null)
  const nonEmptyValues = normalizedValues.filter((value): value is string => Boolean(value))

  if (nonEmptyValues.length === 0) {
    return ""
  }

  if (compressRepeated) {
    const uniqueValues = Array.from(new Set(nonEmptyValues))

    if (
      uniqueValues.length === 1 &&
      normalizedValues.every((value) => value == null || value === uniqueValues[0])
    ) {
      return uniqueValues[0]
    }
  }

  return normalizedValues.map((value) => value ?? "-").join(" / ")
}

function calculateSetVolume(set: WorkoutLog["exercises"][number]["sets"][number]) {
  if (!set.completed || set.weight == null) {
    return undefined
  }

  const reps = set.actualReps ?? set.targetReps
  return Number.isFinite(reps) ? Number((set.weight * reps).toFixed(2)) : undefined
}

function splitIntoChunks<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

function buildChunkNote(
  log: WorkoutLog,
  exercise: WorkoutLog["exercises"][number],
  chunk: WorkoutLog["exercises"][number]["sets"],
  options: { isFirstExerciseChunk: boolean; isFirstSessionRow: boolean },
) {
  const parts: string[] = []

  if (options.isFirstSessionRow) {
    parts.push(`Session ${formatSessionTimestamp(log.startedAt)}`)

    if (log.notes?.trim()) {
      parts.push(`Session note: ${log.notes.trim()}`)
    }
  }

  if (options.isFirstExerciseChunk && exercise.notes?.trim()) {
    parts.push(`Exercise note: ${exercise.notes.trim()}`)
  }

  const setNotes = chunk
    .map((set) => (set.notes?.trim() ? `S${set.setNumber}: ${set.notes.trim()}` : null))
    .filter((value): value is string => Boolean(value))

  if (setNotes.length > 0) {
    parts.push(setNotes.join(" | "))
  }

  return parts.join(" | ")
}

function buildReportRows(logs: WorkoutLog[], weekStart: string) {
  const rows: ReportRow[] = []
  const mergeRanges: DayMergeRange[] = []
  const orderedLogs = logs
    .slice()
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
  const selectedWeekStart = parseDateInputAsLocalDate(weekStart, 12)

  if (!selectedWeekStart) {
    throw new Error("weekStart không hợp lệ.")
  }

  const logsByDay = new Map<string, WorkoutLog[]>()

  orderedLogs.forEach((log) => {
    const dayKey = formatDateInputValue(log.startedAt)
    const dayLogs = logsByDay.get(dayKey) ?? []
    dayLogs.push(log)
    logsByDay.set(dayKey, dayLogs)
  })

  Array.from(logsByDay.entries())
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .forEach(([dayKey, dayLogs]) => {
      const dayDate = parseDateInputAsLocalDate(dayKey, 12)

      if (!dayDate) {
        return
      }

      const dayNumber = Math.floor((dayDate.getTime() - selectedWeekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
      const dayStartRow = REPORT_START_ROW + rows.length

      dayLogs.forEach((log, logIndex) => {
        log.exercises.forEach((exercise, exerciseIndex) => {
          const chunks = splitIntoChunks(exercise.sets, 4)

          chunks.forEach((chunk, chunkIndex) => {
            const repCells = chunk.map((set) => set.actualReps ?? null)

            while (repCells.length < 4) {
              repCells.push(null)
            }

            rows.push({
              completedSets: chunk.filter((set) => set.completed).length,
              dayNumber,
              exerciseName: exercise.exercise.name,
              isFirstRowInDay: logIndex === 0 && exerciseIndex === 0 && chunkIndex === 0,
              muscleGroup: exercise.exercise.muscleGroup,
              note: buildChunkNote(log, exercise, chunk, {
                isFirstExerciseChunk: chunkIndex === 0,
                isFirstSessionRow: exerciseIndex === 0 && chunkIndex === 0,
              }),
              repCells,
              rirSummary: joinChunkMetricValues(chunk.map((set) => formatNumericValue(set.rir))),
              targetSummary: joinChunkMetricValues(
                chunk.map((set) =>
                  formatRepTarget({
                    reps: set.targetReps,
                    repsMin: set.targetRepsMin,
                  }),
                ),
              ),
              variationName:
                exercise.variation.isDefault || exercise.variation.name.toLowerCase() === "default"
                  ? ""
                  : exercise.variation.name,
              weightSummary: joinChunkMetricValues(chunk.map((set) => formatNumericValue(set.weight))),
            })
          })
        })
      })

      const dayEndRow = REPORT_START_ROW + rows.length - 1
      mergeRanges.push({
        dayNumber,
        endRow: dayEndRow,
        startRow: dayStartRow,
      })
    })

  return { mergeRanges, rows }
}

function captureStyles(worksheet: Worksheet): TemplateStyles {
  const firstDataStyles: Record<number, Partial<Cell["style"]>> = {}
  const continuationDataStyles: Record<number, Partial<Cell["style"]>> = {}
  const summaryHeaderStyles: Record<number, Partial<Cell["style"]>> = {}
  const summaryItemStyles: Record<number, Partial<Cell["style"]>> = {}
  const summaryTotalStyles: Record<number, Partial<Cell["style"]>> = {}

  for (let column = 1; column <= DATA_END_COLUMN; column += 1) {
    firstDataStyles[column] = cloneStyle(worksheet.getCell(REPORT_START_ROW, column).style)
    continuationDataStyles[column] = cloneStyle(worksheet.getCell(REPORT_START_ROW + 1, column).style)
  }

  for (const column of [SUMMARY_LABEL_COLUMN, SUMMARY_VALUE_COLUMN]) {
    summaryHeaderStyles[column] = cloneStyle(worksheet.getCell(SUMMARY_HEADER_ROW, column).style)
    summaryItemStyles[column] = cloneStyle(worksheet.getCell(SUMMARY_ITEM_START_ROW, column).style)
    summaryTotalStyles[column] = cloneStyle(worksheet.getCell(SUMMARY_TOTAL_ROW, column).style)
  }

  return {
    continuationDataHeight: worksheet.getRow(REPORT_START_ROW + 1).height ?? undefined,
    continuationDataStyles,
    firstDataHeight: worksheet.getRow(REPORT_START_ROW).height ?? undefined,
    firstDataStyles,
    summaryHeaderStyles,
    summaryItemStyles,
    summaryTotalStyles,
  }
}

function applyStylesToRange(
  worksheet: Worksheet,
  rowNumber: number,
  styleMap: Record<number, Partial<Cell["style"]>>,
  columns: number[],
) {
  columns.forEach((column) => {
    worksheet.getCell(rowNumber, column).style = cloneStyle(styleMap[column] ?? {})
  })
}

function clearReportArea(worksheet: Worksheet, maxRow: number) {
  for (let row = REPORT_START_ROW; row <= maxRow; row += 1) {
    for (let column = 1; column <= DATA_END_COLUMN; column += 1) {
      const cell = worksheet.getCell(row, column)
      cell.value = null
    }
  }
}

function rebuildSummary(
  worksheet: Worksheet,
  styles: TemplateStyles,
  summaryLabels: string[],
  lastDataRow: number,
) {
  worksheet.getCell(SUMMARY_HEADER_ROW, SUMMARY_LABEL_COLUMN).value = "Muscle Group"
  worksheet.getCell(SUMMARY_HEADER_ROW, SUMMARY_VALUE_COLUMN).value = "SUM OF SETS"
  applyStylesToRange(
    worksheet,
    SUMMARY_HEADER_ROW,
    styles.summaryHeaderStyles,
    [SUMMARY_LABEL_COLUMN, SUMMARY_VALUE_COLUMN],
  )

  summaryLabels.forEach((label, index) => {
    const rowNumber = SUMMARY_ITEM_START_ROW + index

    worksheet.getCell(rowNumber, SUMMARY_LABEL_COLUMN).value = label
    worksheet.getCell(rowNumber, SUMMARY_VALUE_COLUMN).value = {
      formula: `SUMIF(B${REPORT_START_ROW}:B${lastDataRow},"${label.replace(/"/g, '""')}",G${REPORT_START_ROW}:G${lastDataRow})`,
    }

    applyStylesToRange(
      worksheet,
      rowNumber,
      rowNumber === SUMMARY_TOTAL_ROW ? styles.summaryTotalStyles : styles.summaryItemStyles,
      [SUMMARY_LABEL_COLUMN, SUMMARY_VALUE_COLUMN],
    )
  })

  worksheet.getCell(SUMMARY_TOTAL_ROW, SUMMARY_LABEL_COLUMN).value = "Total Volume "
  worksheet.getCell(SUMMARY_TOTAL_ROW, SUMMARY_VALUE_COLUMN).value = {
    formula: `SUM(S${SUMMARY_ITEM_START_ROW}:S${SUMMARY_TOTAL_ROW - 1})`,
  }
  applyStylesToRange(
    worksheet,
    SUMMARY_TOTAL_ROW,
    styles.summaryTotalStyles,
    [SUMMARY_LABEL_COLUMN, SUMMARY_VALUE_COLUMN],
  )
}

function buildRawSetRows(logs: WorkoutLog[], weekStart: string) {
  const selectedWeekStart = parseDateInputAsLocalDate(weekStart, 12)

  if (!selectedWeekStart) {
    throw new Error("weekStart không hợp lệ.")
  }

  return logs
    .slice()
    .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
    .flatMap((log, sessionIndex) =>
      log.exercises.flatMap((exercise, exerciseIndex) => {
        const dayDate = formatDateInputValue(log.startedAt)
        const dayValue = parseDateInputAsLocalDate(dayDate, 12)
        const dayNumber = dayValue
          ? Math.floor((dayValue.getTime() - selectedWeekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
          : ""

        return exercise.sets.map((set) => ({
          actual_reps: set.actualReps ?? "",
          comments_count: log.comments.length,
          completed: set.completed ? "yes" : "no",
          completed_at: log.completedAt ? log.completedAt.toISOString() : "",
          day_date: dayDate,
          day_no: dayNumber,
          exercise_id: exercise.id,
          exercise_label: formatExerciseVariationLabel({
            exerciseName: exercise.exercise.name,
            isDefault: exercise.variation.isDefault,
            variationName: exercise.variation.name,
          }),
          exercise_no: exerciseIndex + 1,
          exercise_note: exercise.notes ?? "",
          muscle_group: exercise.exercise.muscleGroup,
          rir: set.rir ?? "",
          session_id: log.id,
          session_no: sessionIndex + 1,
          session_note: log.notes ?? "",
          session_started_at: log.startedAt.toISOString(),
          set_no: set.setNumber,
          set_note: set.notes ?? "",
          set_volume_kg: calculateSetVolume(set) ?? "",
          target_reps: formatRepTarget({
            reps: set.targetReps,
            repsMin: set.targetRepsMin,
          }),
          trainee_completed_sets_in_session: log.exercises.reduce(
            (sum, currentExercise) => sum + currentExercise.sets.filter((currentSet) => currentSet.completed).length,
            0,
          ),
          trainee_total_volume_session: log.totalVolume ?? "",
          variation_name: exercise.variation.name,
          weight_kg: set.weight ?? "",
          workout_name: log.workout.name,
        }))
      }),
    )
}

function setRawSheetWidths(worksheet: Worksheet) {
  worksheet.columns = [
    { header: "day_no", key: "day_no", width: 10 },
    { header: "day_date", key: "day_date", width: 14 },
    { header: "session_no", key: "session_no", width: 12 },
    { header: "session_id", key: "session_id", width: 40 },
    { header: "session_started_at", key: "session_started_at", width: 28 },
    { header: "completed_at", key: "completed_at", width: 28 },
    { header: "workout_name", key: "workout_name", width: 32 },
    { header: "exercise_no", key: "exercise_no", width: 12 },
    { header: "exercise_id", key: "exercise_id", width: 40 },
    { header: "exercise_label", key: "exercise_label", width: 42 },
    { header: "variation_name", key: "variation_name", width: 24 },
    { header: "muscle_group", key: "muscle_group", width: 20 },
    { header: "set_no", key: "set_no", width: 10 },
    { header: "completed", key: "completed", width: 12 },
    { header: "actual_reps", key: "actual_reps", width: 12 },
    { header: "target_reps", key: "target_reps", width: 14 },
    { header: "weight_kg", key: "weight_kg", width: 12 },
    { header: "rir", key: "rir", width: 10 },
    { header: "set_volume_kg", key: "set_volume_kg", width: 14 },
    { header: "session_note", key: "session_note", width: 36 },
    { header: "exercise_note", key: "exercise_note", width: 36 },
    { header: "set_note", key: "set_note", width: 36 },
    { header: "comments_count", key: "comments_count", width: 14 },
    {
      header: "trainee_completed_sets_in_session",
      key: "trainee_completed_sets_in_session",
      width: 18,
    },
    { header: "trainee_total_volume_session", key: "trainee_total_volume_session", width: 18 },
  ]
  worksheet.views = [{ state: "frozen", ySplit: 1 }]
}

function downloadBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function normalizeArrayBuffer(buffer: ArrayBuffer | Uint8Array) {
  if (buffer instanceof ArrayBuffer) {
    return buffer
  }

  return Uint8Array.from(buffer).buffer
}

function downloadCoachWorkoutLogsWorkbookFile(file: CoachWorkoutLogsWorkbookFile) {
  downloadBuffer(file.buffer, file.fileName)
}

async function buildCoachWorkoutLogsWorkbookFile(
  logs: WorkoutLog[],
  options: DownloadCoachWorkoutLogsWorkbookOptions,
): Promise<CoachWorkoutLogsWorkbookFile> {
  if (logs.length === 0) {
    throw new Error("Không có workout log nào trong tuần đã chọn để xuất báo cáo.")
  }

  const templateResponse = await fetch(TEMPLATE_URL)

  if (!templateResponse.ok) {
    throw new Error("Không tải được template weekly report.")
  }

  const templateBuffer = await templateResponse.arrayBuffer()
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(templateBuffer)

  const reportSheet = workbook.worksheets[0]

  if (!reportSheet) {
    throw new Error("Template weekly report không hợp lệ.")
  }

  reportSheet.name = `Week ${options.weekStart}`
  const styles = captureStyles(reportSheet)
  const summaryLabels = Array.from(
    { length: SUMMARY_TOTAL_ROW - SUMMARY_ITEM_START_ROW },
    (_value, index) => String(reportSheet.getCell(SUMMARY_ITEM_START_ROW + index, SUMMARY_LABEL_COLUMN).value ?? "").trim(),
  ).filter(Boolean)

  TEMPLATE_MERGES.forEach((range) => {
    try {
      reportSheet.unMergeCells(range)
    } catch {
      // Ignore template ranges that are no longer merged.
    }
  })

  const { mergeRanges, rows } = buildReportRows(logs, options.weekStart)
  const maxRow = Math.max(reportSheet.rowCount, REPORT_START_ROW + rows.length + 12)
  clearReportArea(reportSheet, maxRow)

  reportSheet.getCell("A2").value = formatWeekTitle(options.weekStart)

  rows.forEach((row, index) => {
    const rowNumber = REPORT_START_ROW + index
    const rowHeight = row.isFirstRowInDay
      ? styles.firstDataHeight
      : styles.continuationDataHeight

    if (typeof rowHeight === "number") {
      reportSheet.getRow(rowNumber).height = rowHeight
    }

    applyStylesToRange(
      reportSheet,
      rowNumber,
      row.isFirstRowInDay ? styles.firstDataStyles : styles.continuationDataStyles,
      Array.from({ length: DATA_END_COLUMN }, (_value, columnIndex) => columnIndex + 1),
    )

    reportSheet.getCell(rowNumber, 2).value = row.muscleGroup
    reportSheet.getCell(rowNumber, 3).value = row.exerciseName
    reportSheet.getCell(rowNumber, 4).value = row.variationName
    reportSheet.getCell(rowNumber, 7).value = row.completedSets || null
    reportSheet.getCell(rowNumber, 8).value = row.repCells[0]
    reportSheet.getCell(rowNumber, 9).value = row.repCells[1]
    reportSheet.getCell(rowNumber, 10).value = row.repCells[2]
    reportSheet.getCell(rowNumber, 11).value = row.repCells[3]
    reportSheet.getCell(rowNumber, 12).value = row.weightSummary
    reportSheet.getCell(rowNumber, 13).value = row.targetSummary
    reportSheet.getCell(rowNumber, 14).value = row.rirSummary
    reportSheet.getCell(rowNumber, 15).value = row.note
  })

  mergeRanges.forEach((range) => {
    reportSheet.getCell(range.startRow, 1).value = range.dayNumber

    if (range.endRow > range.startRow) {
      reportSheet.mergeCells(range.startRow, 1, range.endRow, 1)
    }
  })

  rebuildSummary(reportSheet, styles, summaryLabels, REPORT_START_ROW + rows.length - 1)

  const existingRawSheet = workbook.getWorksheet("Raw Sets")

  if (existingRawSheet) {
    workbook.removeWorksheet(existingRawSheet.id)
  }

  const rawSheet = workbook.addWorksheet("Raw Sets")
  setRawSheetWidths(rawSheet)
  rawSheet.addRows(buildRawSetRows(logs, options.weekStart))

  const safeTraineeName =
    sanitizeFileNameSegment(options.traineeName ?? "") ||
    sanitizeFileNameSegment(options.traineeId) ||
    "trainee"
  const fileName = `weekly-report-${safeTraineeName}-${options.weekStart}.xlsx`
  const outputBuffer = normalizeArrayBuffer(await workbook.xlsx.writeBuffer())

  return {
    buffer: outputBuffer,
    fileName,
  }
}

async function createCoachWorkoutLogsWorkbookPreview(
  logs: WorkoutLog[],
  options: DownloadCoachWorkoutLogsWorkbookOptions,
): Promise<CoachWorkoutLogsWorkbookPreview> {
  const workbookFile = await buildCoachWorkoutLogsWorkbookFile(logs, options)
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(new Uint8Array(workbookFile.buffer), { type: "array" })
  const sheets = workbook.SheetNames.map((sheetName) => ({
    html: XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], {
      editable: false,
      footer: "",
      header: "",
    }),
    name: sheetName,
  }))

  return {
    ...workbookFile,
    sheets,
  }
}

async function downloadCoachWorkoutLogsWorkbook(
  logs: WorkoutLog[],
  options: DownloadCoachWorkoutLogsWorkbookOptions,
) {
  const workbookFile = await buildCoachWorkoutLogsWorkbookFile(logs, options)
  downloadCoachWorkoutLogsWorkbookFile(workbookFile)
}

export {
  createCoachWorkoutLogsWorkbookPreview,
  downloadCoachWorkoutLogsWorkbook,
  downloadCoachWorkoutLogsWorkbookFile,
  formatDateInputValue,
  startOfLocalWeek,
}

export type {
  CoachWorkoutLogsWorkbookFile,
  CoachWorkoutLogsWorkbookPreview,
  DownloadCoachWorkoutLogsWorkbookOptions,
}
