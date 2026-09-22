import { copyDriveFile, shareDriveFile } from "../lib/google"
import { logger } from "../lib/logger"
import type { SerializedProfile } from "./auth.service"
import { BadRequestError } from "./errors"
import { getGoogleAccessToken } from "./google-connection.service"
import { groupLogsIntoSessions, writeSessionsToSpreadsheet } from "./google-program-export.service"
import { assertTrainee, ensurePrisma } from "./fitness-data/shared/guards"

/**
 * Exports a trainee's own workout logs into their own copy of the coach's
 * program sheet.
 *
 * The coach's sheet is the original: it is where the program was authored and
 * where the coach's own exports land. A trainee gets a copy of it, one per
 * assignment, remembered on the assignment and written to on every later
 * export. Same file, same layout, same rows — so a number means the same thing
 * whichever of the two people is looking at it.
 *
 * Every Google call here runs on the **coach's** token, not the trainee's. The
 * `drive.file` scope only reaches files the app created for the account asking,
 * and the program sheet was created for the coach, so a trainee's token cannot
 * copy it however the file is shared. The trainee is then given read access to
 * the copy, which is also why they no longer need a Google account of their own
 * to export.
 */

type AssignmentWithProgram = {
  id: string
  program: {
    createdById: string
    googleSheetName: string | null
    googleSpreadsheetId: string | null
    id: string
    name: string
  }
  traineeGoogleSpreadsheetId: string | null
}

/**
 * The trainee's own copy of the program sheet, made once and reused after.
 *
 * The id is claimed with a conditional write so two exports racing settle on
 * one copy. The loser's file is left in Drive — worth deleting once
 * `lib/google` can, but harmless until then.
 */
export async function ensureTraineeProgramCopy(
  coachToken: string,
  assignment: AssignmentWithProgram,
  trainee: { email: string; name: string },
) {
  if (assignment.traineeGoogleSpreadsheetId) {
    return assignment.traineeGoogleSpreadsheetId
  }

  const copyId = await copyDriveFile(
    coachToken,
    assignment.program.googleSpreadsheetId!,
    `${assignment.program.name} — ${trainee.name}`,
  )

  // Sharing is what makes the copy worth having, but a grant that fails still
  // leaves a correct file the coach can share by hand, so it must not lose the
  // export that already succeeded.
  try {
    await shareDriveFile(coachToken, copyId, trainee.email, "reader")
  } catch (error) {
    logger.warn("trainee sheet share failed", { copyId, error })
  }

  const saved = await ensurePrisma().programAssignment.updateMany({
    data: { traineeGoogleSpreadsheetId: copyId },
    where: { id: assignment.id, traineeGoogleSpreadsheetId: null },
  })

  if (!saved.count) {
    const current = await ensurePrisma().programAssignment.findUnique({
      select: { traineeGoogleSpreadsheetId: true },
      where: { id: assignment.id },
    })

    return current?.traineeGoogleSpreadsheetId ?? copyId
  }

  return copyId
}

async function exportTraineeLogsToGoogleDrive(
  profile: SerializedProfile,
  input: { from: Date; programId?: string; to: Date },
) {
  assertTrainee(profile)
  const db = ensurePrisma()

  const rangeLogs = await db.workoutLog.findMany({
    orderBy: { startedAt: "asc" },
    select: { exerciseSnapshot: true, id: true, programId: true, workoutSnapshot: true },
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
          id: true,
          program: {
            select: { createdById: true, googleSheetName: true, googleSpreadsheetId: true, id: true, name: true },
          },
          traineeGoogleSpreadsheetId: true,
        },
        where: { programId: { in: programIds }, userId: profile.id },
      })
    : []

  if (assignments.length === 0) {
    throw new BadRequestError("Các buổi tập trong khoảng này không thuộc chương trình nào đang được giao, nên chưa có sheet để ghi.")
  }

  const withSheets = assignments.filter(
    (assignment) => assignment.program.googleSpreadsheetId && assignment.program.googleSheetName,
  )

  if (withSheets.length === 0) {
    throw new BadRequestError(
      "Chương trình của bạn chưa có Google Sheet. Hãy nhờ coach bấm \"Tạo Google Sheet\" trên chương trình đó rồi export lại.",
    )
  }

  const files: Array<{ name: string; programId: string; url: string; weeks: number[] }> = []
  let exportedLogCount = 0
  let rowCount = 0

  // Sequential: each file is its own set of Google writes, and a failure should
  // stop before touching the next program's file.
  for (const assignment of withSheets) {
    const logs = rangeLogs.filter((log) => log.programId === assignment.program.id)
    if (logs.length === 0) continue

    const coachToken = await getGoogleAccessToken({ id: assignment.program.createdById, role: "coach" })
    const sessions = groupLogsIntoSessions(logs)
    const copyId = await ensureTraineeProgramCopy(coachToken, assignment, { email: profile.email, name: profile.name })
    const written = await writeSessionsToSpreadsheet(
      coachToken,
      copyId,
      assignment.program.googleSheetName!,
      sessions,
    )

    files.push({
      name: assignment.program.name,
      programId: assignment.program.id,
      url: written.spreadsheetUrl,
      weeks: [...sessions.keys()].sort((left, right) => left - right).map((week) => week + 1),
    })
    exportedLogCount += logs.length
    rowCount += written.rowCount
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
