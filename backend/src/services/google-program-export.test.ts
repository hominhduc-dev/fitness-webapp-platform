import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "./auth.service"
import { ExternalServiceError } from "./errors"

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  conflictLogs: vi.fn(),
  createTemplate: vi.fn(),
  logs: vi.fn(),
  programs: vi.fn(),
  updatePrograms: vi.fn(),
  users: vi.fn(),
  values: vi.fn(),
  workouts: vi.fn(),
}))
vi.mock("./fitness-data/shared/guards", () => ({
  assertCoach: vi.fn(),
  assertCoachOwnsTrainee: vi.fn(),
  ensurePrisma: () => ({
    program: { findMany: mocks.programs, updateMany: mocks.updatePrograms },
    user: { findMany: mocks.users },
    workout: { findMany: mocks.workouts },
    // The trainee's own logs (to export) and the conflict check's distinct
    // userIds are both `workoutLog.findMany` calls with different shapes;
    // routing on `distinct` keeps existing tests unaware of the second one.
    workoutLog: {
      findMany: (args: { distinct?: unknown }) => (args?.distinct ? mocks.conflictLogs(args) : mocks.logs(args)),
    },
  }),
}))
vi.mock("./google-connection.service", () => ({ getGoogleAccessToken: vi.fn().mockResolvedValue("test-token") }))
vi.mock("../lib/google", () => ({
  batchUpdateSpreadsheet: mocks.batch,
  fetchSheetValues: mocks.values,
  fetchSpreadsheetMeta: vi.fn().mockResolvedValue({ sheetProperties: [{ sheetId: 1, title: "Week 1", gridProperties: { rowCount: 50 } }, { sheetId: 2, title: "Exercise Table" }] }),
}))
vi.mock("./google-program-template.service", () => ({ createProgramTemplateSpreadsheet: mocks.createTemplate }))
import { ensurePrisma } from "./fitness-data/shared/guards"
import { describeGoogleSpreadsheetConflict, exportGoogleProgramLogs } from "./google-program-export.service"

const headers = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Rest (s)", "Note"]
type BatchRequest = {
  duplicateSheet?: { newSheetName?: string }
  insertDimension?: { range?: { dimension?: string; sheetId?: number; startIndex?: number; endIndex?: number } }
  updateCells?: { start?: { sheetId?: number; rowIndex?: number; columnIndex?: number }; rows?: Array<{ values?: Array<{ userEnteredValue?: { stringValue?: string } }> }> }
}

/** The program in the app: Day 1 of every week plans Bench, whose id is v1. */
const benchWorkout = (overrides: { scheduledDay?: number } = {}) => ({
  exercises: [{
    notes: null, order: 1, restTime: null,
    sets: Array.from({ length: 3 }, (_, index) => ({ intensityTag: null, rir: 2, setNumber: index + 1, targetReps: 10, targetRepsMin: null, weight: 40 })),
    variation: { exercise: { muscleGroup: "Chest", name: "Bench" }, id: "v1", isDefault: true, name: "Default" },
  }],
  scheduledDate: null, scheduledDay: 1, weekIndex: 0, ...overrides,
})

describe("Google export batch across weeks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.programs.mockResolvedValueOnce([{ id: "program", name: "Push Block", googleSpreadsheetId: "spreadsheet", googleSheetName: "Week 1" }]).mockResolvedValueOnce([{ id: "program", assignments: [{ userId: "trainee" }] }])
    mocks.conflictLogs.mockResolvedValue([])
    mocks.users.mockResolvedValue([])
    mocks.createTemplate.mockResolvedValue({ spreadsheetId: "replacement-sheet", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/replacement-sheet/edit" })
    mocks.updatePrograms.mockResolvedValue({ count: 1 })
    mocks.values.mockResolvedValue([["Week 1"], headers, ["1", "Chest", "Bench", "Default", "v1", "7", "10"]])
    mocks.workouts.mockResolvedValue([benchWorkout()])
    mocks.logs.mockResolvedValue([0, 1, 2].map(week => ({ programId: "program", workoutSnapshot: { weekIndex: week, scheduledDay: 1 }, exerciseSnapshot: [{ order: 1, variation: { id: "v1" }, sets: [{ setNumber: week === 0 ? 7 : 6, completed: true, actualReps: 10, weight: 35 }] }] })))
  })
  it("duplicates every missing week before changing the source layout in one atomic batch", async () => {
    await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a", "b", "c"])
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    const requests = mocks.batch.mock.calls[0][2] as BatchRequest[]
    expect(requests.slice(0, 2).map((request) => request.duplicateSheet?.newSheetName)).toEqual(["Week 2", "Week 3"])
    const resultColumnInsert = requests.find((request) => {
      const range = request.insertDimension?.range
      return range?.dimension === "COLUMNS" && typeof range.startIndex === "number" && typeof range.endIndex === "number" && range.endIndex - range.startIndex > 1
    })
    expect(resultColumnInsert?.insertDimension?.range).toMatchObject({ sheetId: 1, startIndex: 14, endIndex: 16 })
    expect(requests.slice(2).some((request) => request.duplicateSheet)).toBe(false)
  })
  it("writes the app's plan into the tab before the results, so an edited program still exports", async () => {
    // The log was trained on "Old Bench" before the coach changed the program to Bench.
    mocks.values.mockResolvedValue([["Week 1"], headers, ["1", "Chest", "Old Bench", "Default", "v-old", "3", "10"]])
    mocks.logs.mockResolvedValue([{ programId: "program", workoutSnapshot: { weekIndex: 0, scheduledDay: 1 }, exerciseSnapshot: [{ order: 1, exercise: { name: "Old Bench" }, variation: { id: "v-old", name: "Default" }, sets: [{ setNumber: 1, completed: true, actualReps: 8, weight: 30 }] }] }])

    const result = await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])

    expect(result).toMatchObject({ rowCount: 1, skippedExerciseCount: 0 })
    const writes = (mocks.batch.mock.calls[0][2] as BatchRequest[]).flatMap((request) => request.updateCells ? [request.updateCells] : [])
    const plan = writes.findIndex((write) => write.start?.columnIndex === 1 && write.start?.rowIndex === 2)
    const results = writes.findIndex((write) => write.start?.columnIndex === 8 && write.rows?.[0]?.values?.[0]?.userEnteredValue?.stringValue)
    expect(writes[plan]?.rows?.[0]?.values?.[1]?.userEnteredValue?.stringValue).toBe("Bench")
    expect(writes[results]?.rows?.[0]?.values?.[0]?.userEnteredValue?.stringValue).toBe("Old Bench / Default")
    expect(plan).toBeLessThan(results)
  })
  it("refreshes the Exercise Table so dropdown validation accepts the current plan", async () => {
    mocks.values.mockResolvedValue([["Week 1"], headers, ["1", "Chest", "Old Bench", "Default", "v-old", "3", "10"]])
    mocks.workouts.mockResolvedValue([benchWorkout()])

    await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])

    const requests = mocks.batch.mock.calls[0][2] as BatchRequest[]
    const referenceWrite = requests.find((request) =>
      request.updateCells?.start?.sheetId === 2 &&
      request.updateCells.start.rowIndex === 0 &&
      request.updateCells.start.columnIndex === 0,
    )
    expect(referenceWrite?.updateCells?.rows?.[1]?.values?.[0]?.userEnteredValue?.stringValue).toBe("v1")
  })
  it("creates and remembers a replacement spreadsheet when the linked sheet is gone", async () => {
    mocks.batch
      .mockRejectedValueOnce(new ExternalServiceError("Google trả về lỗi 404.", {
        code: "GOOGLE_REQUEST_FAILED",
        details: { label: "spreadsheet_write", status: 404 },
      }))
      .mockResolvedValueOnce({})

    const result = await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])

    expect(result).toMatchObject({ recreatedSpreadsheet: true, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/replacement-sheet/edit" })
    expect(mocks.createTemplate).toHaveBeenCalledWith("test-token", expect.objectContaining({
      referenceRows: expect.arrayContaining([expect.arrayContaining(["v1"])]),
      title: "Push Block — replacement",
    }))
    expect(mocks.batch.mock.calls[1][1]).toBe("replacement-sheet")
    expect(mocks.updatePrograms).toHaveBeenCalledWith({
      data: { googleSheetName: "Week 1", googleSpreadsheetId: "replacement-sheet" },
      where: { createdById: "coach", googleSpreadsheetId: "spreadsheet", id: { in: ["program"] } },
    })
  })
  it("sends no writes or duplicates when a week's plan has a day the sheet cannot hold", async () => {
    mocks.workouts.mockResolvedValue([benchWorkout(), benchWorkout({ scheduledDay: 5 })])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/Day 5/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("names the trainee a spreadsheet is currently assigned to", async () => {
    mocks.programs.mockReset()
    mocks.programs.mockResolvedValueOnce([{ id: "program", googleSpreadsheetId: "spreadsheet", googleSheetName: "Week 1" }]).mockResolvedValueOnce([{ id: "program", assignments: [{ userId: "another-trainee" }] }])
    mocks.users.mockResolvedValue([{ coachId: "coach", name: "Nguyễn Văn A" }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/Nguyễn Văn A/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("names the trainee whose logs are still on the spreadsheet, even after unassignment", async () => {
    mocks.conflictLogs.mockResolvedValue([{ userId: "ghost-trainee" }])
    mocks.users.mockResolvedValue([{ coachId: "coach", name: "Trần Thị B" }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/Trần Thị B/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("falls back to a generic phrase if the conflicting user was deleted", async () => {
    mocks.conflictLogs.mockResolvedValue([{ userId: "deleted-user" }])
    mocks.users.mockResolvedValue([])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/một học viên khác/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("redacts the name of a conflicting trainee who belongs to a different coach", async () => {
    // The spreadsheet really is shared — the export still has to refuse — but a
    // trainee's name is their own coach's roster to see, not this one's.
    mocks.conflictLogs.mockResolvedValue([{ userId: "someone-elses-trainee" }])
    mocks.users.mockResolvedValue([{ coachId: "a-different-coach", name: "Lê Văn C" }])
    let error: unknown
    try {
      await exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/một học viên khác/)
    expect((error as Error).message).not.toMatch(/Lê Văn C/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
  it("rejects old logs without a week snapshot", async () => {
    mocks.logs.mockResolvedValue([{ programId: "program", workoutSnapshot: { scheduledDay: 1 }, exerciseSnapshot: [] }])
    await expect(exportGoogleProgramLogs({ id: "coach", role: "coach" } as SerializedProfile, "trainee", ["a"])).rejects.toThrow(/snapshot tuần/)
    expect(mocks.batch).not.toHaveBeenCalled()
  })
})

describe("describeGoogleSpreadsheetConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null without querying when the program has no spreadsheet linked", async () => {
    const db = ensurePrisma()
    const result = await describeGoogleSpreadsheetConflict(db, "coach", {
      assignments: [],
      googleSpreadsheetId: null,
      id: "program",
    })
    expect(result).toBeNull()
    expect(mocks.programs).not.toHaveBeenCalled()
  })

  it("returns null when the spreadsheet is only used by the program's own roster", async () => {
    mocks.programs.mockResolvedValue([{ id: "program", assignments: [{ userId: "trainee-a" }, { userId: "trainee-b" }] }])
    mocks.conflictLogs.mockResolvedValue([])
    const db = ensurePrisma()
    const result = await describeGoogleSpreadsheetConflict(db, "coach", {
      assignments: [{ userId: "trainee-a" }, { userId: "trainee-b" }],
      googleSpreadsheetId: "spreadsheet",
      id: "program",
    })
    expect(result).toBeNull()
  })

  it("finds and names a conflict from a trainee outside the program's own roster", async () => {
    mocks.programs.mockResolvedValue([{ id: "program", assignments: [{ userId: "trainee-a" }, { userId: "borrower-trainee" }] }])
    mocks.conflictLogs.mockResolvedValue([])
    mocks.users.mockResolvedValue([{ coachId: "coach", name: "Người mượn" }])
    const db = ensurePrisma()
    const result = await describeGoogleSpreadsheetConflict(db, "coach", {
      assignments: [{ userId: "trainee-a" }],
      googleSpreadsheetId: "spreadsheet",
      id: "program",
    })
    expect(result).toEqual({ conflictingCount: 1, conflictingNames: ["Người mượn"] })
  })
})
