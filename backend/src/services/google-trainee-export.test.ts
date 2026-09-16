import { describe, expect, it, vi } from "vitest"
vi.mock("../config/env", () => ({ env: { googleOauthClientId: "test-client", googleOauthClientSecret: "test-secret", googleOauthRedirectUri: "http://localhost/callback", googleTokenEncryptionKey: Buffer.alloc(32, 7).toString("base64") } }))
vi.mock("../lib/prisma", () => ({ prisma: null }))
import { parseGoogleProgramRows } from "./google-program-import.service"
import { buildWeightTrackingRows, buildTraineeWeekGrid, resolveLogPosition, selectPlanWorkoutsForWeek, type PlanDay } from "./google-trainee-export.service"

describe('weight tracking export', () => {
  it('writes numeric kilograms and notes, excluding metrics without weight', () => {
    expect(buildWeightTrackingRows([
      { recordedAt: new Date('2026-09-16T12:00:00Z'), weightKg: 73.3, note: 'Morning measurement' },
      { recordedAt: new Date('2026-09-17T12:00:00Z'), weightKg: null, note: 'Waist only' },
      { recordedAt: new Date('2026-09-18T12:00:00Z'), weightKg: 74, note: null },
    ])).toEqual([['Date', 'Weight (kg)', 'Notes'], ['2026-09-16', 73.3, 'Morning measurement'], ['2026-09-18', 74, '']])
  })
  it('keeps headers when there are no weight measurements', () => {
    expect(buildWeightTrackingRows([])).toEqual([['Date', 'Weight (kg)', 'Notes']])
  })
})

const plan: PlanDay[] = [{
  day: 1,
  exercises: [
    { exerciseName: "Bench Press", muscleGroup: "Chest", order: 1, repRange: "8-12", sets: 3, variationId: "v1", variationName: "Barbell", weight: 60, rir: 2 },
    { exerciseName: "Fly", muscleGroup: "Chest", order: 2, repRange: "12", sets: 2, variationId: "v2", variationName: "Cable" },
  ],
}]

describe("trainee program sheet grid", () => {
  it("writes each logged exercise onto its planned row, naming a swap and keeping added exercises", () => {
    const grid = buildTraineeWeekGrid(1, plan, [{
      day: 1,
      exercises: [
        { order: 1, originalVariationId: "v1", variation: { id: "v3", name: "Incline" }, exercise: { name: "Press" }, sets: [{ setNumber: 1, completed: true, actualReps: 10, weight: 55 }, { setNumber: 2, completed: false }] },
        { variation: { id: "v9", name: "Default" }, exercise: { name: "Dips", muscleGroup: "Chest" }, sets: [{ setNumber: 1, completed: true, actualReps: 12 }] },
      ],
    }])

    expect(grid.values[0]).toEqual(["Week 2"])
    expect(grid.resultRowCount).toBe(2)
    const [bench, fly, dips] = grid.values.slice(2)
    expect(bench.slice(0, 11)).toEqual([1, "Chest", "Bench Press", "Barbell", "v1", 3, "8-12", 60, "Press / Incline", "10 × 55 kg", ""])
    expect(fly.slice(8, 10)).toEqual(["", ""])
    expect(dips.slice(2, 5)).toEqual(["Dips", "Default", "v9"])
    expect(dips.at(-1)).toBe("Added during session")
    expect(grid.dayBlocks).toEqual([{ startRowIndex: 2, endRowIndex: 5 }])
  })

  it("stays readable by the program sheet importer, including extra set columns", () => {
    const grid = buildTraineeWeekGrid(0, plan, [{ day: 1, exercises: [{ order: 2, variation: { id: "v2" }, sets: [{ setNumber: 7, completed: true, actualReps: 8, weight: 20 }] }] }])
    expect(grid.setColumns).toBe(7)
    const rows = parseGoogleProgramRows(grid.values.map((row) => row.map(String)))
    expect(rows.map((row) => [row.scheduledDay, row.order, row.variationId, row.reps])).toEqual([[1, 1, "v1", "8-12"], [1, 2, "v2", "12"]])
  })
})

describe("trainee program weeks", () => {
  it("repeats the last authored week and keeps dated workouts to their own week", () => {
    const weekStart = new Date("2026-09-14T00:00:00Z")
    const workouts = [
      { id: "w0", weekIndex: 0, scheduledDate: null },
      { id: "w1", weekIndex: 1, scheduledDate: null },
      { id: "dated", weekIndex: null, scheduledDate: new Date("2026-09-16T00:00:00Z") },
      { id: "other", weekIndex: null, scheduledDate: new Date("2026-09-30T00:00:00Z") },
    ]
    expect(selectPlanWorkoutsForWeek(workouts, 3, weekStart).map((workout) => workout.id)).toEqual(["w1", "dated"])
    expect(selectPlanWorkoutsForWeek(workouts, 0, weekStart).map((workout) => workout.id)).toEqual(["w0", "dated"])
  })

  it("places a log by its planned day relative to the program's first week", () => {
    const anchor = new Date("2026-09-07T00:00:00Z")
    expect(resolveLogPosition({ plannedDate: new Date("2026-09-17T00:00:00Z"), startedAt: new Date("2026-09-18T09:00:00Z"), workoutSnapshot: { scheduledDay: 4 } }, anchor)).toEqual({ day: 4, weekIndex: 1 })
    expect(resolveLogPosition({ plannedDate: null, startedAt: new Date("2026-09-06T09:00:00Z"), workoutSnapshot: null }, anchor)).toEqual({ day: 7, weekIndex: -1 })
  })
})
