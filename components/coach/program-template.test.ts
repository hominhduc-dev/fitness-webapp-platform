import { describe, expect, it } from "vitest"
import { buildCoachProgramTemplate, importCoachProgramTemplate } from "./program-excel"
import type { ExerciseVariationOption } from "@/lib/fitness/types"

const exercises = [{ id: "bench-1", exerciseId: "bench", name: "Bench Press", exerciseName: "Bench Press", variationName: "Default", muscleGroup: "chest", isDefault: true, primaryMuscles: [], secondaryMuscles: [], activityType: "strength" }] as unknown as ExerciseVariationOption[]
describe("program template round trip", () => {
  it("keeps the agreed columns, strict dropdown, hidden formula ID and merged days", async () => {
    const workbook = await buildCoachProgramTemplate(exercises, [])
    const sheet = workbook.getWorksheet("Week 1")!
    expect(sheet.getCell("E2").value).toBe("")
    expect(sheet.getColumn(5).hidden).toBe(true)
    expect(sheet.getCell("I2").value).toBe("Substitute Exercise")
    expect(sheet.getCell("O2").value).toBe("RIR")
    expect(sheet.getCell("C3").dataValidation).toMatchObject({ type: "list", errorStyle: "stop", showErrorMessage: true })
    expect(sheet.getCell("I3").dataValidation).toBeUndefined()
    expect(sheet.getCell("A4").isMerged).toBe(true)
    expect(workbook.worksheets.filter((sheet) => /^Week/.test(sheet.name))).toHaveLength(1)

    for (let row = 3; row <= 50; row++) for (const column of [3, 5, 6, 7, 8]) sheet.getCell(row, column).value = ""
    sheet.getCell("C3").value = "Bench Press"
    sheet.getCell("E3").value = { formula: "1", result: "bench-1" }
    sheet.getCell("F3").value = 3
    sheet.getCell("G3").value = "8-12"
    sheet.getCell("P3").value = 90
    const buffer = await workbook.xlsx.writeBuffer()
    const file = { arrayBuffer: async () => buffer } as unknown as File
    const result = await importCoachProgramTemplate(file, exercises, [])
    expect(result.workouts).toHaveLength(8)
    expect(result.workouts[0]).toMatchObject({ scheduledDay: 1, weekIndex: 0, exercises: [expect.objectContaining({ variationId: "bench-1", reps: 12, repsMin: 8, restTime: 90 })] })
    expect(result.workouts[7].weekIndex).toBe(7)
  })
})
