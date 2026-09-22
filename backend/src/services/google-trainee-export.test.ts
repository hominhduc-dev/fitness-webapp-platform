import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  assignments: vi.fn(),
  createTemplate: vi.fn(),
  fillWeeks: vi.fn(),
  findAssignment: vi.fn(),
  logs: vi.fn(),
  token: vi.fn(),
  updateAssignment: vi.fn(),
  write: vi.fn(),
}))

vi.mock("./google-connection.service", () => ({ getGoogleAccessToken: mocks.token }))
vi.mock("./google-program-template.service", () => ({ createProgramTemplateSpreadsheet: mocks.createTemplate }))
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
// `programReferenceRows` stays real — it is what keeps one trainee from being
// handed the exercise catalogue their coach built for everybody.
vi.mock("./google-program-generate.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./google-program-generate.service")>()),
  fillProgramWeeks: mocks.fillWeeks,
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
  startedAt: new Date("2026-09-22T08:00:00Z"),
  workoutSnapshot: { scheduledDay: 1, weekIndex: 0 },
  ...overrides,
})

const workout = () => ({
  exercises: [
    {
      notes: null,
      order: 1,
      restTime: null,
      sets: [{ intensityTag: null, rir: null, setNumber: 1, targetReps: 10, targetRepsMin: null, weight: null }],
      variation: {
        exercise: { muscleGroup: "Chest", name: "Bench Press" },
        id: "var-1",
        isDefault: true,
        name: "Barbell",
      },
    },
  ],
  scheduledDate: null,
  scheduledDay: 1,
  weekIndex: 0,
})

const assignment = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  program: { duration: 4, id: "p1", name: "Push Pull Legs", workouts: [workout()] },
  traineeGoogleSpreadsheetId: null,
  ...overrides,
})

describe("exportTraineeLogsToGoogleDrive", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logs.mockResolvedValue([log()])
    mocks.assignments.mockResolvedValue([assignment()])
    mocks.token.mockResolvedValue("trainee-token")
    mocks.createTemplate.mockResolvedValue({
      sheetName: "Week 1",
      spreadsheetId: "trainee-sheet",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/trainee-sheet/edit",
      weekSheetId: 10,
      weekSheetIndex: 1,
    })
    mocks.fillWeeks.mockResolvedValue(undefined)
    mocks.updateAssignment.mockResolvedValue({ count: 1 })
    mocks.write.mockResolvedValue({
      rowCount: 3,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/trainee-sheet/edit",
    })
  })

  it("builds the program sheet in the trainee's own Drive and writes results into it", async () => {
    const result = await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.createTemplate).toHaveBeenCalledWith(
      "trainee-token",
      expect.objectContaining({ title: "Push Pull Legs — An" }),
    )
    expect(mocks.fillWeeks).toHaveBeenCalledWith("trainee-token", expect.anything(), expect.anything(), 4)
    expect(mocks.write).toHaveBeenCalledWith("trainee-token", "trainee-sheet", "Week 1", expect.any(Map), { lenient: true })
    expect(result).toMatchObject({ exported: true, logCount: 1, rowCount: 3 })
  })

  it("runs on the trainee's own token, never the coach's", async () => {
    // The whole point of building rather than copying: `drive.file` reaches the
    // files the app made for whoever is asking, so the trainee has to be asking.
    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.token).toHaveBeenCalledWith(trainee)
    expect(mocks.token).not.toHaveBeenCalledWith(expect.objectContaining({ role: "coach" }))
  })

  it("lists only the trainee themselves, not the coach's whole roster", async () => {
    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.createTemplate.mock.calls[0][1].trainees).toEqual([{ email: "an@example.com", name: "An" }])
  })

  it("puts only the program's own exercises in the reference tab", async () => {
    await exportTraineeLogsToGoogleDrive(trainee, range)

    const referenceRows = mocks.createTemplate.mock.calls[0][1].referenceRows as string[][]
    expect(referenceRows[0]).toContain("variation_id")
    expect(referenceRows).toHaveLength(2)
    expect(referenceRows[1]).toContain("var-1")
  })

  it("reuses the sheet it already built rather than building another", async () => {
    mocks.assignments.mockResolvedValue([assignment({ traineeGoogleSpreadsheetId: "sheet-old" })])

    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.createTemplate).not.toHaveBeenCalled()
    expect(mocks.write).toHaveBeenCalledWith("trainee-token", "sheet-old", "Week 1", expect.any(Map), { lenient: true })
  })

  it("adopts the winner's sheet when another export claimed the assignment first", async () => {
    mocks.updateAssignment.mockResolvedValue({ count: 0 })
    mocks.findAssignment.mockResolvedValue({ traineeGoogleSpreadsheetId: "sheet-winner" })

    await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(mocks.write).toHaveBeenCalledWith("trainee-token", "sheet-winner", "Week 1", expect.any(Map), { lenient: true })
  })

  it("refuses a program with no sessions to build a sheet from", async () => {
    mocks.assignments.mockResolvedValue([assignment({ program: { ...assignment().program, workouts: [] } })])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/chưa dựng được Google Sheet/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it("refuses a program made only of date-pinned sessions, before building a sheet", async () => {
    const pinned = { ...workout(), scheduledDate: new Date("2026-09-18"), scheduledDay: null, weekIndex: null }
    mocks.assignments.mockResolvedValue([assignment({ program: { ...assignment().program, workouts: [pinned] } })])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/gắn ngày cố định/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it("skips a log with no week or day and still exports the rest", async () => {
    mocks.logs.mockResolvedValue([
      log(),
      log({ id: "log-pinned", workoutSnapshot: { name: "Day 4", scheduledDate: "2026-09-18" } }),
    ])

    const result = await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(result).toMatchObject({ logCount: 1, skippedLogCount: 1 })
  })

  it("skips a session trained before the program's first week", async () => {
    // Tried on the Thursday before a Monday start: it records itself as week 1,
    // so writing it would claim the rows the real week 1 fills.
    mocks.assignments.mockResolvedValue([
      assignment({ program: { ...assignment().program, startDate: new Date("2026-09-21") } }),
    ])
    mocks.logs.mockResolvedValue([
      log({ id: "log-early", startedAt: new Date("2026-09-17T09:00:00Z"), workoutSnapshot: { scheduledDay: 3, weekIndex: 0 } }),
      log({ startedAt: new Date("2026-09-21T08:00:00Z") }),
    ])

    const result = await exportTraineeLogsToGoogleDrive(trainee, { ...range, from: new Date("2026-09-14") })

    const sessions = mocks.write.mock.calls[0][3] as Map<number, Array<{ day: number }>>
    expect(sessions.get(0)?.map((session) => session.day)).toEqual([1])
    expect(result).toMatchObject({ logCount: 1, skippedLogCount: 1 })
  })

  it("keeps logs a coach adjustment carried over, even though their snapshot names the old program", async () => {
    mocks.logs.mockResolvedValue([
      log({ startedAt: new Date("2026-09-22T08:00:00Z"), workoutSnapshot: { programId: "p0", scheduledDay: 1, weekIndex: 0 } }),
    ])

    const result = await exportTraineeLogsToGoogleDrive(trainee, range)

    expect(result).toMatchObject({ logCount: 1, skippedLogCount: 0 })
  })

  it("refuses when no log in the range has a week or day to land on", async () => {
    mocks.logs.mockResolvedValue([log({ workoutSnapshot: { scheduledDay: 1 } })])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/Không có buổi tập nào ghi được/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it("refuses when nothing was completed in the range", async () => {
    mocks.logs.mockResolvedValue([])

    await expect(exportTraineeLogsToGoogleDrive(trainee, range)).rejects.toThrow(/Không có buổi tập đã hoàn thành/)
  })
})
