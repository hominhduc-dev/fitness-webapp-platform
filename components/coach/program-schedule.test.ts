import { describe, expect, it } from "vitest"

import type { Routine, Schedule } from "@/components/coach/program-draft-storage"
import { layoutLoadedSchedule, makeEmptySchedule, resizeScheduleWeeks } from "@/components/coach/program-schedule"

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
