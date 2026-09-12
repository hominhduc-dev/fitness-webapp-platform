import { randomInt } from "node:crypto"
import { batchUpdateSpreadsheet, fetchSheetValues, fetchSpreadsheetMeta } from "../lib/google"
import { getGoogleAccessToken } from "./google-connection.service"
import { parseGoogleProgramRows } from "./google-program-import.service"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "./fitness-data/shared/guards"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"

type ExportExercise = { order?: number; originalVariationId?: string; variation?: { id?: string; name?: string }; exercise?: { name?: string }; sets: Array<{ setNumber: number; completed: boolean; actualReps?: number; weight?: number }> }
type ExportSession = { day: number; week: number; exercises: ExportExercise[] }
export function buildGoogleResultRequests(values: string[][], sessions: ExportSession[], sheetId: number, rowCount: number, clearCopiedResults = false) {
  const rows = parseGoogleProgramRows(values)
  const headerIndex = values.findIndex((row) => row[0]?.trim() === "Day" && row[2]?.trim() === "Exercise")
  const oldRirColumn = values[headerIndex].indexOf("RIR")
  const oldSetCount = oldRirColumn - 9
  let setCount = oldSetCount
  const updates: Array<{ row: number; exercise: ExportExercise }> = []
  const seen = new Set<number>()
  for (const session of sessions) for (const exercise of session.exercises) {
    const variationId = exercise.originalVariationId ?? exercise.variation?.id
    if (!variationId || !Number.isInteger(exercise.order)) throw new BadRequestError("Log cũ thiếu ID bài gốc hoặc thứ tự bài; không thể ghi an toàn vào sheet.")
    const matches = rows.filter((row) => row.scheduledDay === session.day && row.order === exercise.order! && row.variationId === variationId)
    if (matches.length !== 1) throw new BadRequestError(`Không khớp duy nhất Day ${session.day}, bài ${exercise.order!}, variation ${variationId}. Chưa ghi dữ liệu.`)
    if (seen.has(matches[0].sourceRow)) throw new BadRequestError("Có nhiều log cho cùng một buổi/tuần. Hãy chọn khoảng ngày chỉ chứa một kết quả mỗi buổi.")
    seen.add(matches[0].sourceRow)
    const setNumbers = new Set<number>()
    for (const set of exercise.sets) {
      if (!Number.isInteger(set.setNumber) || set.setNumber < 1 || setNumbers.has(set.setNumber)) throw new BadRequestError("Số thứ tự set trong log không hợp lệ.")
      setNumbers.add(set.setNumber)
      if (set.completed && (!Number.isFinite(set.actualReps) || set.actualReps! < 0 || (set.weight != null && (!Number.isFinite(set.weight) || set.weight < 0)))) throw new BadRequestError("Kết quả reps/weight không hợp lệ.")
      setCount = Math.max(setCount, set.setNumber)
    }
    updates.push({ row: matches[0].sourceRow - 1, exercise })
  }
  const requests: unknown[] = []
  if (setCount > oldSetCount) {
    requests.push({ insertDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: oldRirColumn, endIndex: oldRirColumn + setCount - oldSetCount }, inheritFromBefore: true } })
    requests.push({ unmergeCells: { range: { sheetId, startRowIndex: headerIndex, endRowIndex: headerIndex + 1, startColumnIndex: 9, endColumnIndex: 9 + setCount } } })
    requests.push({ mergeCells: { range: { sheetId, startRowIndex: headerIndex, endRowIndex: headerIndex + 1, startColumnIndex: 9, endColumnIndex: 9 + setCount }, mergeType: "MERGE_ALL" } })
  }
  if (clearCopiedResults) requests.push({ repeatCell: { range: { sheetId, startRowIndex: headerIndex + 1, endRowIndex: rowCount, startColumnIndex: 8, endColumnIndex: 9 + setCount }, cell: {}, fields: "userEnteredValue" } })
  for (const { row, exercise } of updates) {
    const substitute = exercise.originalVariationId && exercise.originalVariationId !== exercise.variation?.id ? [exercise.exercise?.name, exercise.variation?.name].filter(Boolean).join(" / ") : ""
    const cells: string[] = [substitute, ...Array<string>(setCount).fill("")]
    for (const set of exercise.sets) if (set.completed) cells[set.setNumber] = `${set.actualReps} × ${set.weight ?? "—"} kg`
    requests.push({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: 8 }, rows: [{ values: cells.map((value) => value ? { userEnteredValue: { stringValue: value } } : {}) }], fields: "userEnteredValue" } })
  }
  return { requests, rowCount: updates.length }
}

export async function exportGoogleProgramLogs(profile: SerializedProfile, traineeId: string, logIds: string[]) {
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)
  const db = ensurePrisma()
  const logs = await db.workoutLog.findMany({ where: { id: { in: logIds }, userId: traineeId, completedAt: { not: null } }, orderBy: { startedAt: "asc" } })
  if (!logs.length) throw new BadRequestError("Không có buổi tập đã hoàn thành.")
  const programIds = [...new Set(logs.flatMap((log) => log.programId ? [log.programId] : []))]
  const programs = await db.program.findMany({ where: { id: { in: programIds }, createdById: profile.id } })
  if (programs.length !== programIds.length || logs.some((log) => !log.programId)) throw new BadRequestError("Log không thuộc chương trình của coach.")
  const spreadsheetIds = [...new Set(programs.map((program) => program.googleSpreadsheetId))]
  if (spreadsheetIds.length !== 1 || !spreadsheetIds[0] || programs.some((program) => !program.googleSheetName)) throw new BadRequestError("Chọn log của một spreadsheet đã import.")
  const spreadsheetId = spreadsheetIds[0]
  const relatedPrograms = await db.program.findMany({ where: { googleSpreadsheetId: spreadsheetId }, select: { id: true, assignments: { select: { userId: true } } } })
  if (relatedPrograms.some((program) => program.assignments.some((assignment) => assignment.userId !== traineeId)) || await db.workoutLog.count({ where: { programId: { in: relatedPrograms.map((program) => program.id) }, userId: { not: traineeId } } })) {
    throw new BadRequestError("Spreadsheet này đang hoặc đã được dùng bởi học viên khác. Mỗi học viên cần một spreadsheet riêng.")
  }
  const sessions = new Map<number, ExportSession[]>()
  for (const log of logs) {
    const snapshot = log.workoutSnapshot as { scheduledDay?: number; weekIndex?: number } | null
    if (!snapshot || !Number.isInteger(snapshot.weekIndex) || snapshot.weekIndex! < 1 || !Number.isInteger(snapshot.scheduledDay) || !Array.isArray(log.exerciseSnapshot)) throw new BadRequestError("Log cũ thiếu snapshot tuần/ngày. Không thể xác định sheet đích an toàn.")
    const week = snapshot.weekIndex!
    const exercises = log.exerciseSnapshot as unknown as ExportExercise[]
    if (exercises.some((exercise) => !exercise || !Array.isArray(exercise.sets))) throw new BadRequestError("Snapshot bài tập không hợp lệ.")
    sessions.set(week, [...(sessions.get(week) ?? []), { week, day: snapshot.scheduledDay!, exercises }])
  }
  const sourceNames = [...new Set(programs.map((program) => program.googleSheetName!))]
  if (sourceNames.length !== 1) throw new BadRequestError("Các chương trình dùng sheet tuần mẫu khác nhau.")
  const token = await getGoogleAccessToken(profile)
  const meta = await fetchSpreadsheetMeta(token, spreadsheetId)
  const source = meta.sheetProperties.find((sheet) => sheet.title === sourceNames[0])
  if (!source) throw new BadRequestError("Sheet tuần mẫu không còn tồn tại.")
  if (!meta.sheetProperties.some((sheet) => sheet.title === "Exercise Table")) throw new BadRequestError("Thiếu sheet Exercise Table để khôi phục dropdown bài tập.")
  const sourceValues = await fetchSheetValues(token, spreadsheetId, source.title)
  // Every new week must copy the same source layout used during preflight.
  // Duplicating after a Week 1 column insertion would shift the copied RIR/merge
  // ranges before the new week's independently planned requests are applied.
  const duplicateRequests: unknown[] = []
  const requests: unknown[] = []
  let rowCount = 0
  const ids = new Set(meta.sheetProperties.map((sheet) => sheet.sheetId))
  for (const [week, group] of sessions) {
    const title = week === 1 ? source.title : `Week ${week}`
    const existing = meta.sheetProperties.find((sheet) => sheet.title === title)
    let sheetId = existing?.sheetId
    if (sheetId == null) {
      do { sheetId = randomInt(1, 2_000_000_000) } while (ids.has(sheetId))
      ids.add(sheetId)
      duplicateRequests.push({ duplicateSheet: { sourceSheetId: source.sheetId, newSheetId: sheetId, newSheetName: title } })
    }
    const values = existing ? (existing.title === source.title ? sourceValues : await fetchSheetValues(token, spreadsheetId, title)) : sourceValues
    const built = buildGoogleResultRequests(values, group, sheetId, (existing ?? source).gridProperties?.rowCount ?? values.length, !existing)
    requests.push(...built.requests); rowCount += built.rowCount
    const headerIndex = values.findIndex((row) => row[0]?.trim() === "Day" && row[2]?.trim() === "Exercise")
    requests.push({ setDataValidation: {
      range: { sheetId, startRowIndex: headerIndex + 1, endRowIndex: (existing ?? source).gridProperties?.rowCount ?? values.length, startColumnIndex: 2, endColumnIndex: 3 },
      rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: "='Exercise Table'!$D$2:$D" }] }, strict: true, showCustomUi: true },
    } })
  }
  await batchUpdateSpreadsheet(token, spreadsheetId, [...duplicateRequests, ...requests])
  return { exported: true, logCount: logs.length, rowCount, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` }
}
