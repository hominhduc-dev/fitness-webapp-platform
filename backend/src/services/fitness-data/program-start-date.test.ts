import { describe, expect, it } from "vitest"

import { selectVisibleWorkoutsForAssignmentWeek } from "./core"

type TestWorkout = { id: string; scheduledDate: Date | null; weekIndex: number | null }

const recurring: TestWorkout[] = [
  { id: "week-0", scheduledDate: null, weekIndex: 0 },
  { id: "week-1", scheduledDate: null, weekIndex: 1 },
]
const dated: TestWorkout = { id: "one-off", scheduledDate: new Date("2026-09-09T00:00:00.000Z"), weekIndex: null }

const thisWeek = new Date("2026-09-07T00:00:00.000Z")

function visibleIds(workouts: TestWorkout[], anchor: Date, weekStart: Date, duration = 4) {
  return selectVisibleWorkoutsForAssignmentWeek(workouts as never[], anchor, duration, weekStart).map(
    (workout) => (workout as unknown as TestWorkout).id,
  )
}

describe("a program that has not started yet", () => {
  it("serves nothing recurring before its start week", () => {
    // The coach pinned week 1 to Mon 14 Sep; this is the week before.
    expect(visibleIds(recurring, new Date("2026-09-14T00:00:00.000Z"), thisWeek)).toEqual([])
  })

  it("still serves a session pinned to a real date in that week", () => {
    expect(visibleIds([...recurring, dated], new Date("2026-09-14T00:00:00.000Z"), thisWeek)).toEqual(["one-off"])
  })

  it("serves week 1 once its start week arrives", () => {
    const startWeek = new Date("2026-09-14T00:00:00.000Z")

    expect(visibleIds(recurring, startWeek, startWeek)).toEqual(["week-0"])
  })

  it("moves on to week 2 the week after that", () => {
    expect(
      visibleIds(recurring, new Date("2026-09-14T00:00:00.000Z"), new Date("2026-09-21T00:00:00.000Z")),
    ).toEqual(["week-1"])
  })

  it("counts from the assignment when no start date is set, so nothing is withheld", () => {
    // An assignment is never in the future, so this path is unchanged.
    expect(visibleIds(recurring, new Date("2026-09-09T00:00:00.000Z"), thisWeek)).toEqual(["week-0"])
  })
})
