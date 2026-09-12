import { extractSpreadsheetId, fetchSheetValues, fetchSpreadsheetMeta } from "../lib/google"
import { BadRequestError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { getGoogleAccessToken } from "./google-connection.service"
import { ensurePrisma } from "./fitness-data/shared/guards"

export function parseGoogleProgramRows(values: string[][]) {
  const headerIndex = values.findIndex((row) => row[0]?.trim() === "Day" && row[2]?.trim() === "Exercise")
  if (headerIndex < 0) throw new BadRequestError("Không tìm thấy bảng Day / Exercise trong sheet.")
  const header = values[headerIndex]
  const rirColumn = header.indexOf("RIR")
  const restColumn = header.indexOf("Rest (s)")
  if (header[5] !== "Sets" || header[6] !== "Rep Range" || header[8] !== "Substitute Exercise" || rirColumn < 14) {
    throw new BadRequestError("Sheet không đúng bố cục template chương trình.")
  }
  // Optional: sheets created before per-set methods existed have no Method
  // column, and must keep importing unchanged.
  const methodColumn = header.indexOf("Method")
  let day = ""
  const orders = new Map<number, number>()
  const number = (value?: string) => value?.trim() ? Number(value) : undefined
  return values.slice(headerIndex + 1).flatMap((cells, index) => {
    if (cells[0]?.trim()) day = cells[0].trim()
    if (!cells[2]?.trim() && !cells[4]?.trim() && !cells[5]?.trim() && !cells[6]?.trim()) return []
    const parsedDay = Number(day)
    const scheduledDay = Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 6 ? parsedDay : undefined
    const order = (orders.get(parsedDay) ?? 0) + 1
    orders.set(parsedDay, order)
    return [{
      exerciseName: cells[2]?.trim() ?? "", variationName: cells[3]?.trim() ?? "",
      // E is positional; its header is intentionally empty. Never infer IDs from names.
      variationId: cells[4]?.trim() || "__missing_variation_id__",
      sourceRow: headerIndex + index + 2, scheduledDay, order,
      workoutName: scheduledDay ? `Day ${scheduledDay}` : "",
      sets: number(cells[5]), reps: cells[6]?.trim() ?? "", weight: number(cells[7]),
      rir: number(cells[rirColumn]), restTime: number(cells[restColumn]),
      method: methodColumn >= 0 ? cells[methodColumn]?.trim() || undefined : undefined,
      notes: cells[header.indexOf("Note")]?.trim() || undefined,
    }]
  })
}
export async function getGoogleSpreadsheet(profile: SerializedProfile, input: string) {
  const spreadsheetId = extractSpreadsheetId(input)
  if (!spreadsheetId) throw new BadRequestError("Link hoặc ID Google Sheets không hợp lệ.")
  const accessToken = await getGoogleAccessToken(profile)
  return { spreadsheetId, ...(await fetchSpreadsheetMeta(accessToken, spreadsheetId)) }
}
export async function importGoogleProgram(profile: SerializedProfile, input: string, sheetName: string) {
  const spreadsheetId = extractSpreadsheetId(input)
  if (!spreadsheetId || !sheetName.trim()) throw new BadRequestError("Cần spreadsheet và tên sheet.")
  const accessToken = await getGoogleAccessToken(profile)
  const rows = parseGoogleProgramRows(await fetchSheetValues(accessToken, spreadsheetId, sheetName))
  if (!rows.length) throw new BadRequestError("Sheet chưa có bài tập.")
  const existingProgram = await ensurePrisma().program.findFirst({
    orderBy: { updatedAt: "desc" },
    where: { createdById: profile.id, googleSpreadsheetId: spreadsheetId, googleSheetName: sheetName },
    select: { id: true, name: true, archivedAt: true, _count: { select: { assignments: true } } },
  })
  return { rows, spreadsheetId, sheetName, existingProgram: existingProgram ? { ...existingProgram, assignedTraineeCount: existingProgram._count.assignments } : null }
}
