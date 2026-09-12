import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"

const mocks = vi.hoisted(() => ({ logs: vi.fn(), programs: vi.fn(), logCount: vi.fn(), batch: vi.fn(), values: vi.fn() }))
vi.mock("./fitness-data/shared/guards", () => ({ assertCoach: vi.fn(), assertCoachOwnsTrainee: vi.fn(), ensurePrisma: () => ({ workoutLog: { findMany: mocks.logs, count: mocks.logCount }, program: { findMany: mocks.programs } }) }))
vi.mock("./google-connection.service", () => ({ getGoogleAccessToken: vi.fn().mockResolvedValue("test-token") }))
vi.mock("../lib/google", () => ({
  batchUpdateSpreadsheet: mocks.batch,
  fetchSheetValues: mocks.values,
  fetchSpreadsheetMeta: vi.fn().mockResolvedValue({ sheetProperties: [{ sheetId: 1, title: "Week 1", gridProperties: { rowCount: 50 } }, { sheetId: 2, title: "Exercise Table" }] }),
}))
import { exportGoogleProgramLogs } from "./google-program-export.service"

const headers = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Rest (s)", "Note"]
describe("Google export batch across weeks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.programs.mockResolvedValueOnce([{ id: "program", googleSpreadsheetId: "spreadsheet", googleSheetName: "Week 1" }]).mockResolvedValueOnce([{ id: "program", assignments: [{ userId: "trainee" }] }])
    mocks.logCount.mockResolvedValue(0)
    mocks.values.mockResolvedValue([["Week 1"], headers, ["1", "Chest", "Bench", "Default", "v1", "7", "10"]])
    mocks.logs.mockResolvedValue([1, 2, 3].map(week => ({ programId: "program", workoutSnapshot: { weekIndex: week, scheduledDay: 1 }, exerciseSnapshot: [{ order: 1, variation: { id: "v1" }, sets: [{ setNumber: week === 1 ? 7 : 6, completed: true, actualReps: 10, weight: 35 }] }] })))
  })
  it("duplicates every missing week before changing the source layout in one atomic batch", async () => {
    await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a", "b", "c"])
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    const requests = mocks.batch.mock.calls[0][2]
    expect(requests.slice(0, 2).map((request: any) => request.duplicateSheet.newSheetName)).toEqual(["Week 2", "Week 3"])
    expect(requests[2].insertDimension.range).toMatchObject({ sheetId: 1, startIndex: 14, endIndex: 16 })
    expect(requests.slice(2).some((request: any) => request.duplicateSheet)).toBe(false)
  })
  it("sends no writes or duplicates when a later week fails preflight", async () => {
    mocks.logs.mockResolvedValue([{ programId: "program", workoutSnapshot: { weekIndex: 2, scheduledDay: 1 }, exerciseSnapshot: [{ order: 1, variation: { id: "missing" }, sets: [] }] }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/Không khớp/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("rejects a spreadsheet assigned to another trainee", async () => {
    mocks.programs.mockReset()
    mocks.programs.mockResolvedValueOnce([{ id: "program", googleSpreadsheetId: "spreadsheet", googleSheetName: "Week 1" }]).mockResolvedValueOnce([{ id: "program", assignments: [{ userId: "another-trainee" }] }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/học viên khác/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("rejects historical use by another trainee even after unassignment", async () => {
    mocks.logCount.mockResolvedValue(1)
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/học viên khác/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("rejects old logs without a week snapshot", async () => {
    mocks.logs.mockResolvedValue([{ programId: "program", workoutSnapshot: { scheduledDay: 1 }, exerciseSnapshot: [] }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/snapshot tuần/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
})
