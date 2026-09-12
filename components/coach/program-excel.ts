import type { CoachTrainee, CreateCoachProgramInput, ExerciseVariationOption } from "@/lib/fitness/types"
import {
  buildVariationLookup,
  buildWorkoutsFromRows,
  normalizeLookup,
  parsePositiveInteger,
  resolveVariation,
} from "@/components/coach/program-import-rows"
import { parseRepTargetText } from "@/lib/workout-reps"

type RawCell = string | number | boolean | null | undefined

type ImportedProgramDraft = {
  weekTemplate?: boolean
  assignToUserIds?: string[]
  description?: string
  difficulty?: CreateCoachProgramInput["difficulty"]
  duration?: number
  name?: string
  workouts: CreateCoachProgramInput["workouts"]
}

type ProgramFieldKey = "assignToEmails" | "description" | "difficulty" | "duration" | "name"

type WorkoutColumnKey =
  | "exerciseName"
  | "reps"
  | "rirRpe"
  | "scheduledDay"
  | "sets"
  | "variationId"
  | "variationName"
  | "weight"
  | "workoutName"

const PROGRAM_SHEET_NAME = "Program"
const WORKOUTS_SHEET_NAME = "Workouts"
const INSTRUCTIONS_SHEET_NAME = "Instructions"
const REFERENCE_SHEET_NAME = "Exercise Table"
const TRAINEES_SHEET_NAME = "Trainees"

const DIFFICULTY_MAP = new Map<string, CreateCoachProgramInput["difficulty"]>([
  ["advanced", "advanced"],
  ["beginner", "beginner"],
  ["intermediate", "intermediate"],
])

const DAY_ALIASES: Array<[number, string[]]> = [
  [0, ["0", "7", "cn", "chu nhat", "chủ nhật", "chunhat", "chủnhật", "sun", "sunday"]],
  [1, ["1", "t2", "t 2", "thu 2", "thứ 2", "thu2", "thứ2", "thu hai", "thứ hai", "thuhai", "m2", "mon", "monday"]],
  [2, ["2", "t3", "t 3", "thu 3", "thứ 3", "thu3", "thứ3", "thu ba", "thứ ba", "thuba", "m3", "tue", "tues", "tuesday"]],
  [3, ["3", "t4", "t 4", "thu 4", "thứ 4", "thu4", "thứ4", "thu tu", "thứ tư", "thutu", "m4", "wed", "weds", "wednesday"]],
  [4, ["4", "t5", "t 5", "thu 5", "thứ 5", "thu5", "thứ5", "thu nam", "thứ năm", "thunam", "m5", "thu", "thur", "thurs", "thursday"]],
  [5, ["5", "t6", "t 6", "thu 6", "thứ 6", "thu6", "thứ6", "thu sau", "thứ sáu", "thusau", "m6", "fri", "friday"]],
  [6, ["6", "t7", "t 7", "thu 7", "thứ 7", "thu7", "thứ7", "thu bay", "thứ bảy", "thubay", "m7", "sat", "saturday"]],
]

const WEEKDAY_ORDER_ALIASES: Array<[number, string[]]> = [
  [1, ["day 1", "day1", "ngay 1", "ngày 1", "ngay1", "ngày1", "buoi 1", "buổi 1", "buoi1", "buổi1"]],
  [2, ["day 2", "day2", "ngay 2", "ngày 2", "ngay2", "ngày2", "buoi 2", "buổi 2", "buoi2", "buổi2"]],
  [3, ["day 3", "day3", "ngay 3", "ngày 3", "ngay3", "ngày3", "buoi 3", "buổi 3", "buoi3", "buổi3"]],
  [4, ["day 4", "day4", "ngay 4", "ngày 4", "ngay4", "ngày4", "buoi 4", "buổi 4", "buoi4", "buổi4"]],
  [5, ["day 5", "day5", "ngay 5", "ngày 5", "ngay5", "ngày5", "buoi 5", "buổi 5", "buoi5", "buổi5"]],
  [6, ["day 6", "day6", "ngay 6", "ngày 6", "ngay6", "ngày6", "buoi 6", "buổi 6", "buoi6", "buổi6"]],
  [0, ["day 7", "day7", "ngay 7", "ngày 7", "ngay7", "ngày7", "buoi 7", "buổi 7", "buoi7", "buổi7"]],
]

const PROGRAM_FIELD_ALIASES: Record<ProgramFieldKey, string[]> = {
  assignToEmails: ["assign_to_emails", "assigntoemails", "emails", "trainee_emails"],
  description: ["description", "program_description"],
  difficulty: ["difficulty", "level"],
  duration: ["duration", "duration_weeks", "weeks"],
  name: ["name", "program_name"],
}

const WORKOUT_COLUMN_ALIASES: Record<WorkoutColumnKey, string[]> = {
  exerciseName: ["exercise", "exercise_name", "exercisename"],
  reps: ["reps", "reps_range", "repsrange", "target_reps", "targetreps", "target_reps_range", "targetrepsrange"],
  rirRpe: ["rir_rpe", "rirrpe", "rir&rpe", "rir", "rpe"],
  scheduledDay: ["day", "scheduled_day", "scheduledday", "weekday"],
  sets: ["sets"],
  variationId: ["exercise_variation_id", "variation_id", "variationid"],
  variationName: ["variation", "variation_name", "variationname"],
  weight: ["load", "weight"],
  workoutName: ["day_name", "session_name", "workout_name", "workoutname"],
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeKey(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "")
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function normalizeDayLookup(value: string) {
  const spaced = stripDiacritics(value)
    .toLowerCase()
    .replace(/[.,;:/\\()[\]{}]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    compact: spaced.replace(/\s+/g, ""),
    spaced,
  }
}

function buildDayLookup() {
  const lookup = new Map<string, number>()

  ;[...DAY_ALIASES, ...WEEKDAY_ORDER_ALIASES].forEach(([day, aliases]) => {
    aliases.forEach((alias) => {
      const normalizedAlias = normalizeDayLookup(alias)

      lookup.set(normalizedAlias.spaced, day)

      if (normalizedAlias.compact) {
        lookup.set(normalizedAlias.compact, day)
      }
    })
  })

  return lookup
}

const DAY_LOOKUP = buildDayLookup()

function isEmptyRow(row: RawCell[]) {
  return row.every((cell) => normalizeText(cell) === "")
}

function resolveProgramField(cell: unknown) {
  const normalized = normalizeKey(cell)

  return (Object.entries(PROGRAM_FIELD_ALIASES).find(([, aliases]) => aliases.some((alias) => normalizeKey(alias) === normalized))?.[0] ??
    undefined) as ProgramFieldKey | undefined
}

function resolveWorkoutColumn(cell: unknown) {
  const normalized = normalizeKey(cell)

  return (Object.entries(WORKOUT_COLUMN_ALIASES).find(([, aliases]) => aliases.some((alias) => normalizeKey(alias) === normalized))?.[0] ??
    undefined) as WorkoutColumnKey | undefined
}

function parseScheduledDay(value: string) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return undefined
  }

  const parsedNumericValue = Number(normalizedValue)

  if (Number.isFinite(parsedNumericValue)) {
    const roundedValue = Math.round(parsedNumericValue)

    if (roundedValue === 7) {
      return 0
    }

    if (roundedValue >= 0 && roundedValue <= 6) {
      return roundedValue
    }
  }

  const normalizedDay = normalizeDayLookup(normalizedValue)
  const mappedDay = DAY_LOOKUP.get(normalizedDay.spaced) ?? DAY_LOOKUP.get(normalizedDay.compact)

  if (mappedDay != null) {
    return mappedDay
  }

  const isoDateMatch = normalizedDay.spaced.match(/^(\d{4})[ /-](\d{1,2})[ /-](\d{1,2})$/)

  if (isoDateMatch) {
    const parsedDate = new Date(Date.UTC(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3])))
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.getUTCDay()
  }

  const dmyDateMatch = normalizedDay.spaced.match(/^(\d{1,2})[ /-](\d{1,2})[ /-](\d{2,4})$/)

  if (dmyDateMatch) {
    const year = Number(dmyDateMatch[3].length === 2 ? `20${dmyDateMatch[3]}` : dmyDateMatch[3])
    const parsedDate = new Date(Date.UTC(year, Number(dmyDateMatch[2]) - 1, Number(dmyDateMatch[1])))
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.getUTCDay()
  }

  return undefined
}

async function getSheetRows(sheet: unknown) {
  const XLSX = await import("xlsx")

  return XLSX.utils.sheet_to_json<RawCell[]>(sheet as Parameters<typeof XLSX.utils.sheet_to_json>[0], {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false,
  })
}

async function findSheetByHeader(
  workbook: { SheetNames: string[]; Sheets: Record<string, unknown> },
  preferredName: string,
  resolveColumn: (cell: unknown) => string | undefined,
  requiredColumns: string[],
) {
  const preferredSheet = workbook.SheetNames.find(
    (sheetName) => normalizeLookup(sheetName) === normalizeLookup(preferredName),
  )

  if (preferredSheet) {
    return {
      rows: await getSheetRows(workbook.Sheets[preferredSheet]),
      sheetName: preferredSheet,
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const rows = await getSheetRows(workbook.Sheets[sheetName])
    const headerRow = rows[0] ?? []
    const resolvedColumns = headerRow.map(resolveColumn).filter(Boolean)

    if (requiredColumns.every((column) => resolvedColumns.includes(column))) {
      return {
        rows,
        sheetName,
      }
    }
  }

  return null
}

function parseProgramSheet(
  rows: RawCell[][],
  trainees: CoachTrainee[],
): ImportedProgramDraft {
  if (!rows.length) {
    return { workouts: [] }
  }

  const headerRow = rows[0] ?? []
  const fieldColumnIndex = headerRow.findIndex((cell) => normalizeKey(cell) === "field")
  const valueColumnIndex = headerRow.findIndex((cell) => normalizeKey(cell) === "value")

  if (fieldColumnIndex < 0 || valueColumnIndex < 0) {
    throw new Error("Sheet Program phải có cột 'field' và 'value'.")
  }

  const rawValues = rows.slice(1).reduce<Partial<Record<ProgramFieldKey, string>>>((result, row) => {
    if (isEmptyRow(row)) {
      return result
    }

    const field = resolveProgramField(row[fieldColumnIndex])
    const value = normalizeText(row[valueColumnIndex])

    if (field && value) {
      result[field] = value
    }

    return result
  }, {})

  const draft: ImportedProgramDraft = {
    workouts: [],
  }

  if (rawValues.name) {
    draft.name = rawValues.name
  }

  if (rawValues.description) {
    draft.description = rawValues.description
  }

  if (rawValues.duration) {
    const duration = parsePositiveInteger(rawValues.duration)

    if (!duration) {
      throw new Error("Giá trị duration_weeks trong sheet Program không hợp lệ.")
    }

    draft.duration = duration
  }

  if (rawValues.difficulty) {
    const difficulty = DIFFICULTY_MAP.get(normalizeLookup(rawValues.difficulty))

    if (!difficulty) {
      throw new Error("Giá trị difficulty trong sheet Program phải là beginner, intermediate hoặc advanced.")
    }

    draft.difficulty = difficulty
  }

  if (rawValues.assignToEmails) {
    const emails = Array.from(
      new Set(
        rawValues.assignToEmails
          .split(/[;,\n]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    )
    const traineeIdByEmail = new Map(
      trainees
        .filter((trainee) => trainee.email)
        .map((trainee) => [trainee.email.trim().toLowerCase(), trainee.id] as const),
    )
    const missingEmails = emails.filter((email) => !traineeIdByEmail.has(email))

    if (missingEmails.length > 0) {
      throw new Error(`Không tìm thấy trainee theo email: ${missingEmails.join(", ")}.`)
    }

    draft.assignToUserIds = emails.map((email) => traineeIdByEmail.get(email) as string)
  }

  return draft
}

function parseWorkoutRows(
  rows: RawCell[][],
  exercises: ExerciseVariationOption[],
) {
  if (!rows.length) {
    throw new Error("Sheet Workouts đang trống.")
  }

  const headerRow = rows[0] ?? []
  const columnMap = headerRow.reduce<Partial<Record<WorkoutColumnKey, number>>>((result, cell, index) => {
    const column = resolveWorkoutColumn(cell)

    if (column && typeof result[column] !== "number") {
      result[column] = index
    }

    return result
  }, {})

  const requiredColumns: WorkoutColumnKey[] = ["workoutName", "scheduledDay", "sets", "reps"]
  const missingColumns = requiredColumns.filter((column) => typeof columnMap[column] !== "number")

  if (missingColumns.length > 0) {
    const missingColumnLabels = missingColumns.map((column) => (column === "reps" ? "reps_range" : column))
    throw new Error(`Sheet Workouts thiếu cột bắt buộc: ${missingColumnLabels.join(", ")}.`)
  }

  const variationLookup = buildVariationLookup(exercises)
  const groupedWorkouts = new Map<
    string,
    {
      exercises: CreateCoachProgramInput["workouts"][number]["exercises"]
      name: string
      scheduledDay: number
    }
  >()
  const issues: string[] = []
  let lastScheduledDayRaw = ""
  let lastWorkoutName = ""

  function findNextScheduledDayValue(startIndex: number) {
    for (let index = startIndex + 1; index < rows.length; index += 1) {
      const nextValue = normalizeText(rows[index]?.[columnMap.scheduledDay as number])

      if (nextValue) {
        return nextValue
      }
    }

    return ""
  }

  rows.slice(1).forEach((row, rowIndex) => {
    if (isEmptyRow(row)) {
      return
    }

    const workoutNameRaw = normalizeText(row[columnMap.workoutName as number])
    const scheduledDayCellRaw = normalizeText(row[columnMap.scheduledDay as number])
    const workoutName = workoutNameRaw || lastWorkoutName
    const scheduledDayCandidates = [
      scheduledDayCellRaw,
      lastScheduledDayRaw,
      findNextScheduledDayValue(rowIndex + 1),
      workoutNameRaw,
      workoutName,
    ].filter(Boolean)
    const scheduledDayRaw = scheduledDayCandidates[0] ?? ""
    const setsRaw = normalizeText(row[columnMap.sets as number])
    const repsRaw = normalizeText(row[columnMap.reps as number])
    const variationId = normalizeText(
      typeof columnMap.variationId === "number" ? row[columnMap.variationId] : "",
    )
    const exerciseName = normalizeText(
      typeof columnMap.exerciseName === "number" ? row[columnMap.exerciseName] : "",
    )
    const variationName = normalizeText(
      typeof columnMap.variationName === "number" ? row[columnMap.variationName] : "",
    )
    const scheduledDay = scheduledDayCandidates
      .map((candidate) => parseScheduledDay(candidate))
      .find((candidate): candidate is number => candidate != null)
    const sets = parsePositiveInteger(setsRaw)
    const repTarget = parseRepTargetText(repsRaw)
    const rowNumber = rowIndex + 2

    if (workoutNameRaw) {
      lastWorkoutName = workoutNameRaw
    }

    if (scheduledDayCellRaw) {
      lastScheduledDayRaw = scheduledDayCellRaw
    }

    if (!workoutName) {
      issues.push(`Dòng ${rowNumber}: thiếu workout_name.`)
      return
    }

    if (scheduledDay == null) {
      issues.push(
        `Dòng ${rowNumber}: scheduled_day '${scheduledDayRaw || "(trống)"}' không hợp lệ. Dùng 0-6, 7, Monday, T2, Thu2, Thứ hai, CN hoặc Day 1-Day 7.`,
      )
      return
    }

    if (!sets) {
      issues.push(`Dòng ${rowNumber}: sets phải là số nguyên dương.`)
      return
    }

    if (!repTarget) {
      issues.push(`Dòng ${rowNumber}: reps_range phải là số nguyên dương hoặc khoảng như 8-12.`)
      return
    }

    if (!variationId && !exerciseName) {
      issues.push(`Dòng ${rowNumber}: cần variation_id hoặc exercise_name.`)
      return
    }

    const variation = resolveVariation(variationLookup, {
      exerciseName,
      variationId,
      variationName,
    })

    if (!variation) {
      issues.push(
        `Dòng ${rowNumber}: không map được variation cho '${variationId || `${exerciseName} / ${variationName || "Default"}`}'.`,
      )
      return
    }

    const weightRaw = normalizeText(typeof columnMap.weight === "number" ? row[columnMap.weight] : "")
    const parsedWeight = Number(weightRaw)
    const rirRaw = normalizeText(typeof columnMap.rirRpe === "number" ? row[columnMap.rirRpe] : "")
    const parsedRir = parsePositiveInteger(rirRaw)
    const key = `${workoutName}::${scheduledDay}`
    const workout = groupedWorkouts.get(key) ?? {
      exercises: [],
      name: workoutName,
      scheduledDay,
    }

    workout.exercises.push({
      reps: repTarget.reps,
      repsMin: repTarget.repsMin,
      rir: parsedRir,
      sets,
      variationId: variation.id,
      weight: weightRaw && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : undefined,
    })

    groupedWorkouts.set(key, workout)
  })

  if (issues.length > 0) {
    throw new Error(issues.slice(0, 8).join(" "))
  }

  return Array.from(groupedWorkouts.values())
}

async function importCoachProgramTemplate(
  file: File,
  exercises: ExerciseVariationOption[],
  trainees: CoachTrainee[],
): Promise<ImportedProgramDraft> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: "array",
  })

  if (!workbook.SheetNames.length) {
    throw new Error("File Excel không có sheet nào.")
  }

  const weekName = workbook.SheetNames.find((name) => /^week\s*1$/i.test(name))
  if (weekName) {
    const values = XLSX.utils.sheet_to_json<RawCell[]>(workbook.Sheets[weekName], { header: 1, defval: "" })
    const headerIndex = values.findIndex((row) => row[0] === "Day" && row[2] === "Exercise")
    if (headerIndex >= 0) {
      const header = values[headerIndex]
      let day = ""
      const rows = values.slice(headerIndex + 1).flatMap((row, index) => {
        if (normalizeText(row[0])) day = normalizeText(row[0])
        if (!normalizeText(row[2]) && !normalizeText(row[4]) && !normalizeText(row[5]) && !normalizeText(row[6])) return []
        const optionalNumber = (value: RawCell) => normalizeText(value) ? Number(value) : undefined
        return [{
          sourceRow: headerIndex + index + 2, scheduledDay: /^[1-6]$/.test(day) ? Number(day) : undefined,
          workoutName: `Day ${day}`, exerciseName: normalizeText(row[2]), variationName: normalizeText(row[3]),
          variationId: normalizeText(row[4]) || "__missing_variation_id__", sets: optionalNumber(row[5]),
          reps: normalizeText(row[6]), weight: optionalNumber(row[7]),
          rir: optionalNumber(row[header.indexOf("RIR")]), restTime: optionalNumber(row[header.indexOf("Rest (s)")]),
          notes: normalizeText(row[header.indexOf("Note")]) || undefined,
        }]
      })
      const metadataSheet = await findSheetByHeader(workbook, PROGRAM_SHEET_NAME, resolveProgramField, ["name"])
      const draft = metadataSheet ? parseProgramSheet(metadataSheet.rows, trainees) : { workouts: [] }
      const built = buildWorkoutsFromRows(rows, exercises, { duration: draft.duration ?? 1 })
      if (built.issues.length) throw new Error(built.issues.map((issue) => issue.message).join("\n"))
      if (!built.workouts.length) throw new Error("Sheet Week 1 chưa có bài tập.")
      return { ...draft, weekTemplate: true, workouts: built.workouts }
    }
  }

  const programSheet = await findSheetByHeader(
    workbook,
    PROGRAM_SHEET_NAME,
    resolveProgramField,
    ["name"],
  )
  const workoutsSheet = await findSheetByHeader(
    workbook,
    WORKOUTS_SHEET_NAME,
    resolveWorkoutColumn,
    ["reps", "scheduledDay", "sets", "workoutName"],
  )

  if (!workoutsSheet) {
    throw new Error("Không tìm thấy sheet Workouts hợp lệ trong file import.")
  }

  const programDraft = programSheet ? parseProgramSheet(programSheet.rows, trainees) : { workouts: [] }
  const workouts = parseWorkoutRows(workoutsSheet.rows, exercises)

  if (workouts.length === 0) {
    throw new Error("File import chưa có workout hợp lệ nào.")
  }

  return {
    ...programDraft,
    workouts,
  }
}

// ── ExcelJS-based template download ──────────────────────────────────────────

function styleHeaderRow(sheet: import("exceljs").Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { vertical: "middle" }
  })
  sheet.getRow(1).height = 20
}

async function buildCoachProgramTemplate(
  exercises: ExerciseVariationOption[],
  trainees: CoachTrainee[],
) {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "YeahBuddy"
  workbook.created = new Date()

  const exerciseCount = exercises.length

  // ── 1. Program sheet ──────────────────────────────────────────────────────
  const programSheet = workbook.addWorksheet(PROGRAM_SHEET_NAME)
  programSheet.columns = [
    { header: "field", key: "field", width: 22 },
    { header: "value", key: "value", width: 70 },
  ]
  styleHeaderRow(programSheet)

  const programFieldData: Array<[string, string]> = [
    ["name", "Sample 4-Day Strength Program"],
    ["description", "Sample schedule generated from your exercise library. Edit before importing."],
    ["duration_weeks", "8"],
    ["difficulty", "intermediate"],
    ["assign_to_emails", ""],
  ]
  programFieldData.forEach(([f, v]) => programSheet.addRow([f, v]))
  programSheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]

  // A single authored week; the app expands it and export creates later weeks.
  const workoutsSheet = workbook.addWorksheet("Week 1")
  const headers = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Rest (s)", "Note"]
  const widths = [7, 20, 44, 22, 38, 8, 12, 12, 44, 16, 16, 16, 16, 16, 8, 12, 30]
  const LAST_COLUMN = headers.length

  // Palette the coach set on their own copy: banner and header in blue, and day
  // blocks alternating green and yellow so a session reads as one band.
  const BANNER_FILL = "FF00B0F0"
  const DAY_FILLS = ["FF00B050", "FFFFFF00"]
  type BorderSide = NonNullable<import("exceljs").Borders["top"]>
  const MEDIUM: BorderSide = { color: { argb: "FF000000" }, style: "medium" }
  const THIN: BorderSide = { style: "thin" }
  /** Only the two text columns are left aligned; every other column is centred. */
  const LEFT_ALIGNED = new Set([2, 3])

  const paint = (row: number, column: number, fill: string) => {
    const cell = workoutsSheet.getCell(row, column)
    cell.fill = { fgColor: { argb: fill }, pattern: "solid", type: "pattern" }

    return cell
  }

  workoutsSheet.getCell(1, 1).value = "Week 1"
  workoutsSheet.mergeCells(1, 1, 1, 3)
  workoutsSheet.getRow(1).height = 18.4
  // Centring is set on the whole banner row, while the blue fill stops at column 3.
  workoutsSheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" }

  // The banner is deliberately narrow: it fills only the three merged columns,
  // leaving the rest of the row blank above the header.
  for (let column = 1; column <= 3; column += 1) {
    const cell = paint(1, column, BANNER_FILL)
    cell.font = { bold: true, color: { theme: 1 }, family: 2, name: "Calibri", scheme: "minor", size: 14 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = { bottom: MEDIUM }
  }

  workoutsSheet.addRow(headers)
  widths.forEach((width, index) => { workoutsSheet.getColumn(index + 1).width = width })
  workoutsSheet.getColumn(5).hidden = true
  workoutsSheet.mergeCells(2, 10, 2, 14)
  workoutsSheet.getRow(2).height = 28.05

  for (let column = 1; column <= LAST_COLUMN; column += 1) {
    const cell = paint(2, column, BANNER_FILL)
    cell.font = { bold: true, name: "Calibri", size: 11 }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = {
      bottom: MEDIUM,
      left: column === 1 ? MEDIUM : THIN,
      right: column === LAST_COLUMN ? MEDIUM : THIN,
      top: MEDIUM,
    }
  }

  const referenceLastRow = Math.max(2, exerciseCount + 1)
  workbook.definedNames.add(`'Exercise Table'!$D$2:$D$${referenceLastRow}`, "ExerciseChoices")

  for (let day = 1; day <= 6; day++) {
    const firstRow = 3 + (day - 1) * 8
    const lastRow = firstRow + 7
    const dayFill = DAY_FILLS[(day - 1) % DAY_FILLS.length]

    workoutsSheet.mergeCells(firstRow, 1, lastRow, 1)
    workoutsSheet.getCell(firstRow, 1).value = day

    for (let row = firstRow; row <= lastRow; row++) {
      workoutsSheet.getCell(row, 3).dataValidation = { type: "list", allowBlank: true, formulae: ["ExerciseChoices"], showErrorMessage: true, errorStyle: "stop", errorTitle: "Choose an exercise", error: "Select an exercise from the library." }

      // Muscle Group, Variation and the hidden id all derive from the chosen exercise.
      for (const [column, referenceColumn] of [[2, "E"], [4, "C"], [5, "A"]] as const) {
        workoutsSheet.getCell(row, column).value = { formula: `IFERROR(INDEX('Exercise Table'!$${referenceColumn}$2:$${referenceColumn}$${referenceLastRow},MATCH(C${row},'Exercise Table'!$D$2:$D$${referenceLastRow},0)),"")`, result: "" }
      }

      for (let column = 1; column <= LAST_COLUMN; column += 1) {
        // The Day column is one merged cell per block, so only its master row
        // carries a border; writing to the covered rows fights the merge.
        if (column === 1 && row !== firstRow) {
          paint(row, column, dayFill)
          continue
        }

        const cell = paint(row, column, dayFill)
        cell.alignment = { horizontal: LEFT_ALIGNED.has(column) ? "left" : "center", vertical: "middle" }
        // Medium rules box each day block in; thin lines separate cells inside it.
        cell.border = {
          bottom: column === 1 ? THIN : row === lastRow ? MEDIUM : THIN,
          left: column === 1 ? MEDIUM : THIN,
          right: column === LAST_COLUMN ? MEDIUM : THIN,
          top: row === firstRow ? MEDIUM : THIN,
        }
      }

      workoutsSheet.getRow(row).height = 24
    }
  }

  workoutsSheet.views = [{ state: "frozen", xSplit: 3, ySplit: 2 }]
  workbook.calcProperties.fullCalcOnLoad = true

  // ── 3. Instructions sheet ─────────────────────────────────────────────────
  const instructionsSheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME)
  instructionsSheet.columns = [{ header: "Coach program import template", key: "text", width: 110 }]
  instructionsSheet.getRow(1).font = { bold: true, size: 13 }
  const instructions = [
    "1. Fill Program metadata, then author Week 1 only. The app repeats the template for the requested weeks.",
    "2. Select Exercise from the dropdown. Muscle Group, Variation and the hidden ID are formulas.",
    "3. Fill Sets, Rep Range, Weight (kg), RIR, Rest (s) and Note. Keep prescription columns in order.",
    "4. Leave Substitute Exercise and Actual rep per weight blank; completed sessions fill these cells.",
    "5. Each trainee uses a separate spreadsheet. Export creates Week N and extra set columns when needed.",
    "6. If converting through Google Sheets, check the exercise dropdowns; conversion may remove validation.",
  ]
  instructions.forEach((text) => instructionsSheet.addRow([text]))

  // ── 4. Reference sheet ────────────────────────────────────────────────────
  const referenceSheet = workbook.addWorksheet(REFERENCE_SHEET_NAME)
  referenceSheet.columns = [
    { header: "variation_id", key: "variation_id", width: 40 },
    { header: "exercise_name", key: "exercise_name", width: 28 },
    { header: "variation_name", key: "variation_name", width: 22 },
    { header: "display_name", key: "display_name", width: 36 },
    { header: "muscle_group", key: "muscle_group", width: 18 },
    { header: "equipment", key: "equipment", width: 18 },
  ]
  styleHeaderRow(referenceSheet)
  const sortedReferenceExercises = [...exercises].sort((a, b) => {
    const muscleGroupComparison = a.muscleGroup.localeCompare(b.muscleGroup, undefined, { sensitivity: "base" })

    if (muscleGroupComparison !== 0) {
      return muscleGroupComparison
    }

    const exerciseNameComparison = a.exerciseName.localeCompare(b.exerciseName, undefined, { sensitivity: "base" })

    if (exerciseNameComparison !== 0) {
      return exerciseNameComparison
    }

    return a.variationName.localeCompare(b.variationName, undefined, { sensitivity: "base" })
  })

  sortedReferenceExercises.forEach((ex) => {
    referenceSheet.addRow([ex.id, ex.exerciseName, ex.variationName, ex.name, ex.muscleGroup, ex.equipment ?? ""])
  })
  referenceSheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }]

  // ── 5. Trainees sheet ─────────────────────────────────────────────────────
  const traineesSheet = workbook.addWorksheet(TRAINEES_SHEET_NAME)
  traineesSheet.columns = [
    { header: "trainee_name", key: "trainee_name", width: 28 },
    { header: "email", key: "email", width: 34 },
  ]
  styleHeaderRow(traineesSheet)
  trainees.forEach((t) => traineesSheet.addRow([t.name, t.email]))
  traineesSheet.views = [{ state: "frozen", ySplit: 1 }]

  return workbook
}

async function downloadCoachProgramTemplate(exercises: ExerciseVariationOption[], trainees: CoachTrainee[]) {
  const workbook = await buildCoachProgramTemplate(exercises, trainees)
  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "coach-program-template.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

export { buildCoachProgramTemplate, downloadCoachProgramTemplate, importCoachProgramTemplate }
export type { ImportedProgramDraft }
