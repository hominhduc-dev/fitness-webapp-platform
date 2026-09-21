import { describe, expect, it } from "vitest"

import { resolveProgramLockDate, selectVisibleWorkoutsForAssignmentWeek } from "./core"

const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const TRAINEE_ID = "00000000-0000-4000-8000-0000000000a0"

/** Monday 28 September 2026, the start date the coach set. */
const START_DATE = new Date(Date.UTC(2026, 8, 28))
/** Monday 21 September 2026 — the week before, when the trainee is free. */
const WEEK_BEFORE = new Date(Date.UTC(2026, 8, 21))
const START_WEEK = new Date(Date.UTC(2026, 8, 28))

const coachProgram = { createdById: COACH_ID, startDate: START_DATE }

describe("locking a coach program before its start date", () => {
  it("locks the week before the program opens", () => {
    expect(resolveProgramLockDate(coachProgram, TRAINEE_ID, WEEK_BEFORE)).toEqual(START_DATE)
  })

  it("opens for the whole of the starting week, not only from that exact day", () => {
    expect(resolveProgramLockDate(coachProgram, TRAINEE_ID, START_WEEK)).toBeNull()
  })

  it("stays open once the program is running", () => {
    const laterWeek = new Date(Date.UTC(2026, 9, 12))
    expect(resolveProgramLockDate(coachProgram, TRAINEE_ID, laterWeek)).toBeNull()
  })

  /** Without a start date the anchor is the assignment, which is never ahead. */
  it("never locks a program with no start date", () => {
    expect(resolveProgramLockDate({ createdById: COACH_ID, startDate: null }, TRAINEE_ID, WEEK_BEFORE)).toBeNull()
  })

  /** A trainee's own routines are theirs to run whenever they like. */
  it("never locks the trainee's own program", () => {
    expect(resolveProgramLockDate({ createdById: TRAINEE_ID, startDate: START_DATE }, TRAINEE_ID, WEEK_BEFORE))
      .toBeNull()
  })

  it("treats a missing program as unlocked", () => {
    expect(resolveProgramLockDate(null, TRAINEE_ID, WEEK_BEFORE)).toBeNull()
  })

  /**
   * The rule that keeps the product coherent: a trainee is never shown a
   * session they would then be refused. Both sides are week-based, so seeing
   * and training flip on the same boundary.
   */
  it("flips on the same boundary as the visibility gate", () => {
    const recurring = [{ id: "w1", scheduledDate: null, weekIndex: 0 }]

    const visibleBefore = selectVisibleWorkoutsForAssignmentWeek(recurring, START_DATE, 4, WEEK_BEFORE, false)
    expect(visibleBefore).toEqual([])
    expect(resolveProgramLockDate(coachProgram, TRAINEE_ID, WEEK_BEFORE)).not.toBeNull()

    const visibleAfter = selectVisibleWorkoutsForAssignmentWeek(recurring, START_DATE, 4, START_WEEK, false)
    expect(visibleAfter.map((item) => item.id)).toEqual(["w1"])
    expect(resolveProgramLockDate(coachProgram, TRAINEE_ID, START_WEEK)).toBeNull()
  })
})
