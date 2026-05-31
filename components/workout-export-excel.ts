/**
 * Shared workout log Excel export — used by both trainee and coach.
 *
 * Output: 2-sheet workbook
 *   Sheet 1 "Sessions"  — one row per session (summary)
 *   Sheet 2 "Raw Sets"  — one row per set, Date & Workout merged per session
 */
import type { Workbook, Worksheet } from "exceljs"

import type { WorkoutLog } from "@/lib/types"

export type WorkoutExportOptions = {
  /** Display label shown in the meta header (e.g. program name or week range) */
  label: string
  from: string
  to: string
  /** Optional: shown in filename and as "Client:" line */
  subjectName?: string
}

type ExportFile = {
  buffer: ArrayBuffer
  fileName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function formatDayDate(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" })
  const d = date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
  return `${weekday}, ${d}`
}

function formatDuration(mins?: number | null) {
  if (!mins || mins <= 0) return ""
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadWorkoutLogs(logs: WorkoutLog[], options: WorkoutExportOptions) {
  const file = await buildWorkoutLogsFile(logs, options)
  const blob = new Blob([file.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file.fileName
  a.click()
  URL.revokeObjectURL(url)
}

export async function buildWorkoutLogsFile(logs: WorkoutLog[], options: WorkoutExportOptions): Promise<ExportFile> {
  const ExcelJS = await import("exceljs")
  const workbook: Workbook = new ExcelJS.Workbook()
  workbook.creator = "YeahBuddy"
  workbook.created = new Date()

  // Sheet 1: Weekly Report (template-based)
  const { addWeeklyReportSheet } = await import("@/components/coach/trainee-workout-logs-excel")
  await addWeeklyReportSheet(workbook, logs, options.from)

  // Sheet 2: Sessions summary
  buildSessionsSheet(workbook, logs, options)

  // Sheet 3: Raw Sets
  buildRawSetsSheet(workbook, logs)

  const safeLabel = sanitizeSegment(options.label) || "export"
  const safeName = options.subjectName ? `-${sanitizeSegment(options.subjectName)}` : ""
  const fileName = `workout-export${safeName}-${safeLabel}-${options.from}.xlsx`

  const raw = await workbook.xlsx.writeBuffer()
  const u8 = new Uint8Array(raw as ArrayBuffer)
  const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer

  return { buffer, fileName }
}

// ── Sheet 1: Sessions ─────────────────────────────────────────────────────────

function buildSessionsSheet(workbook: Workbook, logs: WorkoutLog[], options: WorkoutExportOptions) {
  const sheet: Worksheet = workbook.addWorksheet("Sessions")

  sheet.columns = [
    { header: "Date", key: "date", width: 28 },
    { header: "Workout", key: "workout", width: 28 },
    { header: "Duration", key: "duration", width: 12 },
    { header: "Total Volume (kg)", key: "volume", width: 18 },
    { header: "Notes", key: "notes", width: 36 },
  ]

  const subjectLine = options.subjectName ? `Client: ${options.subjectName}` : options.label
  const periodLine = options.label !== subjectLine ? options.label : `Period: ${options.from} → ${options.to}`

  sheet.spliceRows(1, 0,
    ["YeahBuddy — Workout Export"],
    [subjectLine],
    [periodLine],
    [`Period: ${options.from} → ${options.to}`, "", "", `Sessions: ${logs.length}`],
    [],
  )

  sheet.getRow(1).font = { bold: true, size: 14 }
  sheet.getRow(2).font = { italic: true, color: { argb: "FF444444" }, size: 11 }
  sheet.getRow(3).font = { color: { argb: "FF666666" }, size: 10 }
  sheet.getRow(4).font = { color: { argb: "FF666666" }, size: 10 }

  // Column header (row 6 after splice)
  const headerRow = sheet.getRow(6)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { vertical: "middle" }
  })
  headerRow.height = 20

  let rowIdx = 7
  for (const log of logs) {
    const row = sheet.getRow(rowIdx)
    row.values = [
      log.startedAt ? formatDayDate(new Date(log.startedAt)) : "",
      log.workout?.name ?? "",
      log.workout?.duration ? formatDuration(log.workout.duration) : "",
      log.totalVolume ?? 0,
      log.notes ?? "",
    ]
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      cell.font = { size: 10 }
      if (col === 4) cell.numFmt = "#,##0"
    })
    if (rowIdx % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { fgColor: { argb: "FFF7F7F7" }, pattern: "solid", type: "pattern" }
      })
    }
    rowIdx++
  }
}

// ── Sheet 2: Raw Sets ─────────────────────────────────────────────────────────

function buildRawSetsSheet(workbook: Workbook, logs: WorkoutLog[]) {
  const sheet: Worksheet = workbook.addWorksheet("Raw Sets")

  sheet.columns = [
    { header: "Date", key: "date", width: 28 },
    { header: "Workout", key: "workout", width: 26 },
    { header: "Exercise", key: "exercise", width: 28 },
    { header: "Variation", key: "variation", width: 22 },
    { header: "Muscle Group", key: "muscleGroup", width: 16 },
    { header: "Set #", key: "setNumber", width: 8 },
    { header: "Target Reps", key: "targetReps", width: 13 },
    { header: "Actual Reps", key: "actualReps", width: 13 },
    { header: "Weight (kg)", key: "weight", width: 12 },
    { header: "RIR", key: "rir", width: 8 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Volume (kg)", key: "volume", width: 13 },
    { header: "Notes", key: "notes", width: 30 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { vertical: "middle" }
  })
  headerRow.height = 20
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  let rowIdx = 2
  for (const log of logs) {
    const dateStr = log.startedAt ? formatDayDate(new Date(log.startedAt)) : ""
    const workoutName = log.workout?.name ?? ""
    const logStartRow = rowIdx

    for (const ex of log.exercises) {
      const muscleGroup = ex.exercise?.muscleGroup ?? ""
      for (const set of ex.sets) {
        const targetStr =
          set.targetRepsMin && set.targetReps
            ? `${set.targetRepsMin}–${set.targetReps}`
            : set.targetReps
              ? String(set.targetReps)
              : ""
        const setVolume =
          typeof set.actualReps === "number" && typeof set.weight === "number"
            ? set.actualReps * set.weight
            : ""

        sheet.getRow(rowIdx).values = [
          dateStr,
          workoutName,
          ex.exercise?.name ?? "",
          ex.variation?.name ?? "",
          muscleGroup,
          set.setNumber,
          targetStr,
          set.actualReps ?? "",
          set.weight ?? "",
          set.rir ?? "",
          set.completed ? "Yes" : "No",
          setVolume,
          set.notes ?? "",
        ]
        sheet.getRow(rowIdx).font = { size: 10 }
        rowIdx++
      }
    }

    const logEndRow = rowIdx - 1
    if (logEndRow >= logStartRow) {
      for (const col of [1, 2] as const) {
        if (logEndRow > logStartRow) {
          sheet.mergeCells(logStartRow, col, logEndRow, col)
        }
        const cell = sheet.getCell(logStartRow, col)
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
        cell.font = { bold: true, size: 10 }
      }
    }
  }
}
