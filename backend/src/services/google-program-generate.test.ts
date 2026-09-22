import { beforeEach, describe, expect, it, vi } from "vitest"
import { parseSetIntensityMethodCell, type SetIntensityAssignment } from "../domain/set-intensity-tag"
import { WEEK_HEADERS } from "../domain/google-program-sheet"

const mocks = vi.hoisted(() => ({
  assertOwns: vi.fn(),
  batch: vi.fn(),
  createTemplate: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}))
vi.mock("./fitness-data/core", () => ({ assertCoachOwnsProgram: mocks.assertOwns }))
vi.mock("./fitness-data/shared/guards", () => ({
  assertCoach: vi.fn(),
  ensurePrisma: () => ({ program: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } }),
}))
vi.mock("./google-connection.service", () => ({ getGoogleAccessToken: vi.fn().mockResolvedValue("test-token") }))
vi.mock("./google-program-template.service", () => ({ createGoogleProgramTemplate: mocks.createTemplate }))
vi.mock("../lib/google", () => ({ batchUpdateSpreadsheet: mocks.batch }))

import {
  buildProgramSheetRequests,
  generateProgramSpreadsheet,
  selectProgramWeekWorkouts,
  toPlanDays,
  variationDisplayName,
  type SourceExercise,
  type SourceSet,
  type SourceWorkout,
} from "./google-program-generate.service"
import type { SerializedProfile } from "./auth.service"

const set = (overrides: Partial<SourceSet> = {}): SourceSet => ({
  intensityTag: null,
  rir: null,
  setNumber: 1,
  targetReps: 10,
  targetRepsMin: null,
  weight: null,
  ...overrides,
})

const exercise = (overrides: Partial<SourceExercise> = {}): SourceExercise => ({
  notes: null,
  order: 1,
  restTime: null,
  sets: [set()],
  variation: { exercise: { muscleGroup: "Chest", name: "Bench Press" }, id: "var-1", isDefault: true, name: "Barbell" },
  ...overrides,
})

const workout = (overrides: Partial<SourceWorkout> = {}): SourceWorkout => ({
  exercises: [exercise()],
  scheduledDate: null,
  scheduledDay: 1,
  weekIndex: 0,
  ...overrides,
})

describe("variationDisplayName", () => {
  it("names a default variation after the exercise alone", () => {
    expect(variationDisplayName(exercise().variation)).toBe("Bench Press")
  })

  it("qualifies a non-default variation, matching the reference tab", () => {
    const variation = { ...exercise().variation, isDefault: false }
    expect(variationDisplayName(variation)).toBe("Bench Press (Barbell)")
  })
})

describe("selectProgramWeekWorkouts", () => {
  it("repeats the last authored week for a week the coach never wrote", () => {
    const workouts = [workout({ weekIndex: 0 }), workout({ scheduledDay: 2, weekIndex: 2 })]

    expect(selectProgramWeekWorkouts(workouts, 1).map((entry) => entry.weekIndex)).toEqual([0])
    expect(selectProgramWeekWorkouts(workouts, 2).map((entry) => entry.weekIndex)).toEqual([2])
    expect(selectProgramWeekWorkouts(workouts, 9).map((entry) => entry.weekIndex)).toEqual([2])
  })

  it("falls forward to the earliest authored week when asked for one before it", () => {
    const workouts = [workout({ weekIndex: 3 })]
    expect(selectProgramWeekWorkouts(workouts, 0).map((entry) => entry.weekIndex)).toEqual([3])
  })

  it("leaves out workouts pinned to a calendar date", () => {
    const workouts = [workout({ scheduledDate: new Date("2026-03-12"), weekIndex: 0 })]
    expect(selectProgramWeekWorkouts(workouts, 0)).toEqual([])
  })
})

describe("toPlanDays", () => {
  it("groups by day and orders exercises within a day", () => {
    const days = toPlanDays([
      workout({
        exercises: [
          exercise({ order: 2, variation: { ...exercise().variation, id: "var-2" } }),
          exercise({ order: 1, variation: { ...exercise().variation, id: "var-1" } }),
        ],
        scheduledDay: 3,
      }),
      workout({ scheduledDay: 1 }),
    ])

    expect(days.map((day) => day.day)).toEqual([1, 3])
    expect(days[1].exercises.map((entry) => entry.variationId)).toEqual(["var-1", "var-2"])
  })

  it("reads sets, reps, weight and RIR off the first set", () => {
    const [day] = toPlanDays([
      workout({
        exercises: [
          exercise({
            notes: "Giữ nhịp",
            restTime: 120,
            sets: [
              set({ rir: 2, setNumber: 1, targetReps: 12, targetRepsMin: 8, weight: 60 }),
              set({ rir: 0, setNumber: 2, targetReps: 10, weight: 70 }),
            ],
          }),
        ],
      }),
    ])

    expect(day.exercises[0]).toMatchObject({
      notes: "Giữ nhịp",
      reps: "8-12",
      restTime: 120,
      rir: 2,
      sets: 2,
      weight: 60,
    })
  })

  it("writes a plain rep target without a range", () => {
    const [day] = toPlanDays([workout({ exercises: [exercise({ sets: [set({ targetReps: 5 })] })] })])
    expect(day.exercises[0].reps).toBe("5")
  })

  it("writes a Method cell the importer reads back to the same tags", () => {
    const sets = [
      set({ intensityTag: "warmup", setNumber: 1 }),
      set({ setNumber: 2 }),
      set({ intensityTag: "mrm", setNumber: 3 }),
    ]
    const [day] = toPlanDays([workout({ exercises: [exercise({ sets })] })])
    const method = day.exercises[0].method!

    const parsed = parseSetIntensityMethodCell(method, sets.length)
    expect(parsed.assignments).toEqual<SetIntensityAssignment[]>([
      { setNumber: 1, tag: "warmup" },
      { setNumber: 3, tag: "mrm" },
    ])
  })

  it("collapses a tag on every set to the all: form, and still round-trips", () => {
    const sets = [
      set({ intensityTag: "drop_set", setNumber: 1 }),
      set({ intensityTag: "drop_set", setNumber: 2 }),
    ]
    const [day] = toPlanDays([workout({ exercises: [exercise({ sets })] })])

    expect(day.exercises[0].method).toBe("all:drop")
    expect(parseSetIntensityMethodCell("all:drop", 2).assignments).toEqual<SetIntensityAssignment[]>([
      { setNumber: 1, tag: "drop_set" },
      { setNumber: 2, tag: "drop_set" },
    ])
  })

  it("leaves the Method cell out when no set carries a tag", () => {
    const [day] = toPlanDays([workout()])
    expect(day.exercises[0].method).toBeUndefined()
  })

  it("skips a workout with no day to sit on", () => {
    expect(toPlanDays([workout({ scheduledDay: null })])).toEqual([])
  })
})

describe("buildProgramSheetRequests", () => {
  it("writes every week onto the tab it belongs to", () => {
    const workouts = [workout({ weekIndex: 0 })]
    const requests = buildProgramSheetRequests(workouts, 3, new Map([[0, 10], [1, 11], [2, 12]]))
    const sheetIds = requests.map(
      (request) => (request as { updateCells?: { start: { sheetId: number } } }).updateCells?.start.sheetId,
    )

    expect(new Set(sheetIds)).toEqual(new Set([10, 11, 12]))
  })

  it("names each week's banner after its own week", () => {
    const requests = buildProgramSheetRequests([workout({ weekIndex: 0 })], 2, new Map([[0, 10], [1, 11]]))
    const banners = (requests as Array<{ updateCells?: { rows: Array<{ values: Array<{ userEnteredValue?: { stringValue?: string } }> }>; start: { columnIndex: number } } }>)
      .filter((request) => request.updateCells?.start.columnIndex === 0)
      .map((request) => request.updateCells!.rows[0].values[0].userEnteredValue?.stringValue)

    expect(banners).toEqual(["Week 1", "Week 2"])
  })

  it("skips a week with no tab of its own rather than writing it twice", () => {
    const requests = buildProgramSheetRequests([workout({ weekIndex: 0 })], 3, new Map([[0, 10]]))
    const sheetIds = new Set(
      requests.map((request) => (request as { updateCells?: { start: { sheetId: number } } }).updateCells?.start.sheetId),
    )

    expect(sheetIds).toEqual(new Set([10]))
  })

  it("falls back to literal values when two variations share a display name", () => {
    // Both are non-default variations of exercises that happen to share a name,
    // so `MATCH` on the reference tab cannot tell them apart.
    const clash = (id: string, name: string) =>
      exercise({
        order: id === "var-a" ? 1 : 2,
        variation: { exercise: { muscleGroup: "Back", name: "Row" }, id, isDefault: false, name },
      })
    const requests = buildProgramSheetRequests(
      [workout({ exercises: [clash("var-a", "Cable"), clash("var-b", "Cable")] })],
      1,
      new Map([[0, 10]]),
    )

    const planWrite = (requests as Array<{ updateCells?: { rows: Array<{ values: Array<{ userEnteredValue?: { formulaValue?: string; stringValue?: string } }> }>; start: { columnIndex: number } } }>)
      .find((request) => request.updateCells?.start.columnIndex === WEEK_HEADERS.indexOf("Muscle Group"))!

    const idColumn = WEEK_HEADERS.indexOf("Variation") + 1 - WEEK_HEADERS.indexOf("Muscle Group")
    expect(planWrite.updateCells!.rows[0].values[idColumn].userEnteredValue?.stringValue).toBe("var-a")
    expect(planWrite.updateCells!.rows[1].values[idColumn].userEnteredValue?.stringValue).toBe("var-b")
  })

  it("refuses a program that needs a seventh training day", () => {
    expect(() =>
      buildProgramSheetRequests([workout({ scheduledDay: 7 })], 1, new Map([[0, 10]])),
    ).toThrow(/6 buổi mỗi tuần/)
  })
})

describe("generateProgramSpreadsheet", () => {
  const coach = { id: "coach", role: "coach" } as SerializedProfile
  const program = (overrides: Record<string, unknown> = {}) => ({
    duration: 1,
    googleSpreadsheetId: null,
    id: "program",
    name: "Push Pull Legs",
    workouts: [workout()],
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.assertOwns.mockResolvedValue(program())
    mocks.createTemplate.mockResolvedValue({
      sheetName: "Week 1",
      spreadsheetId: "sheet-new",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
      weekSheetId: 10,
      weekSheetIndex: 1,
    })
    mocks.batch.mockResolvedValue({ replies: [] })
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it("creates the sheet and claims it for the program", async () => {
    const result = await generateProgramSpreadsheet(coach, "program")

    expect(result).toMatchObject({ created: true, sheetName: "Week 1", spreadsheetId: "sheet-new" })
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { googleSpreadsheetId: null, id: "program" } }),
    )
  })

  it("refuses a seventh training day before creating anything in Drive", async () => {
    mocks.assertOwns.mockResolvedValue(program({ workouts: [workout({ scheduledDay: 7 })] }))

    await expect(generateProgramSpreadsheet(coach, "program")).rejects.toThrow(/6 buổi mỗi tuần/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it("refuses a program that already has a sheet, without touching Drive", async () => {
    mocks.assertOwns.mockResolvedValue(program({ googleSpreadsheetId: "sheet-old" }))

    await expect(generateProgramSpreadsheet(coach, "program")).rejects.toThrow(/đã gắn Google Sheet/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it("refuses a program with no sessions in it", async () => {
    mocks.assertOwns.mockResolvedValue(program({ workouts: [] }))

    await expect(generateProgramSpreadsheet(coach, "program")).rejects.toThrow(/chưa có buổi tập/)
    expect(mocks.createTemplate).not.toHaveBeenCalled()
  })

  it("duplicates week 1 for each later week and writes onto the new tabs", async () => {
    mocks.assertOwns.mockResolvedValue(program({ duration: 3 }))
    mocks.batch.mockResolvedValueOnce({
      replies: [
        { duplicateSheet: { properties: { sheetId: 11 } } },
        { duplicateSheet: { properties: { sheetId: 12 } } },
      ],
    })

    await generateProgramSpreadsheet(coach, "program")

    const duplicates = mocks.batch.mock.calls[0][2] as Array<{ duplicateSheet: { newSheetName: string } }>
    expect(duplicates.map((request) => request.duplicateSheet.newSheetName)).toEqual(["Week 2", "Week 3"])

    const writes = mocks.batch.mock.calls[1][2] as Array<{ updateCells?: { start: { sheetId: number } } }>
    const sheetIds = new Set(writes.map((request) => request.updateCells?.start.sheetId))
    expect(sheetIds).toEqual(new Set([10, 11, 12]))
  })

  it("adopts the winner's sheet when another request claimed the program first", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    mocks.findUnique.mockResolvedValue({ googleSheetName: "Week 1", googleSpreadsheetId: "sheet-winner" })

    const result = await generateProgramSpreadsheet(coach, "program")

    expect(result).toMatchObject({ created: false, spreadsheetId: "sheet-winner" })
    expect(result.spreadsheetUrl).toContain("sheet-winner")
  })
})
