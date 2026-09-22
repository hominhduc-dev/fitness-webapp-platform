import type { SerializedProfile } from "./auth.service"
import { BadRequestError } from "./errors"
import { getGoogleAccessToken } from "./google-connection.service"
import { groupLogsIntoSessions, writeSessionsToSpreadsheet } from "./google-program-export.service"
import {
  fillProgramWeeks,
  programReferenceRows,
  type SourceWorkout,
} from "./google-program-generate.service"
import { createProgramTemplateSpreadsheet } from "./google-program-template.service"
import { WEEK_SHEET_TITLE } from "../domain/google-program-sheet"
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
    duration: number
    id: string
    name: string
    workouts: SourceWorkout[]
  }
  traineeGoogleSpreadsheetId: string | null
}

/**
 * The trainee's own program sheet, built once in their Drive and reused after.
 *
 * Built rather than copied from the coach's file. `drive.file` reaches files
 * this app created for the account asking, so a sheet the trainee is to own has
 * to be created with the trainee's token — and copying the coach's would need
 * the restricted full-Drive scope on both sides to reach a file neither
 * account's grant covers. The template and the plan come from the same builders
 * the coach's sheet is made with, so the layout is identical either way.
 *
 * The id is claimed with a conditional write so two exports racing settle on
 * one file. The loser's is left in Drive — worth deleting once `lib/google`
 * can, but harmless until then.
 */
export async function ensureTraineeProgramSheet(
  traineeToken: string,
  assignment: AssignmentWithProgram,
  trainee: { email: string; name: string },
) {
  if (assignment.traineeGoogleSpreadsheetId) {
    return assignment.traineeGoogleSpreadsheetId
  }

  const weeks = Math.max(1, Math.round(assignment.program.duration))
  const created = await createProgramTemplateSpreadsheet(traineeToken, {
    referenceRows: programReferenceRows(assignment.program.workouts),
    title: `${assignment.program.name} — ${trainee.name}`,
    // Only themselves: the rest of the coach's roster is not theirs to see.
    trainees: [{ email: trainee.email, name: trainee.name }],
  })

  await fillProgramWeeks(traineeToken, created, assignment.program.workouts, weeks)

  const saved = await ensurePrisma().programAssignment.updateMany({
    data: { traineeGoogleSpreadsheetId: created.spreadsheetId },
    where: { id: assignment.id, traineeGoogleSpreadsheetId: null },
  })

  if (!saved.count) {
    const current = await ensurePrisma().programAssignment.findUnique({
      select: { traineeGoogleSpreadsheetId: true },
      where: { id: assignment.id },
    })

    return current?.traineeGoogleSpreadsheetId ?? created.spreadsheetId
  }

  return created.spreadsheetId
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
            select: {
              duration: true,
              id: true,
              name: true,
              workouts: {
                orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }],
                select: {
                  exercises: {
                    orderBy: { order: "asc" },
                    select: {
                      notes: true,
                      order: true,
                      restTime: true,
                      sets: {
                        orderBy: { setNumber: "asc" },
                        select: {
                          intensityTag: true,
                          rir: true,
                          setNumber: true,
                          targetReps: true,
                          targetRepsMin: true,
                          weight: true,
                        },
                      },
                      variation: {
                        select: {
                          exercise: { select: { muscleGroup: true, name: true } },
                          id: true,
                          isDefault: true,
                          name: true,
                        },
                      },
                    },
                  },
                  scheduledDate: true,
                  scheduledDay: true,
                  weekIndex: true,
                },
              },
            },
          },
          traineeGoogleSpreadsheetId: true,
        },
        where: { programId: { in: programIds }, userId: profile.id },
      })
    : []

  if (assignments.length === 0) {
    throw new BadRequestError("Các buổi tập trong khoảng này không thuộc chương trình nào đang được giao, nên chưa có sheet để ghi.")
  }

  const exportable = assignments.filter((assignment) => assignment.program.workouts.length > 0)

  if (exportable.length === 0) {
    throw new BadRequestError("Chương trình của bạn chưa có buổi tập nào để dựng sheet.")
  }

  const traineeToken = await getGoogleAccessToken(profile)
  const files: Array<{ name: string; programId: string; url: string; weeks: number[] }> = []
  let exportedLogCount = 0
  let rowCount = 0

  // Sequential: each file is its own set of Google writes, and a failure should
  // stop before touching the next program's file.
  for (const assignment of exportable) {
    const logs = rangeLogs.filter((log) => log.programId === assignment.program.id)
    if (logs.length === 0) continue

    const sessions = groupLogsIntoSessions(logs)
    const spreadsheetId = await ensureTraineeProgramSheet(traineeToken, assignment, {
      email: profile.email,
      name: profile.name,
    })
    const written = await writeSessionsToSpreadsheet(traineeToken, spreadsheetId, WEEK_SHEET_TITLE, sessions)

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
