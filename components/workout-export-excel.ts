/**
 * Shared workout log Excel export — used by both trainee and coach.
 *
 * Output: 2-sheet workbook
 *   Sheet 1 "Sessions"  — one row per session (summary)
 *   Sheet 2 "Raw Sets"  — one row per set, Date & Workout merged per session
 */
import type { Workbook, Worksheet } from "exceljs"

import type { Workout, WorkoutLog } from "@/lib/types"

/**
 * A planned workout from the program schedule, resolved to an absolute calendar
 * date. Used to render scheduled-but-unlogged days in the weekly report with the
 * exercises listed and the actual figures left blank.
 */
export type PlannedSession = {
  date: string
  workout: Workout
}

export type WorkoutExportOptions = {
  /** Display label shown in the meta header (e.g. program name or week range) */
  label: string
  from: string
  to: string
  /** Optional: shown in filename and as "Client:" line */
  subjectName?: string
  /**
   * Planned sessions (program schedule) resolved to calendar dates. Days that
   * have a planned session but no log are shown in the weekly report with the
   * planned exercises and blank actuals. Only days within [from, to) are used,
   * and only for the weekly-report sheets (never Sessions / Raw Sets).
   */
  plannedSessions?: PlannedSession[]
  /**
   * When set (YYYY-MM-DD = the trainee's program start date), the export splits
   * logs into one "Week N" sheet per week (Monday-aligned). Weeks with neither a
   * log nor a planned session are skipped.
   */
  programStartDate?: string
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

const DAY_MS = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD string as local noon (avoids DST off-by-one), or null. */
function parseLocalDateNoon(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
}

function toLocalISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Local YYYY-MM-DD key for any Date (noon-normalized). */
function localDateKey(date: Date) {
  return toLocalISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0))
}

/** Monday (local noon) of the week containing `date`. */
function startOfMondayWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  const dayOfWeek = result.getDay() // 0 Sun..6 Sat
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  result.setDate(result.getDate() - offset)
  return result
}

/** Days from Monday for a scheduledDay (0 Sun..6 Sat) → Mon=0..Sun=6. */
function mondayOffset(scheduledDay: number) {
  return (((scheduledDay % 7) + 6) % 7 + 7) % 7
}

/**
 * Build planned sessions (with absolute calendar dates) from a program's
 * workouts, anchored to the Monday of the program's start week. Week N of the
 * program lands on baseMonday + (weekIndex)*7 + dayOffset(scheduledDay).
 */
export function buildPlannedSessions(workouts: Workout[], programStartISO: string): PlannedSession[] {
  const start = parseLocalDateNoon(programStartISO)
  if (!start) return []
  const baseMonday = startOfMondayWeek(start)

  return workouts
    .filter((workout) => workout.exercises.length > 0)
    .map((workout) => {
      const weekIndex =
        typeof workout.weekIndex === "number" && Number.isFinite(workout.weekIndex)
          ? Math.max(0, Math.round(workout.weekIndex))
          : 0
      const offset = mondayOffset(workout.scheduledDay ?? 1)
      const date = new Date(baseMonday)
      date.setDate(date.getDate() + weekIndex * 7 + offset)
      return { date: toLocalISODate(date), workout }
    })
}

/** Build an empty log for a planned-but-unlogged day: targets kept, actuals blank. */
function plannedSessionToSyntheticLog(planned: PlannedSession): WorkoutLog {
  const startedAt = new Date(`${planned.date}T12:00:00`)
  return {
    comments: [],
    completedAt: undefined,
    exercises: planned.workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        actualReps: undefined,
        completed: false,
        notes: undefined,
        rir: undefined,
        weight: undefined,
      })),
    })),
    id: `planned-${planned.date}-${planned.workout.id}`,
    notes: "",
    plannedDate: startedAt,
    startedAt,
    totalVolume: undefined,
    workout: planned.workout,
  }
}

type WeekSheetData = {
  logs: WorkoutLog[]
  weekNumber: number
  weekStart: string
}

/**
 * Group logs + planned sessions into Monday-aligned program weeks. Week 1 is the
 * week containing the program start. Each week's logs are the real logs plus a
 * synthetic empty log for every planned day that has no real log. Weeks before
 * the program start, and weeks with neither a log nor a planned session, are
 * omitted.
 */
function buildProgramWeekSheets(
  logs: WorkoutLog[],
  plannedSessions: PlannedSession[],
  programStartDate: string,
): WeekSheetData[] {
  const start = parseLocalDateNoon(programStartDate)
  if (!start) return []
  const baseMonday = startOfMondayWeek(start)

  const weekIndexOf = (date: Date) => {
    const monday = startOfMondayWeek(date)
    return Math.round((monday.getTime() - baseMonday.getTime()) / (7 * DAY_MS))
  }

  const byWeek = new Map<number, { loggedDays: Set<string>; logs: WorkoutLog[] }>()
  const ensureWeek = (weekIndex: number) => {
    let entry = byWeek.get(weekIndex)
    if (!entry) {
      entry = { loggedDays: new Set(), logs: [] }
      byWeek.set(weekIndex, entry)
    }
    return entry
  }

  for (const log of logs) {
    const date = new Date(log.startedAt)
    const weekIndex = weekIndexOf(date)
    if (weekIndex < 0) continue
    const entry = ensureWeek(weekIndex)
    entry.logs.push(log)
    entry.loggedDays.add(localDateKey(date))
  }

  for (const planned of plannedSessions) {
    const date = new Date(`${planned.date}T12:00:00`)
    const weekIndex = weekIndexOf(date)
    if (weekIndex < 0) continue
    const entry = ensureWeek(weekIndex)
    if (entry.loggedDays.has(planned.date)) continue
    entry.logs.push(plannedSessionToSyntheticLog(planned))
  }

  return Array.from(byWeek.entries())
    .sort(([leftWeek], [rightWeek]) => leftWeek - rightWeek)
    .map(([weekIndex, entry]) => {
      const monday = new Date(baseMonday)
      monday.setDate(monday.getDate() + weekIndex * 7)
      return { logs: entry.logs, weekNumber: weekIndex + 1, weekStart: toLocalISODate(monday) }
    })
}

/** Lexicographic [from, to) check for YYYY-MM-DD strings. */
function isWithinWindow(dateISO: string, fromISO: string, toISO: string) {
  return dateISO >= fromISO && dateISO < toISO
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

  // Sheet 1+: Weekly Report (template-based)
  const { addWeeklyReportSheet } = await import("@/components/coach/trainee-workout-logs-excel")

  // Planned sessions falling inside the export window — used to render
  // scheduled-but-unlogged days with blank actuals.
  const plannedInWindow = (options.plannedSessions ?? []).filter((planned) =>
    isWithinWindow(planned.date, options.from, options.to),
  )

  if (options.programStartDate) {
    // Program mode: one Monday-aligned "Week N" sheet per week with a log or plan.
    const weeks = buildProgramWeekSheets(logs, plannedInWindow, options.programStartDate)

    if (weeks.length > 0) {
      for (const week of weeks) {
        await addWeeklyReportSheet(workbook, week.logs, week.weekStart, `Week ${week.weekNumber}`)
      }
    } else {
      // Nothing fell on/after the program start — keep a single report as fallback.
      await addWeeklyReportSheet(workbook, logs, options.from)
    }
  } else {
    // Single weekly report (e.g. Week mode): merge planned-but-unlogged days.
    const loggedDays = new Set(logs.map((log) => localDateKey(new Date(log.startedAt))))
    const syntheticLogs = plannedInWindow
      .filter((planned) => !loggedDays.has(planned.date))
      .map(plannedSessionToSyntheticLog)
    await addWeeklyReportSheet(workbook, [...logs, ...syntheticLogs], options.from)
  }

  // Sessions summary (real logs only)
  buildSessionsSheet(workbook, logs, options)

  // Raw Sets (real logs only)
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
