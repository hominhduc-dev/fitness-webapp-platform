import { describe, expect, it } from "vitest"

import { listPlannedProgramDates } from "./coach-trainee-insight.service"

// 2026-09-14 is a Monday. scheduledDay follows Date#getDay: 1 = Monday, 0 = Sunday.
const recurring = (id: string, scheduledDay: number, weekIndex = 0) => ({ id, scheduledDate: null, scheduledDay, weekIndex })

describe("listPlannedProgramDates", () => {
  it("lays a weekly program onto every week of the window", () => {
    const dates = listPlannedProgramDates(
      [
        {
          assignedAt: new Date("2026-09-01T03:00:00.000Z"),
          program: { duration: 8, startDate: new Date("2026-09-07T00:00:00.000Z"), workouts: [recurring("a", 1), recurring("b", 3), recurring("c", 0)] },
        },
      ],
      "2026-09-16",
      "2026-09-28",
    )
    expect(dates).toEqual(["2026-09-16", "2026-09-20", "2026-09-21", "2026-09-23", "2026-09-27", "2026-09-28"])
  })

  it("counts nothing before a future start date, and a dated session only on its day", () => {
    const dates = listPlannedProgramDates(
      [
        {
          assignedAt: new Date("2026-09-01T03:00:00.000Z"),
          program: {
            duration: 4,
            startDate: new Date("2026-09-28T00:00:00.000Z"),
            workouts: [recurring("a", 1), { id: "test-day", scheduledDate: new Date("2026-09-24T00:00:00.000Z"), scheduledDay: null, weekIndex: null }],
          },
        },
      ],
      "2026-09-14",
      "2026-09-28",
    )
    expect(dates).toEqual(["2026-09-24", "2026-09-28"])
  })

  it("stops after the program's last week", () => {
    const dates = listPlannedProgramDates(
      [{ assignedAt: new Date("2026-09-01T03:00:00.000Z"), program: { duration: 1, startDate: new Date("2026-09-14T00:00:00.000Z"), workouts: [recurring("a", 2)] } }],
      "2026-09-14",
      "2026-09-28",
    )
    expect(dates).toEqual(["2026-09-15"])
  })
})
