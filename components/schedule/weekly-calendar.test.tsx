import { describe, expect, it } from "vitest"

import { buildWorkoutsForWeek } from "./weekly-calendar"
import type { CoachProgram, TraineeProgram } from "@/lib/fitness/types"
import type { Workout } from "@/lib/types"

/**
 * `weekStart` is a local-midnight Date whose calendar date is the UTC Monday of
 * that week — the shape the calendar itself passes in.
 */
function weekStart(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day)
}

function coachWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    exercises: [],
    id: "day-1",
    isPersonal: false,
    name: "Day 1",
    programId: "program-1",
    scheduledDay: 1,
    weekIndex: 0,
    ...overrides,
  } as Workout
}

const oneWeekCoachProgram: TraineeProgram = {
  assignedAt: new Date("2026-09-10T00:00:00.000Z"),
  duration: 1,
  id: "program-1",
  isPersonal: false,
  name: "Program template — Coach Duc",
  startDate: "2026-09-21",
}

const programDetailsById = {
  "program-1": { workouts: [coachWorkout()] } as unknown as CoachProgram,
}

function idsForWeek(program: TraineeProgram, start: Date, currentWeekWorkouts = [coachWorkout()]) {
  return buildWorkoutsForWeek({
    currentWeekWorkouts,
    programDetailsById,
    programs: [program],
    weekStart: start,
  }).map((workout) => workout.id)
}

describe("buildWorkoutsForWeek", () => {
  it("withholds a one-week coach program until its start week", () => {
    // Reported case: a program starting Mon 21 Sep showed up in the week of the
    // 14th, because a one-week program was treated as a personal routine.
    expect(idsForWeek(oneWeekCoachProgram, weekStart(2026, 8, 14))).toEqual([])
  })

  it("serves it on its start week", () => {
    expect(idsForWeek(oneWeekCoachProgram, weekStart(2026, 8, 21))).toEqual(["day-1"])
  })

  it("stops repeating it once that week is over", () => {
    expect(idsForWeek(oneWeekCoachProgram, weekStart(2026, 8, 28))).toEqual([])
    expect(idsForWeek(oneWeekCoachProgram, weekStart(2026, 9, 12))).toEqual([])
  })

  it("keeps a trainee's own routine on every week", () => {
    const personal: TraineeProgram = {
      assignedAt: new Date("2026-09-10T00:00:00.000Z"),
      duration: 1,
      id: "program-1",
      isPersonal: true,
      name: "Personal routine",
    }

    expect(idsForWeek(personal, weekStart(2026, 8, 14))).toEqual(["day-1"])
    expect(idsForWeek(personal, weekStart(2026, 9, 12))).toEqual(["day-1"])
  })

  it("keeps a session pinned to a real date whatever the program does", () => {
    const dated = coachWorkout({ id: "one-off", scheduledDate: new Date("2026-09-16T00:00:00.000Z") })

    expect(idsForWeek(oneWeekCoachProgram, weekStart(2026, 8, 14), [dated])).toEqual(["one-off"])
  })
})
