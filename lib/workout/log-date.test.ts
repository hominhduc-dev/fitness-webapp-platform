import { describe, expect, it } from "vitest"
import { matchesWorkoutSchedule } from "./log-date"

const monday = new Date(2026, 10, 2, 12)
const saturday = new Date(2026, 10, 7, 12)

describe("workout completion date confirmation", () => {
  it("saves without asking on the coach's recurring weekday", () => {
    expect(matchesWorkoutSchedule({ scheduledDay: 1 }, monday)).toBe(true)
  })
  it("asks when a Monday workout is logged on Saturday, including a preset date", () => {
    expect(matchesWorkoutSchedule({ scheduledDay: 1 }, saturday)).toBe(false)
  })
  it("matches an explicit scheduled date by local calendar day", () => {
    expect(matchesWorkoutSchedule({ scheduledDate: new Date(2026, 10, 2) }, monday)).toBe(true)
  })
  it("does not let the recurring weekday override a different explicit date", () => {
    expect(matchesWorkoutSchedule({ scheduledDate: new Date(2026, 9, 26), scheduledDay: 1 }, monday)).toBe(false)
  })
  it("asks when no schedule is known", () => {
    expect(matchesWorkoutSchedule({}, saturday)).toBe(false)
  })
})
