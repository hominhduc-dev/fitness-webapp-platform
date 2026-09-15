import { randomInt } from "node:crypto"
import {
  batchUpdateSpreadsheet,
  createSpreadsheet,
  fetchSpreadsheetMeta,
  findOrCreateDriveFolder,
  moveFileToFolder,
  updateSpreadsheetValues,
} from "../lib/google"
import { logger } from "../lib/logger"
import type { SerializedProfile } from "./auth.service"
import { BadRequestError } from "./errors"
import { getGoogleAccessToken } from "./google-connection.service"
import { formatSetResult, formatSubstitute, type ExportExercise } from "./google-program-export.service"
import { addUtcDays, DAY_IN_MS, formatUtcDateOnly, startOfUtcWeek } from "./fitness-data/shared/dates"
import { assertTrainee, ensurePrisma } from "./fitness-data/shared/guards"

/**
 * Exports a trainee's own workout logs into their own Google Drive.
 *
 * One spreadsheet per assigned program, remembered on the assignment. Each
 * program week gets a `Week N` tab laid out like the coach's program sheet
 * (Day / Exercise / Sets / Rep Range … / Actual rep per weight … / RIR), so the
 * file reads the same as the sheet a coach imports from — and stays parseable
 * by `parseGoogleProgramRows`.
 *
 * The app owns this file, so a week tab is rebuilt from the database on every
 * export rather than patched cell by cell: the result is always the latest
 * state of that week, however many times it is exported.
 */

export const TRAINEE_EXPORT_FOLDER_NAME = "YeahBuddy workout logs"
const OVERVIEW_SHEET_TITLE = "Program"
const MIN_SET_COLUMNS = 5
/** Columns A–I come before the per-set result columns. */
const LEADING_COLUMNS = 9
const TRAILING_HEADERS = ["RIR", "Method", "Rest (s)", "Note"]
const ADDED_EXERCISE_NOTE = "Added during session"

const BANNER_COLOR = { blue: 0.9412, green: 0.6902, red: 0 }
const HEADER_FILL_COLOR = { blue: 0.102, green: 0.102, red: 0.102 }
const HEADER_TEXT_COLOR = { blue: 1, green: 1, red: 1 }
const DAY_COLORS = [
  { blue: 0.85, green: 0.95, red: 0.85 },
  { blue: 0.8, green: 1, red: 1 },
]
const COLUMN_WIDTHS = [56, 120, 220, 150, 40, 56, 80, 80, 200]
const SET_COLUMN_WIDTH = 100
const TRAILING_WIDTHS = [56, 110, 70, 220]

export type PlanExercise = {
  exerciseName: string
  method?: string
  muscleGroup: string
  notes?: string
  order: number
  repRange: string
  restTime?: number
  rir?: number
  sets: number
  variationId: string
  variationName: string
  weight?: number
}
export type PlanDay = { day: number; exercises: PlanExercise[] }
export type LoggedSession = { day: number; exercises: ExportExercise[] }

type GridRow = { plan?: PlanExercise; result?: ExportExercise }

export function weekSheetTitle(weekIndex: number) {
  return `Week ${weekIndex + 1}`
}

/** Sunday arrives as 0 from `getUTCDay`; it sorts and reads as the week's last day. */
function normalizeDay(day: number) {
  return day === 0 ? 7 : day
}

/**
 * Lays out one week: the planned exercises, with each logged exercise written
 * onto its planned row.
 *
 * A logged exercise matches by its original variation (so a mid-session swap
 * still lands on the planned row and is named under Substitute Exercise), and by
 * order when the same variation appears twice in a day. Exercises the trainee
 * added are appended under that day rather than dropped.
 */
export function buildTraineeWeekGrid(weekIndex: number, plan: PlanDay[], sessions: LoggedSession[]) {
  const days = new Map<number, GridRow[]>()

  for (const day of plan) {
    const rows = days.get(day.day) ?? []
    rows.push(...[...day.exercises].sort((left, right) => left.order - right.order).map((exercise) => ({ plan: exercise })))
    days.set(day.day, rows)
  }

  let resultRowCount = 0

  for (const session of sessions) {
    const rows = days.get(session.day) ?? []
    days.set(session.day, rows)
    const exercises = [...session.exercises].sort(
      (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
    )

    for (const exercise of exercises) {
      const hasResult = exercise.sets.some((set) => set.completed)
      const variationId = exercise.originalVariationId ?? exercise.variation?.id
      const open = rows.filter((row) => row.plan && !row.result && row.plan.variationId === variationId)
      const match = open.find((row) => row.plan!.order === exercise.order) ?? open[0]

      if (match) {
        match.result = exercise
      } else if (hasResult) {
        rows.push({ result: exercise })
      } else {
        continue
      }

      if (hasResult) resultRowCount += 1
    }
  }

  const orderedDays = [...days.entries()].filter(([, rows]) => rows.length > 0).sort(([left], [right]) => left - right)
  const setColumns = Math.max(
    MIN_SET_COLUMNS,
    ...orderedDays.flatMap(([, rows]) =>
      rows.flatMap((row) => [row.plan?.sets ?? 0, ...(row.result?.sets.map((set) => set.setNumber) ?? [])]),
    ),
  )

  const header = [
    "Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise",
    "Actual rep per weight", ...Array<string>(setColumns - 1).fill(""),
    ...TRAILING_HEADERS,
  ]
  const values: Array<Array<string | number>> = [[weekSheetTitle(weekIndex)], header]
  const dayBlocks: Array<{ endRowIndex: number; startRowIndex: number }> = []

  for (const [day, rows] of orderedDays) {
    const startRowIndex = values.length

    rows.forEach(({ plan, result }, index) => {
      const setCells = Array<string>(setColumns).fill("")
      for (const set of result?.sets ?? []) {
        if (Number.isInteger(set.setNumber) && set.setNumber >= 1 && set.setNumber <= setColumns) {
          setCells[set.setNumber - 1] = formatSetResult(set)
        }
      }

      values.push([
        index === 0 ? day : "",
        plan?.muscleGroup ?? result?.exercise?.muscleGroup ?? "",
        plan?.exerciseName ?? result?.exercise?.name ?? "",
        plan?.variationName ?? result?.variation?.name ?? "",
        plan?.variationId ?? result?.originalVariationId ?? result?.variation?.id ?? "",
        plan?.sets ?? result?.sets.length ?? "",
        plan?.repRange ?? "",
        plan?.weight ?? "",
        result ? formatSubstitute(result) : "",
        ...setCells,
        plan?.rir ?? "",
        plan?.method ?? "",
        plan?.restTime ?? "",
        plan ? (plan.notes ?? "") : ADDED_EXERCISE_NOTE,
      ])
    })

    dayBlocks.push({ endRowIndex: values.length, startRowIndex })
  }

  return { columnCount: header.length, dayBlocks, resultRowCount, setColumns, values }
}

type PlanWorkout = {
  exercises: Array<{
    notes: string | null
    order: number
    originalVariationId: string | null
    restTime: number | null
    sets: Array<{
      intensityTag: string | null
      rir: number | null
      setNumber: number
      targetReps: number
      targetRepsMin: number | null
      weight: number | null
    }>
    variation: { exercise: { muscleGroup: string; name: string }; id: string; name: string }
  }>
  scheduledDate: Date | null
  scheduledDay: number | null
  weekIndex: number | null
}

/**
 * The workouts that make up program week `weekIndex`, matching what the trainee
 * was shown: a week the coach did not author repeats the last authored week
 * before it, and dated workouts belong to the calendar week they fall in.
 */
export function selectPlanWorkoutsForWeek<T extends Pick<PlanWorkout, "scheduledDate" | "weekIndex">>(
  workouts: T[],
  weekIndex: number,
  weekStart: Date,
) {
  const weekEnd = addUtcDays(weekStart, 7)
  const recurring = workouts.filter((workout) => !workout.scheduledDate)
  const authoredWeeks = [...new Set(recurring.map((workout) => Math.max(0, Math.round(workout.weekIndex ?? 0))))]
  const atOrBefore = authoredWeeks.filter((week) => week <= weekIndex)
  const effectiveWeek = atOrBefore.length > 0 ? Math.max(...atOrBefore) : Math.min(...authoredWeeks)

  return workouts.filter((workout) =>
    workout.scheduledDate
      ? workout.scheduledDate >= weekStart && workout.scheduledDate < weekEnd
      : Math.max(0, Math.round(workout.weekIndex ?? 0)) === effectiveWeek,
  )
}

function toPlanDays(workouts: PlanWorkout[]): PlanDay[] {
  const days = new Map<number, PlanExercise[]>()

  for (const workout of workouts) {
    const day = normalizeDay(workout.scheduledDate ? workout.scheduledDate.getUTCDay() : (workout.scheduledDay ?? 0))
    const exercises = days.get(day) ?? []

    for (const exercise of workout.exercises) {
      const first = exercise.sets[0]
      const methods = exercise.sets.flatMap((set) => (set.intensityTag ? [`${set.setNumber}:${set.intensityTag}`] : []))
      exercises.push({
        exerciseName: exercise.variation.exercise.name,
        method: methods.length ? methods.join(",") : undefined,
        muscleGroup: exercise.variation.exercise.muscleGroup,
        notes: exercise.notes ?? undefined,
        order: exercise.order,
        repRange: first
          ? first.targetRepsMin != null && first.targetRepsMin !== first.targetReps
            ? `${first.targetRepsMin}-${first.targetReps}`
            : String(first.targetReps)
          : "",
        restTime: exercise.restTime ?? undefined,
        rir: first?.rir ?? undefined,
        sets: exercise.sets.length,
        // The same key a log uses, so a coach-side swap still lines up.
        variationId: exercise.originalVariationId ?? exercise.variation.id,
        variationName: exercise.variation.name,
        weight: first?.weight ?? undefined,
      })
    }

    days.set(day, exercises)
  }

  return [...days.entries()].map(([day, exercises]) => ({ day, exercises }))
}

/** Which program week and day a log belongs to, from the day it was planned for. */
export function resolveLogPosition(
  log: { plannedDate: Date | null; startedAt: Date; workoutSnapshot: unknown },
  anchorWeekStart: Date,
) {
  const date = log.plannedDate ?? log.startedAt
  const weekIndex = Math.floor((startOfUtcWeek(date).getTime() - anchorWeekStart.getTime()) / (7 * DAY_IN_MS))
  const scheduledDay = (log.workoutSnapshot as { scheduledDay?: unknown } | null)?.scheduledDay
  const day = normalizeDay(typeof scheduledDay === "number" && Number.isInteger(scheduledDay) ? scheduledDay : date.getUTCDay())

  return { day, weekIndex }
}

export function buildWeekFormatRequests(sheetId: number, grid: ReturnType<typeof buildTraineeWeekGrid>) {
  const requests: unknown[] = [
    {
      repeatCell: {
        cell: { userEnteredFormat: { backgroundColor: BANNER_COLOR, textFormat: { bold: true, fontSize: 14 } } },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
        range: { endColumnIndex: 3, endRowIndex: 1, sheetId, startColumnIndex: 0, startRowIndex: 0 },
      },
    },
    {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_FILL_COLOR,
            horizontalAlignment: "CENTER",
            textFormat: { bold: true, foregroundColor: HEADER_TEXT_COLOR },
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,verticalAlignment,wrapStrategy)",
        range: { endColumnIndex: grid.columnCount, endRowIndex: 2, sheetId, startColumnIndex: 0, startRowIndex: 1 },
      },
    },
    {
      mergeCells: {
        mergeType: "MERGE_ALL",
        range: { endColumnIndex: LEADING_COLUMNS + grid.setColumns, endRowIndex: 2, sheetId, startColumnIndex: LEADING_COLUMNS, startRowIndex: 1 },
      },
    },
    // Column E is the variation id: kept for tooling, hidden from the reader.
    {
      updateDimensionProperties: {
        fields: "hiddenByUser",
        properties: { hiddenByUser: true },
        range: { dimension: "COLUMNS", endIndex: 5, sheetId, startIndex: 4 },
      },
    },
  ]

  const widths = [...COLUMN_WIDTHS, ...Array<number>(grid.setColumns).fill(SET_COLUMN_WIDTH), ...TRAILING_WIDTHS]
  widths.forEach((pixelSize, index) => {
    requests.push({
      updateDimensionProperties: {
        fields: "pixelSize",
        properties: { pixelSize },
        range: { dimension: "COLUMNS", endIndex: index + 1, sheetId, startIndex: index },
      },
    })
  })

  grid.dayBlocks.forEach(({ endRowIndex, startRowIndex }, index) => {
    const range = { endColumnIndex: grid.columnCount, endRowIndex, sheetId, startColumnIndex: 0, startRowIndex }
    requests.push({
      repeatCell: {
        cell: { userEnteredFormat: { backgroundColor: DAY_COLORS[index % DAY_COLORS.length], verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat(backgroundColor,verticalAlignment)",
        range,
      },
    })
    if (endRowIndex - startRowIndex > 1) {
      requests.push({ mergeCells: { mergeType: "MERGE_COLUMNS", range: { ...range, endColumnIndex: 1 } } })
    }
    requests.push({
      updateBorders: {
        bottom: { style: "SOLID_MEDIUM" },
        innerHorizontal: { style: "SOLID" },
        innerVertical: { style: "SOLID" },
        left: { style: "SOLID_MEDIUM" },
        range,
        right: { style: "SOLID_MEDIUM" },
        top: { style: "SOLID_MEDIUM" },
      },
    })
  })

  return requests
}

const PLAN_WORKOUT_SELECT = {
  exercises: {
    orderBy: { order: "asc" as const },
    select: {
      notes: true,
      order: true,
      originalVariationId: true,
      restTime: true,
      sets: {
        orderBy: { setNumber: "asc" as const },
        select: { intensityTag: true, rir: true, setNumber: true, targetReps: true, targetRepsMin: true, weight: true },
      },
      variation: { select: { exercise: { select: { muscleGroup: true, name: true } }, id: true, name: true } },
    },
  },
  scheduledDate: true,
  scheduledDay: true,
  weekIndex: true,
}

type SheetRef = { sheetId: number; title: string }

function isMissingFile(error: unknown) {
  const details = (error as { details?: { status?: unknown } } | null)?.details
  return details?.status === 404
}

function nextSheetId(taken: Set<number>) {
  let sheetId: number
  do { sheetId = randomInt(1, 2_000_000_000) } while (taken.has(sheetId))
  taken.add(sheetId)
  return sheetId
}

function weekNumberOf(title: string) {
  const match = /^Week (\d+)$/.exec(title)
  return match ? Number(match[1]) : undefined
}

/**
 * Reuses the assignment's file, or creates one when there is none yet or the
 * trainee deleted it. The stored id changes only if nobody else changed it
 * first, so two exports racing cannot leave the assignment pointing at a file
 * the other one is still writing.
 */
async function ensureTraineeSpreadsheet(
  accessToken: string,
  profile: SerializedProfile,
  assignment: { id: string; program: { name: string }; traineeGoogleSpreadsheetId: string | null },
) {
  if (assignment.traineeGoogleSpreadsheetId) {
    try {
      const meta = await fetchSpreadsheetMeta(accessToken, assignment.traineeGoogleSpreadsheetId)
      return { created: false, sheets: meta.sheetProperties as SheetRef[], spreadsheetId: assignment.traineeGoogleSpreadsheetId }
    } catch (error) {
      if (!isMissingFile(error)) throw error
    }
  }

  const created = await createSpreadsheet(accessToken, `${assignment.program.name} — ${profile.name}`, [
    { properties: { gridProperties: { columnCount: 4, rowCount: 20 }, index: 0, title: OVERVIEW_SHEET_TITLE } },
  ])

  // The file is usable in My Drive root; filing it is a convenience.
  try {
    await moveFileToFolder(accessToken, created.spreadsheetId, await findOrCreateDriveFolder(accessToken, TRAINEE_EXPORT_FOLDER_NAME))
  } catch (error) {
    logger.warn("trainee export folder move failed", { error })
  }

  const saved = await ensurePrisma().programAssignment.updateMany({
    data: { traineeGoogleSpreadsheetId: created.spreadsheetId },
    where: { id: assignment.id, traineeGoogleSpreadsheetId: assignment.traineeGoogleSpreadsheetId },
  })

  if (!saved.count) {
    throw new BadRequestError("Một lượt export khác vừa tạo file cho chương trình này. Hãy thử lại.")
  }

  return {
    created: true,
    sheets: [...created.sheetIdsByTitle].map(([title, sheetId]) => ({ sheetId, title })),
    spreadsheetId: created.spreadsheetId,
  }
}

/**
 * Rebuilds the week tabs in place: each existing `Week N` is deleted and added
 * back at the same position in one atomic batch, then filled and formatted.
 * The overview tab is ensured first so a delete can never remove the last tab.
 */
async function writeWeekTabs(
  accessToken: string,
  spreadsheetId: string,
  existingSheets: SheetRef[],
  overview: Array<Array<string | number>>,
  grids: Array<{ grid: ReturnType<typeof buildTraineeWeekGrid>; weekIndex: number }>,
) {
  const sheets = [...existingSheets]
  const taken = new Set(sheets.map((sheet) => sheet.sheetId))
  const structure: unknown[] = []

  if (!sheets.some((sheet) => sheet.title === OVERVIEW_SHEET_TITLE)) {
    const sheetId = nextSheetId(taken)
    structure.push({ addSheet: { properties: { gridProperties: { columnCount: 4, rowCount: 20 }, index: 0, sheetId, title: OVERVIEW_SHEET_TITLE } } })
    sheets.unshift({ sheetId, title: OVERVIEW_SHEET_TITLE })
  }

  const sheetIdsByWeek = new Map<number, number>()

  for (const { grid, weekIndex } of grids) {
    const title = weekSheetTitle(weekIndex)
    const existingIndex = sheets.findIndex((sheet) => sheet.title === title)

    if (existingIndex >= 0) {
      structure.push({ deleteSheet: { sheetId: sheets[existingIndex].sheetId } })
      sheets.splice(existingIndex, 1)
    }

    const later = sheets.findIndex((sheet) => (weekNumberOf(sheet.title) ?? 0) > weekIndex + 1)
    const index = later >= 0 ? later : sheets.length
    const sheetId = nextSheetId(taken)
    structure.push({
      addSheet: {
        properties: {
          gridProperties: {
            columnCount: grid.columnCount + 2,
            frozenColumnCount: 3,
            frozenRowCount: 2,
            rowCount: Math.max(60, grid.values.length + 20),
          },
          index,
          sheetId,
          title,
        },
      },
    })
    sheets.splice(index, 0, { sheetId, title })
    sheetIdsByWeek.set(weekIndex, sheetId)
  }

  await batchUpdateSpreadsheet(accessToken, spreadsheetId, structure)

  // RAW: a rep range like "8-12" must not be read as a date.
  await updateSpreadsheetValues(
    accessToken,
    spreadsheetId,
    [
      { range: `'${OVERVIEW_SHEET_TITLE}'!A1`, values: overview },
      ...grids.map(({ grid, weekIndex }) => ({ range: `'${weekSheetTitle(weekIndex)}'!A1`, values: grid.values })),
    ],
    "RAW",
  )

  await batchUpdateSpreadsheet(
    accessToken,
    spreadsheetId,
    grids.flatMap(({ grid, weekIndex }) => buildWeekFormatRequests(sheetIdsByWeek.get(weekIndex)!, grid)),
  )
}

async function exportTraineeLogsToGoogleDrive(
  profile: SerializedProfile,
  input: { from: Date; programId?: string; to: Date },
) {
  assertTrainee(profile)
  const db = ensurePrisma()

  const rangeLogs = await db.workoutLog.findMany({
    select: { id: true, programId: true },
    where: {
      completedAt: { not: null },
      startedAt: { gte: input.from, lt: input.to },
      userId: profile.id,
      ...(input.programId ? { programId: input.programId } : {}),
    },
  })

  if (rangeLogs.length === 0) {
    throw new BadRequestError("Không có buổi tập đã hoàn thành trong khoảng thời gian này.")
  }

  const programIds = [...new Set(rangeLogs.flatMap((log) => (log.programId ? [log.programId] : [])))]
  const assignments = programIds.length
    ? await db.programAssignment.findMany({
        orderBy: { assignedAt: "asc" },
        select: {
          assignedAt: true,
          id: true,
          program: { select: { duration: true, id: true, name: true, startDate: true, workouts: { select: PLAN_WORKOUT_SELECT } } },
          traineeGoogleSpreadsheetId: true,
        },
        where: { programId: { in: programIds }, userId: profile.id },
      })
    : []

  if (assignments.length === 0) {
    throw new BadRequestError("Các buổi tập trong khoảng này không thuộc chương trình nào đang được giao, nên chưa có sheet để ghi.")
  }

  const accessToken = await getGoogleAccessToken(profile)
  const files: Array<{ created: boolean; name: string; programId: string; url: string; weeks: number[] }> = []
  let exportedLogCount = 0
  let rowCount = 0

  // Sequential: each file is its own set of Google writes, and a failure should
  // stop before touching the next program's file.
  for (const assignment of assignments) {
    const { program } = assignment
    const rangeIds = new Set(rangeLogs.filter((log) => log.programId === program.id).map((log) => log.id))
    if (rangeIds.size === 0) continue

    const anchorWeekStart = startOfUtcWeek(program.startDate ?? assignment.assignedAt)
    // Every completed log of the program, not only the range: a week tab is
    // rebuilt whole, so it must carry the sessions exported earlier too.
    const programLogs = await db.workoutLog.findMany({
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
      select: { exerciseSnapshot: true, id: true, plannedDate: true, startedAt: true, workoutSnapshot: true },
      where: { completedAt: { not: null }, programId: program.id, userId: profile.id },
    })

    const sessionsByWeek = new Map<number, Map<number, LoggedSession>>()
    const weeks = new Set<number>()

    for (const log of programLogs) {
      if (!Array.isArray(log.exerciseSnapshot)) continue
      const exercises = (log.exerciseSnapshot as unknown as ExportExercise[]).filter(
        (exercise) => exercise && Array.isArray(exercise.sets),
      )
      const { day, weekIndex } = resolveLogPosition(log, anchorWeekStart)
      if (weekIndex < 0) continue

      if (rangeIds.has(log.id)) {
        weeks.add(weekIndex)
        exportedLogCount += 1
      }

      // Later logs replace earlier ones for the same day: one result per session.
      const byDay = sessionsByWeek.get(weekIndex) ?? new Map<number, LoggedSession>()
      byDay.set(day, { day, exercises })
      sessionsByWeek.set(weekIndex, byDay)
    }

    if (weeks.size === 0) continue

    const grids = [...weeks].sort((left, right) => left - right).map((weekIndex) => {
      const weekStart = addUtcDays(anchorWeekStart, weekIndex * 7)
      const plan = toPlanDays(selectPlanWorkoutsForWeek(program.workouts, weekIndex, weekStart))
      const grid = buildTraineeWeekGrid(weekIndex, plan, [...(sessionsByWeek.get(weekIndex)?.values() ?? [])])
      rowCount += grid.resultRowCount
      return { grid, weekIndex }
    })

    const target = await ensureTraineeSpreadsheet(accessToken, profile, assignment)
    const overview: Array<Array<string | number>> = [
      ["field", "value"],
      ["program", program.name],
      ["trainee", profile.name],
      ["duration_weeks", program.duration],
      ["week_1_starts", formatUtcDateOnly(anchorWeekStart)],
      ["last_exported_at", new Date().toISOString()],
    ]

    await writeWeekTabs(accessToken, target.spreadsheetId, target.sheets, overview, grids)

    files.push({
      created: target.created,
      name: program.name,
      programId: program.id,
      url: `https://docs.google.com/spreadsheets/d/${target.spreadsheetId}/edit`,
      weeks: grids.map(({ weekIndex }) => weekIndex + 1),
    })
  }

  if (files.length === 0) {
    throw new BadRequestError("Không có buổi tập nào nằm trong thời gian của chương trình để ghi vào sheet.")
  }

  return {
    exported: true,
    files,
    logCount: exportedLogCount,
    rowCount,
    skippedLogCount: rangeLogs.length - exportedLogCount,
    spreadsheetUrl: files[0].url,
  }
}

export { exportTraineeLogsToGoogleDrive }
