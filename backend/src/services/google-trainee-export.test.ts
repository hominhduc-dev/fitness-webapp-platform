import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  assignments: vi.fn(),
  copy: vi.fn(),
  driveScope: vi.fn(),
  findAssignment: vi.fn(),
  logs: vi.fn(),
  share: vi.fn(),
  token: vi.fn(),
  updateAssignment: vi.fn(),
  write: vi.fn(),
}))

vi.mock("../lib/google", () => ({ copyDriveFile: mocks.copy, shareDriveFile: mocks.share }))
vi.mock("./google-connection.service", () => ({
  getGoogleAccessToken: mocks.token,
  hasFullDriveScope: mocks.driveScope,
}))
vi.mock("./fitness-data/shared/guards", () => ({
  assertTrainee: vi.fn(),
  ensurePrisma: () => ({
    programAssignment: {
      findMany: mocks.assignments,
      findUnique: mocks.findAssignment,
      updateMany: mocks.updateAssignment,
    },
    workoutLog: { findMany: mocks.logs },
  }),
}))
// The week grouping is the real one — it is what decides which tab a log lands
// on, and a stub would hide the snapshot rules it enforces.
vi.mock("./google-program-export.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./google-program-export.service")>()),
  writeSessionsToSpreadsheet: mocks.write,
}))

import { exportTraineeLogsToGoogleDrive } from "./google-trainee-export.service"
import type { SerializedProfile } from "./auth.service"

const trainee = { email: "an@example.com", id: "trainee", name: "An", role: "trainee" } as SerializedProfile
const range = { from: new Date("2026-09-21"), to: new Date("2026-09-28") }

const log = (overrides: Record<string, unknown> = {}) => ({
  exerciseSnapshot: [],
  id: "log-1",
  programId: "p1",
  workoutSnapshot: { scheduledDay: 1, weekIndex: 0 },
  ...overrides,
})

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  program: {
    createdById: "coach",
    googleSheetName: "Week 1",
    googleSpreadsheetId: "master-sheet",
    id: "p1",
    name: "Push Pull Legs",
  },
  traineeGoogleSpreadsheetId: null,
  ...overrides,
})

describe("exportTraineeLogsToGoogleDrive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logs.mockResolvedValue([log()])
    mocks.assignments.mockResolvedValue([assignment()])
    mocks.token.mockResolvedValue("coach-token")
    mocks.copy.mockResolvedValue("copy-1")
    mocks.driveScope.mockResolvedValue(true)
    mocks.share.mockResolvedValue({})
    mocks.updateAssignment.mockResolvedValue({ count: 1 })
    mocks.write.mockResolvedValue({ rowCount: 3, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/copy-1/edit" })
  })

  it("copies the coach's sheet for the trainee and writes the results into the copy", async () => {
    const result = await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.copy).toHaveBeenCalledWith("coach-token", "master-sheet", "Push Pull Legs — An")
    expect(mocks.share).toHaveBeenCalledWith("coach-token", "copy-1", "an@example.com", "reader")
    expect(mocks.write).toHaveBeenCalledWith("coach-token", "copy-1", "Week 1", expect.any(Map))
    expect(result).toMatchObject({ exported: true, logCount: 1, rowCount: 3 })
    expect(result.files[0]).toMatchObject({ name: "Push Pull Legs", weeks: [1] })
  })

  it("acts on the coach's token, never the trainee's", async () => {
    await exportTraineeLogsToGoogleDrive(trainee, range)

    // `drive.file` only reaches files the app made for the account asking, and
    // the program sheet was made for the coach.
    expect(mocks.token).toHaveBeenCalledWith({ id: "coach", role: "coach" })
    expect(mocks.token).not.toHaveBeenCalledWith(expect.objectContaining({ id: "trainee" }))
  })

  it("never writes into the coach's own sheet", async () => {
    await exportTraineeLogsToGoogleDrive(trainee, range)

    const written = mocks.write.mock.calls.map((call) => call[1])
    expect(written).not.toContain("master-sheet")
  })

  it("reuses the copy it already made rather than making another", async () => {
    mocks.assignments.mockResolvedValue([assignment({ traineeGoogleSpreadsheetId: "copy-old" })])

    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.copy).not.toHaveBeenCalled()
    expect(mocks.write).toHaveBeenCalledWith("coach-token", "copy-old", "Week 1", expect.any(Map))
  })

  it("adopts the winner's copy when another export claimed the assignment first", async () => {
    mocks.updateAssignment.mockResolvedValue({ count: 0 })
    mocks.findAssignment.mockResolvedValue({ traineeGoogleSpreadsheetId: "copy-winner" })

    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.write).toHaveBeenCalledWith("coach-token", "copy-winner", "Week 1", expect.any(Map))
  })

  it("still exports when the copy cannot be shared", async () => {
    // The file is correct either way; the coach can share it by hand. Losing a
    // finished export over a failed grant would be the worse outcome.
    mocks.share.mockRejectedValue(new Error("permission denied"))

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).resolves.toMatchObject({ exported: true })
  })

  it("says what to do when the program has no sheet yet", async () => {
    mocks.assignments.mockResolvedValue([
      assignment({ program: { ...assignment().program, googleSheetName: null, googleSpreadsheetId: null } }),
    ])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/chưa có Google Sheet/)
    expect(mocks.copy).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it("counts logs of a program with no sheet as skipped rather than failing the rest", async () => {
    mocks.logs.mockResolvedValue([log(), log({ id: "log-2", programId: "p2" })])
    mocks.assignments.mockResolvedValue([
      assignment(),
      assignment({
        id: "a2",
        program: { ...assignment().program, googleSheetName: null, googleSpreadsheetId: null, id: "p2" },
      }),
    ])

    const result = await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(result).toMatchObject({ logCount: 1, skippedLogCount: 1 })
    expect(result.files).toHaveLength(1)
  })

  it("refuses a log whose snapshot cannot say which week it belongs to", async () => {
    mocks.logs.mockResolvedValue([log({ workoutSnapshot: { scheduledDay: 1 } })])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/snapshot tuần/)
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it("blames the missing Drive grant when the copy fails and the coach never gave one", async () => {
    // Google answers 404 both for a file the grant cannot see and for one that
    // is really gone. The grant is what separates them, and it is the only one
    // of the two anybody can do something about.
    mocks.copy.mockRejectedValue(new Error("Google trả về lỗi 404."))
    mocks.driveScope.mockResolvedValue(false)

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/cấp lại quyền/)
  })

  it("lets the real error through when the coach did grant Drive access", async () => {
    // Dressing an unrelated Google failure up as a permissions problem would
    // send the coach off to re-grant a permission they already gave.
    mocks.copy.mockRejectedValue(new Error("Google trả về lỗi 500."))
    mocks.driveScope.mockResolvedValue(true)

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/500/)
  })

  it("does not ask about Drive access when the copy already exists", async () => {
    mocks.assignments.mockResolvedValue([assignment({ traineeGoogleSpreadsheetId: "copy-old" })])

    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.driveScope).not.toHaveBeenCalled()
  })

  it("refuses when nothing was completed in the range", async () => {
    mocks.logs.mockResolvedValue([])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/Không có buổi tập đã hoàn thành/)
  })
})
