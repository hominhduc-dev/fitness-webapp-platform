import { describe, expect, it } from "vitest"

import { formatDateToISO, getProgramStartDate } from "./date-range"

describe("getProgramStartDate", () => {
  it("opens week 1 on the program's start date rather than the assignment week", () => {
    // Assigned Thursday 17 Sep, program starts Monday 21 Sep: a session trained
    // on the 17th was never part of week 1.
    const start = getProgramStartDate(new Date("2026-09-17T08:36:31Z"), 4, "2026-09-21")

    expect(formatDateToISO(start)).toBe("2026-09-21")
  })

  it("snaps a mid-week start date back to that week's Monday", () => {
    expect(formatDateToISO(getProgramStartDate(new Date("2026-09-01"), 4, "2026-09-24"))).toBe("2026-09-21")
  })

  it("falls back to the assignment week when no start date is set", () => {
    expect(formatDateToISO(getProgramStartDate(new Date("2026-09-17T08:36:31Z"), 4))).toBe("2026-09-14")
    expect(formatDateToISO(getProgramStartDate(new Date("2026-09-17T08:36:31Z"), 4, null))).toBe("2026-09-14")
  })
})
