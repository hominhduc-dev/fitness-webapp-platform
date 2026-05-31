import type { WorkoutLog } from "@/lib/types"

type ExportOptions = {
  from: string
  label: string
  to: string
}

type ExportFile = {
  buffer: ArrayBuffer
  fileName: string
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function formatLocalDate(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" })
  const dateStr = date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" })
  return `${weekday}, ${dateStr}`
}

function formatDuration(mins?: number | null) {
  if (!mins || mins <= 0) return ""
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export async function downloadTraineeSelfExport(logs: WorkoutLog[], options: ExportOptions): Promise<void> {
  const file = await buildTraineeSelfExportFile(logs, options)
  const blob = new Blob([file.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function buildTraineeSelfExportFile(logs: WorkoutLog[], options: ExportOptions): Promise<ExportFile> {
  const ExcelJS = (await import("exceljs")).default

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "YeahBuddy"
  workbook.created = new Date()

  // ── Sheet 1: Session Summary ──────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Sessions")

  summarySheet.columns = [
    { header: "Date", key: "date", width: 28 },
    { header: "Workout", key: "workout", width: 28 },
    { header: "Duration", key: "duration", width: 12 },
    { header: "Total Volume", key: "volume", width: 16 },
    { header: "Notes", key: "notes", width: 36 },
  ]

  // Meta rows (spliced above data header row)
  summarySheet.spliceRows(1, 0,
    ["YeahBuddy — Workout Export"],
    [options.label],
    [`Period: ${options.from} → ${options.to}`],
    [`Total sessions: ${logs.length}`],
    [],
  )

  summarySheet.getRow(1).font = { bold: true, size: 14 }
  summarySheet.getRow(2).font = { italic: true, size: 11 }
  summarySheet.getRow(3).font = { color: { argb: "FF666666" }, size: 10 }
  summarySheet.getRow(4).font = { color: { argb: "FF666666" }, size: 10 }

  // Style the data header (now row 6)
  const dataHeaderRow = summarySheet.getRow(6)
  dataHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { vertical: "middle" }
  })
  dataHeaderRow.height = 20

  let dataRowIndex = 7
  for (const log of logs) {
    const row = summarySheet.getRow(dataRowIndex)
    row.values = [
      log.startedAt ? formatLocalDate(new Date(log.startedAt)) : "",
      log.workout?.name ?? "",
      log.workout?.duration ? formatDuration(log.workout.duration) : "",
      log.totalVolume ?? 0,
      log.notes ?? "",
    ]
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      cell.font = { size: 10 }
      if (colNumber === 4) cell.numFmt = "#,##0"
    })
    if (dataRowIndex % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { fgColor: { argb: "FFF7F7F7" }, pattern: "solid", type: "pattern" }
      })
    }
    dataRowIndex++
  }

  // ── Sheet 2: Raw Sets ─────────────────────────────────────────────────────
  const rawSheet = workbook.addWorksheet("Raw Sets")

  rawSheet.columns = [
    { header: "Date", key: "date", width: 28 },
    { header: "Workout", key: "workout", width: 24 },
    { header: "Exercise", key: "exercise", width: 28 },
    { header: "Variation", key: "variation", width: 22 },
    { header: "Muscle Group", key: "muscleGroup", width: 16 },
    { header: "Set #", key: "setNumber", width: 8 },
    { header: "Target Reps", key: "targetReps", width: 13 },
    { header: "Actual Reps", key: "actualReps", width: 13 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "RIR", key: "rir", width: 8 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Notes", key: "notes", width: 30 },
  ]

  const rawHeader = rawSheet.getRow(1)
  rawHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { vertical: "middle" }
  })
  rawHeader.height = 20

  let rawRowIndex = 2
  for (const log of logs) {
    const dateStr = log.startedAt ? formatLocalDate(new Date(log.startedAt)) : ""
    const workoutName = log.workout?.name ?? ""

    for (const ex of log.exercises) {
      const muscleGroup = ex.exercise?.muscleGroup ?? ex.exercise?.name ?? ""
      for (const set of ex.sets) {
        const targetStr =
          set.targetRepsMin && set.targetReps
            ? `${set.targetRepsMin}–${set.targetReps}`
            : set.targetReps
              ? String(set.targetReps)
              : ""

        rawSheet.getRow(rawRowIndex).values = [
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
          set.notes ?? "",
        ]
        rawSheet.getRow(rawRowIndex).font = { size: 10 }
        rawRowIndex++
      }
    }
  }

  const safeLabel = sanitizeSegment(options.label) || "export"
  const fileName = `workout-export-${safeLabel}-${options.from}.xlsx`
  const rawBuffer = await workbook.xlsx.writeBuffer()
  const uint8 = new Uint8Array(rawBuffer as ArrayBuffer)
  const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer

  return { buffer, fileName }
}
