import { describe, expect, it } from "vitest"

import { selectVisibleWorkoutsForAssignmentWeek } from "./core"

/**
 * Weeks are Monday-start UTC, matching `startOfUtcWeek`. Assignment lands on
 * Thursday of the week beginning 2026-08-10, so "week N" below is the Monday
 * that many weeks later.
 */
const ASSIGNED_AT = new Date("2026-08-13T09:00:00.000Z")

function weekStartAfter(weeksElapsed: number) {
  return new Date(Date.UTC(2026, 7, 10 + weeksElapsed * 7))
}

type TestWorkout = { id: string; scheduledDate: Date | null; weekIndex: number | null }

function workout(id: string, weekIndex: number | null, scheduledDate: Date | null = null): TestWorkout {
  return { id, scheduledDate, weekIndex }
}

function visibleIds(workouts: TestWorkout[], duration: number, weeksElapsed: number) {
  return selectVisibleWorkoutsForAssignmentWeek(workouts, ASSIGNED_AT, duration, weekStartAfter(weeksElapsed)).map(
    (item) => item.id,
  )
}

describe("selectVisibleWorkoutsForAssignmentWeek", () => {
  it("keeps a program whose workouts have no weekIndex alive for its full duration", () => {
    // The AI generator authors only the first week and leaves weekIndex unset on
    // older rows. Those used to bypass the filter entirely and never expire.
    const workouts = [workout("a", null), workout("b", null)]

    expect(visibleIds(workouts, 4, 0)).toEqual(["a", "b"])
    expect(visibleIds(workouts, 4, 1)).toEqual(["a", "b"])
    expect(visibleIds(workouts, 4, 3)).toEqual(["a", "b"])
    expect(visibleIds(workouts, 4, 4)).toEqual([])
  })

  it("repeats week 0 for a program that only authored its first week", () => {
    const workouts = [workout("a", 0), workout("b", 0)]

    expect(visibleIds(workouts, 4, 0)).toEqual(["a", "b"])
    expect(visibleIds(workouts, 4, 2)).toEqual(["a", "b"])
    expect(visibleIds(workouts, 4, 4)).toEqual([])
  })

  it("serves the matching week when every week is authored", () => {
    const workouts = [workout("w0", 0), workout("w1", 1), workout("w2", 2), workout("w3", 3)]

    expect(visibleIds(workouts, 4, 0)).toEqual(["w0"])
    expect(visibleIds(workouts, 4, 2)).toEqual(["w2"])
    expect(visibleIds(workouts, 4, 3)).toEqual(["w3"])
  })

  it("carries forward the last authored week when the program stops short", () => {
    const workouts = [workout("w0", 0), workout("w1", 1), workout("w2", 2)]

    expect(visibleIds(workouts, 8, 2)).toEqual(["w2"])
    expect(visibleIds(workouts, 8, 5)).toEqual(["w2"])
    expect(visibleIds(workouts, 8, 7)).toEqual(["w2"])
    expect(visibleIds(workouts, 8, 8)).toEqual([])
  })

  it("never expires a personal routine's synthetic one-week program", () => {
    const workouts = [workout("personal", null)]

    expect(visibleIds(workouts, 1, 0)).toEqual(["personal"])
    expect(visibleIds(workouts, 1, 12)).toEqual(["personal"])
  })

  it("keeps dated one-off workouts regardless of week", () => {
    const dated = workout("dated", null, new Date("2026-09-01T00:00:00.000Z"))
    const workouts = [workout("w0", 0), dated]

    expect(visibleIds(workouts, 4, 0)).toEqual(["w0", "dated"])
    // Still there after the program itself has finished.
    expect(visibleIds(workouts, 4, 9)).toEqual(["dated"])
  })
})
