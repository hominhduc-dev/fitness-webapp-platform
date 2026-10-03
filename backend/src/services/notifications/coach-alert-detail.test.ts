import { describe, expect, it } from "vitest"

import { systemLandmarksForMuscle } from "../volume-recovery/volume-landmarks"
import { buildCoachAlertDetail, type DetailCheckIn, type DetailLog } from "./coach-alert-detail"

const raisedAt = new Date("2026-09-28T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(raisedAt.getTime() - days * DAY_MS)

function benchLog(day: number, weight: number, reps: number, workoutName = "Push"): DetailLog {
  return {
    exerciseSnapshot: [{
      exercise: { id: "exercise-bench", name: "Bench Press" },
      sets: [{ actualReps: reps, completed: true, setNumber: 1, weight }, { actualReps: 4, completed: true, intensityTag: "warmup", setNumber: 0, weight: 40 }],
      variation: { id: "variation-bench", isDefault: true, name: "Default", primaryMuscles: ["chest"] },
    }],
    startedAt: daysAgo(day),
    workoutName,
  }
}

function checkIn(day: number, readinessScore: number | null, extra: Partial<DetailCheckIn> = {}): DetailCheckIn {
  return { checkInDate: daysAgo(day), fatigue: 3, maxSoreness: null, note: null, readinessScore, sleepMinutes: 420, sleepQuality: 3, stress: 2, ...extra }
}

const base = {
  checkIns: [] as DetailCheckIn[],
  exerciseNotes: [],
  landmarksFor: systemLandmarksForMuscle,
  logs: [] as DetailLog[],
  plateauExercises: ["Bench Press"],
  raisedAt,
  summaries: [],
  workoutsPerWeek: 4,
}

describe("plateau detail", () => {
  const flat = [2, 9, 16, 23].map((day) => benchLog(day, 100, 5))

  it("draws the judged weeks and the one before, oldest first, ignoring warm-ups", () => {
    const { plateau } = buildCoachAlertDetail({ ...base, kind: "plateau", logs: flat })
    const [lift] = plateau!.lifts

    expect(lift).toMatchObject({ key: "variation-bench", name: "Bench Press", primaryMuscles: ["chest"] })
    expect(lift.weeks.map((week) => week.weeksAgo)).toEqual([3, 2, 1, 0])
    expect(lift.weeks.every((week) => week.topWeight === 100 && week.topReps === 5 && week.sessions === 1)).toBe(true)
    expect(lift.sinceAlert).toEqual({ bestE1rm: null, progressed: false, sessions: 0, topWeight: null })
  })

  it("says the alert is resolved once every named lift beats its judged weeks", () => {
    const detail = buildCoachAlertDetail({ ...base, kind: "plateau", logs: [...flat, benchLog(-2, 100, 6)] })

    expect(detail.plateau!.lifts[0].sinceAlert).toMatchObject({ progressed: true, sessions: 1 })
    expect(detail.suggestions[0]).toBe("resolved")
  })

  it("points at volume when the muscle sat near its MRV, at recovery when readiness was low, and at the trainee's notes", () => {
    const chest = systemLandmarksForMuscle("chest")
    const detail = buildCoachAlertDetail({
      ...base,
      checkIns: [checkIn(3, 45), checkIn(10, 55)],
      exerciseNotes: [{ date: daysAgo(9), exerciseName: "Bench Press", note: "Shoulder hurts" }],
      kind: "plateau",
      logs: flat,
      summaries: [7, 14].map((day) => ({ averageRir: 1, effectiveSets: chest.mrvSets, muscleSlug: "chest", weekStart: daysAgo(day) })),
    })

    expect(detail.suggestions).toEqual(["reduce_volume", "review_recovery", "read_notes", "change_stimulus"])
    expect(detail.plateau!.readinessAverage).toBe(50)
    expect(detail.plateau!.lifts[0].notes).toEqual([{ date: "2026-09-19", note: "Shoulder hurts" }])
    expect(detail.plateau!.muscles[0].weeks.map((week) => week.zone)).toEqual(["near_mrv", "near_mrv"])
  })
})

describe("missed workouts detail", () => {
  it("lists the judged week's sessions and counts the weeks before", () => {
    const detail = buildCoachAlertDetail({
      ...base,
      kind: "missed_workouts",
      logs: [benchLog(2, 100, 5, "Push"), benchLog(9, 100, 5), benchLog(10, 100, 5), benchLog(16, 100, 5)],
    })

    expect(detail.missedWorkouts).toEqual({
      planned: 4,
      sessions: [{ date: "2026-09-26", workoutName: "Push" }],
      sinceAlert: 0,
      weeks: [{ completed: 0, weeksAgo: 3 }, { completed: 1, weeksAgo: 2 }, { completed: 2, weeksAgo: 1 }, { completed: 1, weeksAgo: 0 }],
    })
    expect(detail.suggestions).toEqual(["message_trainee", "check_schedule"])
  })
})

describe("low readiness detail", () => {
  it("shows two weeks of check-ins and calls it resolved once readiness is back", () => {
    const checkIns = [20, 3, 2, 1].map((day) => checkIn(day, 40)).concat(checkIn(-1, 72, { note: "Slept well" }))
    const detail = buildCoachAlertDetail({ ...base, checkIns, kind: "low_readiness" })

    expect(detail.lowReadiness!.checkIns.map((entry) => [entry.date, entry.readiness, entry.sinceAlert])).toEqual([
      ["2026-09-25", 40, false],
      ["2026-09-26", 40, false],
      ["2026-09-27", 40, false],
      ["2026-09-29", 72, true],
    ])
    expect(detail.suggestions).toEqual(["resolved", "review_recovery"])
  })
})
