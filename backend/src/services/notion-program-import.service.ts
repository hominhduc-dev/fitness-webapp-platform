import { ProgramDifficulty } from "@prisma/client"

import {
  extractNotionIdFromInput,
  isNotionConfigured,
  queryDatabase,
  readPropertyNumber,
  readPropertyText,
  readRelationIds,
  requireNotionConfig,
} from "../lib/notion"
import type { NotionPage } from "../lib/notion"
import type { SerializedProfile } from "./auth.service"
import { BadRequestError, ConflictError, NotFoundError } from "./errors"
import { updateCoachProgram } from "./fitness-data/program"
import { assertCoach, ensurePrisma } from "./fitness-data/shared/guards"

/**
 * Imports coach program templates authored in Notion.
 *
 * This service only *reads and normalises* Notion. It deliberately stops short of
 * resolving exercise names to variation ids or writing anything to the database:
 * the browser already owns that step for the Excel importer (see
 * `components/coach/program-excel.ts`), and both sources share it so a coach sees
 * the same review screen either way.
 */

const TEMPLATE_PROPERTIES = {
  description: "Description",
  difficulty: "Difficulty",
  duration: "Duration",
  name: "Name",
  status: "Status",
} as const

const ROW_PROPERTIES = {
  day: "Day",
  exercise: "Exercise",
  notes: "Notes",
  order: "Order",
  program: "Program",
  reps: "Reps",
  rest: "Rest",
  rir: "RIR",
  sets: "Sets",
  variation: "Variation",
  week: "Week",
  weight: "Weight",
  workout: "Workout",
} as const

/** Only templates the coach marked as finished show up in the picker. */
const READY_STATUS = "ready"

type NotionProgramTemplate = {
  description: string
  difficulty: ProgramDifficulty
  duration: number
  lastEditedTime?: string
  name: string
  notionPageId: string
  notionUrl?: string
}

/**
 * One exercise inside one workout. Mirrors the row shape the Excel parser emits so
 * the shared client-side mapper accepts both without a translation layer.
 */
type NotionProgramRow = {
  exerciseName: string
  notes: string
  order?: number
  reps: string
  rest?: number
  rir?: number
  /** 1-7. Which session of the week this exercise belongs to. */
  scheduledDay?: number
  sets?: number
  /** Source row number, used verbatim in the error messages the coach reads. */
  sourceRow: number
  variationName: string
  /** Absent when the template describes a single week that repeats. */
  week?: number
  weight?: number
  workoutName: string
}

/** A program this coach already imported from the same Notion template. */
type ExistingImportedProgram = {
  archivedAt: string | null
  /** How many trainees currently follow it. Overwriting affects all of them. */
  assignedTraineeCount: number
  id: string
  name: string
  notionSyncedAt: string | null
}

type NotionProgramImport = {
  /** Non-null when this template was imported before; the dialog then asks. */
  existingProgram: ExistingImportedProgram | null
  program: NotionProgramTemplate
  rows: NotionProgramRow[]
  /** Non-fatal problems. The import still proceeds; the dialog shows these. */
  warnings: string[]
  /** True when no row carried a Week, so the rows describe one repeating week. */
  weekTemplateMode: boolean
}

function parseDifficulty(value: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === "intermediate" || normalized === "advanced" || normalized === "beginner") {
    return normalized as ProgramDifficulty
  }

  return undefined
}

function toTemplate(page: NotionPage): NotionProgramTemplate | undefined {
  const name = readPropertyText(page, TEMPLATE_PROPERTIES.name)

  if (!name) {
    return undefined
  }

  const duration = readPropertyNumber(page, TEMPLATE_PROPERTIES.duration)

  return {
    description: readPropertyText(page, TEMPLATE_PROPERTIES.description),
    difficulty: parseDifficulty(readPropertyText(page, TEMPLATE_PROPERTIES.difficulty)) ?? ProgramDifficulty.beginner,
    duration: duration && duration > 0 ? Math.round(duration) : 1,
    lastEditedTime: page.last_edited_time,
    name,
    notionPageId: page.id,
    notionUrl: page.url,
  }
}

/** Lists every template marked `ready`, newest edit first. */
async function listNotionProgramTemplates(profile: SerializedProfile) {
  assertCoach(profile)

  const { programDbId, token } = requireNotionConfig()

  const pages = await queryDatabase(programDbId, token, {
    sorts: [{ direction: "descending", timestamp: "last_edited_time" }],
  })

  return pages
    .filter((page) => {
      const status = readPropertyText(page, TEMPLATE_PROPERTIES.status).trim().toLowerCase()

      // An empty Status is treated as ready so a coach who skipped the column is
      // not left staring at an empty picker.
      return !status || status === READY_STATUS
    })
    .map(toTemplate)
    .filter((template): template is NotionProgramTemplate => Boolean(template))
}

function toRow(page: NotionPage, sourceRow: number): NotionProgramRow {
  const week = readPropertyNumber(page, ROW_PROPERTIES.week)
  const day = readPropertyNumber(page, ROW_PROPERTIES.day)
  const order = readPropertyNumber(page, ROW_PROPERTIES.order)
  const sets = readPropertyNumber(page, ROW_PROPERTIES.sets)
  const rir = readPropertyNumber(page, ROW_PROPERTIES.rir)
  const rest = readPropertyNumber(page, ROW_PROPERTIES.rest)
  const weight = readPropertyNumber(page, ROW_PROPERTIES.weight)

  return {
    exerciseName: readPropertyText(page, ROW_PROPERTIES.exercise),
    notes: readPropertyText(page, ROW_PROPERTIES.notes),
    order: order === undefined ? undefined : Math.round(order),
    // Kept as text so ranges like "8-12" survive; the client parses it with the
    // same helper the Excel importer uses.
    reps: readPropertyText(page, ROW_PROPERTIES.reps),
    rest: rest === undefined ? undefined : Math.round(rest),
    rir: rir === undefined ? undefined : Math.round(rir),
    scheduledDay: day === undefined ? undefined : Math.round(day),
    sets: sets === undefined ? undefined : Math.round(sets),
    sourceRow,
    variationName: readPropertyText(page, ROW_PROPERTIES.variation),
    week: week === undefined ? undefined : Math.round(week),
    weight,
    workoutName: readPropertyText(page, ROW_PROPERTIES.workout),
  }
}

/**
 * Rejects a template that fills `Week` on some rows but not others. Half-filled
 * weeks are ambiguous: the missing rows could mean "week 1" or "every week", and
 * guessing either way silently produces a wrong program.
 */
function assertConsistentWeeks(rows: NotionProgramRow[]) {
  const withWeek = rows.filter((row) => row.week !== undefined)

  if (withWeek.length === 0) {
    return { weekTemplateMode: true }
  }

  if (withWeek.length !== rows.length) {
    const missing = rows.filter((row) => row.week === undefined).map((row) => row.sourceRow)

    throw new BadRequestError(
      "Cột Week phải điền ở tất cả dòng hoặc bỏ trống ở tất cả dòng, không được trộn lẫn.",
      {
        code: "NOTION_MIXED_WEEK_COLUMN",
        details: { rowsMissingWeek: missing.slice(0, 50) },
      },
    )
  }

  return { weekTemplateMode: false }
}

function collectWarnings(rows: NotionProgramRow[], program: NotionProgramTemplate, weekTemplateMode: boolean) {
  const warnings: string[] = []

  const missingSets = rows.filter((row) => !row.sets || row.sets <= 0)

  if (missingSets.length > 0) {
    warnings.push(`${missingSets.length} dòng thiếu số Sets hợp lệ, sẽ mặc định là 1 set.`)
  }

  const missingDay = rows.filter((row) => row.scheduledDay === undefined)

  if (missingDay.length > 0) {
    warnings.push(`${missingDay.length} dòng thiếu cột Day, các dòng này sẽ gom vào cùng một buổi.`)
  }

  if (!weekTemplateMode) {
    const outOfRange = rows.filter((row) => row.week !== undefined && (row.week < 1 || row.week > program.duration))

    if (outOfRange.length > 0) {
      warnings.push(
        `${outOfRange.length} dòng có Week nằm ngoài khoảng 1 đến ${program.duration} của program.`,
      )
    }
  }

  return warnings
}

/**
 * Looks for a program this coach already imported from the same Notion template.
 *
 * Archived programs count: a coach who archived last month's import still needs to
 * be told it exists, otherwise the unique index rejects the second import with a
 * database error instead of a question.
 */
async function findExistingImport(coachId: string, notionSourceId: string) {
  const db = ensurePrisma()

  const program = await db.program.findFirst({
    select: {
      _count: { select: { assignments: true } },
      archivedAt: true,
      id: true,
      name: true,
      notionSyncedAt: true,
    },
    where: {
      createdById: coachId,
      notionSourceId,
    },
  })

  if (!program) {
    return null
  }

  const existing: ExistingImportedProgram = {
    archivedAt: program.archivedAt?.toISOString() ?? null,
    assignedTraineeCount: program._count.assignments,
    id: program.id,
    name: program.name,
    notionSyncedAt: program.notionSyncedAt?.toISOString() ?? null,
  }

  return existing
}

/**
 * Reads one template and every row that points at it.
 *
 * The rows database is queried with a relation filter rather than reading the
 * relation property on the template page: that property returns at most 100
 * linked pages, which an 8-week program exceeds.
 */
async function importNotionProgram(profile: SerializedProfile, input: { template: string }) {
  assertCoach(profile)

  const { programDbId, rowsDbId, token } = requireNotionConfig()

  const templateId = extractNotionIdFromInput(input.template)

  if (!templateId) {
    throw new BadRequestError("Link hoặc ID Notion không hợp lệ.", { code: "NOTION_INVALID_ID" })
  }

  const templatePages = await queryDatabase(programDbId, token, {
    filter: {
      property: TEMPLATE_PROPERTIES.name,
      title: { is_not_empty: true },
    },
  })

  const templatePage = templatePages.find((page) => page.id === templateId)

  if (!templatePage) {
    throw new NotFoundError("Không tìm thấy program mẫu này trong database Notion đã cấu hình.", {
      code: "NOTION_TEMPLATE_NOT_FOUND",
    })
  }

  const program = toTemplate(templatePage)

  if (!program) {
    throw new BadRequestError("Program mẫu trên Notion chưa có tên.", { code: "NOTION_TEMPLATE_INVALID" })
  }

  const rowPages = await queryDatabase(rowsDbId, token, {
    filter: {
      property: ROW_PROPERTIES.program,
      relation: { contains: templateId },
    },
  })

  const rows = rowPages
    .filter((page) => readRelationIds(page, ROW_PROPERTIES.program).includes(templateId))
    .map((page, index) => toRow(page, index + 1))
    .filter((row) => row.exerciseName || row.variationName)

  if (rows.length === 0) {
    throw new BadRequestError("Program mẫu này chưa có dòng bài tập nào trong database Program Rows.", {
      code: "NOTION_TEMPLATE_EMPTY",
    })
  }

  const { weekTemplateMode } = assertConsistentWeeks(rows)

  rows.sort((left, right) =>
    (left.week ?? 0) - (right.week ?? 0) ||
    (left.scheduledDay ?? 0) - (right.scheduledDay ?? 0) ||
    (left.order ?? 0) - (right.order ?? 0) ||
    left.sourceRow - right.sourceRow)

  const result: NotionProgramImport = {
    existingProgram: await findExistingImport(profile.id, templateId),
    program,
    rows,
    warnings: collectWarnings(rows, program, weekTemplateMode),
    weekTemplateMode,
  }

  return result
}

type OverwriteInput = {
  assignToUserIds?: string[]
  description?: string | null
  difficulty: ProgramDifficulty
  duration: number
  name: string
  notionSourceId: string
  programId: string
  workouts: Parameters<typeof updateCoachProgram>[2]["workouts"]
}

/**
 * Replaces an already-imported program with a fresh read of the same template.
 *
 * Delegates the write to `updateCoachProgram`, which swaps the workout tree while
 * keeping `ProgramAssignment.assignedAt` intact. Recreating assignments instead
 * would reset every trainee's start date and corrupt weekly-schedule windowing.
 */
async function overwriteNotionProgram(profile: SerializedProfile, input: OverwriteInput) {
  assertCoach(profile)

  const db = ensurePrisma()

  const notionSourceId = extractNotionIdFromInput(input.notionSourceId)

  if (!notionSourceId) {
    throw new BadRequestError("Link hoặc ID Notion không hợp lệ.", { code: "NOTION_INVALID_ID" })
  }

  const target = await db.program.findFirst({
    select: {
      archivedAt: true,
      assignments: { select: { userId: true } },
      id: true,
      notionSourceId: true,
    },
    where: {
      createdById: profile.id,
      id: input.programId,
    },
  })

  if (!target) {
    throw new NotFoundError("Không tìm thấy chương trình.")
  }

  // Guards against a client that pairs a template with somebody else's program id,
  // or with a program that was never imported from Notion.
  if (target.notionSourceId !== notionSourceId) {
    throw new ConflictError("Chương trình này không được import từ program mẫu Notion đã chọn.", {
      code: "NOTION_SOURCE_MISMATCH",
    })
  }

  if (target.archivedAt) {
    throw new ConflictError("Program đang ở trạng thái lưu trữ. Hãy restore trước khi ghi đè.", {
      code: "PROGRAM_ARCHIVED",
    })
  }

  // `updateCoachProgram` reads a missing list as "assign nobody" and unassigns every
  // trainee. Re-sending the current assignments keeps overwriting a content-only
  // operation, which is what the coach is asking for.
  const assignToUserIds = input.assignToUserIds ?? target.assignments.map((assignment) => assignment.userId)

  const program = await updateCoachProgram(profile, target.id, {
    assignToUserIds,
    description: input.description,
    difficulty: input.difficulty,
    duration: input.duration,
    name: input.name,
    workouts: input.workouts,
  })

  await db.program.update({
    data: { notionSyncedAt: new Date() },
    where: { id: target.id },
  })

  return program
}

export { importNotionProgram, isNotionConfigured, listNotionProgramTemplates, overwriteNotionProgram }
export type { NotionProgramImport, NotionProgramRow, NotionProgramTemplate }
