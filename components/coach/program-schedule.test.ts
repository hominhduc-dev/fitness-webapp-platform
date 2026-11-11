import { describe, expect, it } from "vitest"

import type { Routine, Schedule, ScheduleSlot } from "@/components/coach/program-draft-storage"
import { layoutLoadedSchedule, makeEmptySchedule, resizeScheduleWeeks, resolveWeekPasteBlock } from "@/components/coach/program-schedule"

const routine = (id: string): Routine => ({ exercises: [], id, name: id, tag: "push" })
const session = (id: string) => ({ routine: routine(id) })
const open = { routine: null }

/** "S" session, "o" open training day, "-" rest day. */
function shape(schedule: Schedule) {
  return schedule.map((week) => week.map((slot) => (slot === null ? "-" : slot.routine ? "S" : "o")).join(""))
}

describe("makeEmptySchedule", () => {
  it("starts a new program on Mon, Tue, Thu and Sat", () => {
    expect(shape(makeEmptySchedule(2))).toEqual(["oo-o-o-", "oo-o-o-"])
  })
})

describe("resizeScheduleWeeks", () => {
  // A week the coach laid out away from any pattern: sessions Wed and Sun, Fri open, rest elsewhere.
  const custom: Schedule = [[null, null, session("wed"), null, open, null, session("sun")]]

  it("keeps existing weeks exactly and copies the last week's days into added ones", () => {
    const next = resizeScheduleWeeks(custom, 3)
    expect(shape(next)).toEqual(["--S-o-S", "--o-o-o", "--o-o-o"])
    expect(next[0]).toBe(custom[0])
  })

  it("drops weeks from the end only", () => {
    const twoWeeks: Schedule = [custom[0], [session("mon"), null, null, null, null, null, null]]
    expect(resizeScheduleWeeks(twoWeeks, 1)).toEqual([custom[0]])
  })
})

describe("layoutLoadedSchedule", () => {
  it("makes the days without a session of a filled week rest days", () => {
    const loaded: Schedule = [[session("mon"), open, null, open, null, open, null]]
    expect(shape(layoutLoadedSchedule(loaded))).toEqual(["S------"])
  })

  it("lays out an unfilled week like the nearest filled week before it", () => {
    const loaded: Schedule = [
      [open, open, null, open, null, open, null],
      [null, null, session("w2-wed"), null, session("w2-fri"), null, null],
      [open, open, null, open, null, open, null],
    ]
    expect(shape(layoutLoadedSchedule(loaded))).toEqual(["--o-o--", "--S-S--", "--o-o--"])
  })

  it("keeps the default days when no week has sessions", () => {
    expect(shape(layoutLoadedSchedule(makeEmptySchedule(1)))).toEqual(["oo-o-o-"])
  })
})

describe("resolveWeekPasteBlock", () => {
  const filled: ScheduleSlot = { routine: { ...routine("push"), exercises: [{ id: "e", reps: "8", sets: 3, variationId: "bench", weight: "" }] } }
  // Week 1 holds a session, weeks 2 to 5 are empty: an imported week the coach copies on.
  const schedule: Schedule = [[filled, open, null, open, null, open, null], ...makeEmptySchedule(4)]
  const paste = (targetWeekIndex: number, overrides: Partial<Parameters<typeof resolveWeekPasteBlock>[0]> = {}) =>
    resolveWeekPasteBlock({
      copiedWeekIndex: 0,
      currentWeekIndex: 1,
      isArchived: false,
      isProgramCompleted: false,
      schedule,
      targetWeekIndex,
      ...overrides,
    })

  it("pastes week 1 onto the empty week the trainee is in", () => {
    expect(paste(1)).toBeNull()
  })

  it("pastes onto weeks that have not started", () => {
    expect(paste(2)).toBeNull()
    expect(paste(4)).toBeNull()
  })

  it("keeps a week in progress that already has sessions", () => {
    const current: Schedule = [schedule[0], [filled, open, null, open, null, open, null], ...schedule.slice(2)]
    expect(paste(1, { copiedWeekIndex: 2, schedule: current })).toBe("started")
  })

  it("an open day without exercises does not count as a session to keep", () => {
    const current: Schedule = [schedule[0], [session("draft"), open, null, open, null, open, null], ...schedule.slice(2)]
    expect(paste(1, { schedule: current })).toBeNull()
  })

  it("keeps weeks already trained, and every week of a finished program", () => {
    expect(paste(0, { copiedWeekIndex: 3, currentWeekIndex: 2 })).toBe("started")
    expect(paste(3, { currentWeekIndex: null, isProgramCompleted: true })).toBe("started")
  })

  it("pastes anywhere else when no trainee is on the program yet", () => {
    expect(paste(1, { currentWeekIndex: null })).toBeNull()
  })

  it("needs a copied week other than the target, on a program that is not archived", () => {
    expect(paste(1, { copiedWeekIndex: null })).toBe("nothing-copied")
    expect(paste(0)).toBe("same-week")
    expect(paste(2, { isArchived: true })).toBe("archived")
  })
})
