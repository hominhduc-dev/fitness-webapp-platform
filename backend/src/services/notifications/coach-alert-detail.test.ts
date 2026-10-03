import { describe, expect, it } from "vitest"

import { systemLandmarksForMuscle } from "../volume-recovery/volume-landmarks"
import { buildCoachAlertDetail, type DetailCheckIn, type DetailLog } from "./coach-alert-detail"

const raisedAt = new Date("2026-09-28T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(raisedAt.getTime() - days * DAY_MS)

function benchLog(day: number, weight: number, reps: number, workoutName = "Push", extra: { notes?: string; range?: [number, number]; traineeNote?: string } = {}): DetailLog {
  const [min, max] = extra.range ?? [4, 6]
  return {
    exerciseSnapshot: [{
      exercise: { id: "exercise-bench", name: "Bench Press" },
      id: "we-bench",
      notes: extra.notes,
      sets: [
        { actualReps: reps, completed: true, setNumber: 1, targetReps: max, targetRepsMin: min, weight },
        { actualReps: 4, completed: true, intensityTag: "warmup", setNumber: 0, targetReps: 4, weight: 40 },
      ],
      ...(extra.traineeNote ? { traineeNote: extra.traineeNote } : {}),
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
  coachNotes: new Map([["we-bench", "Pause on the chest"]]),
  landmarksFor: systemLandmarksForMuscle,
  logs: [] as DetailLog[],
  plateauExercises: ["Bench Press"],
  raisedAt,
  weekStartOf: (date: Date) => date.toISOString().slice(0, 10),
  workoutsPerWeek: 4,
}

describe("plateau detail", () => {
  const flat = [2, 9, 16, 23].map((day) => benchLog(day, 100, 5))

  it("lists the lift's sessions oldest first, marking the ones it was judged on", () => {
    const { plateau } = buildCoachAlertDetail({ ...base, kind: "plateau", logs: flat })
    const [lift] = plateau!.lifts

    expect(lift).toMatchObject({ key: "variation-bench", name: "Bench Press", primaryMuscles: ["chest"] })
    expect(lift.exposures.map((exposure) => [exposure.date, exposure.status])).toEqual([
      ["2026-09-05", "earlier"],
      ["2026-09-12", "judged"],
      ["2026-09-19", "judged"],
      ["2026-09-26", "judged"],
    ])
    expect(lift.exposures[0]).toMatchObject({ prescription: { repMax: 6, repMin: 4, targetRir: null }, topReps: 5, topWeight: 100 })
    expect(lift.sinceAlert).toEqual({ bestE1rm: null, progressed: false, sessions: 0, topWeight: null })
  })

  it("marks sessions under another prescription as another block", () => {
    const logs = [benchLog(30, 60, 15, "Push", { range: [15, 20] }), ...flat.slice(0, 3)]
    const statuses = buildCoachAlertDetail({ ...base, kind: "plateau", logs }).plateau!.lifts[0].exposures.map((exposure) => exposure.status)
    expect(statuses).toEqual(["not_comparable", "judged", "judged", "judged"])
  })

  it("says the alert is resolved once every named lift beats its judged sessions", () => {
    const detail = buildCoachAlertDetail({ ...base, kind: "plateau", logs: [...flat, benchLog(-2, 100, 6)] })

    expect(detail.plateau!.lifts[0].sinceAlert).toMatchObject({ progressed: true, sessions: 1 })
    expect(detail.suggestions[0]).toBe("resolved")
  })

  it("reads the trainee's own notes, recorded apart or told from the coach's note", () => {
    const logs = [
      benchLog(23, 100, 5, "Push", { notes: "Pause on the chest" }),
      benchLog(16, 100, 5, "Push", { notes: "Shoulder hurts" }),
      benchLog(9, 100, 5, "Push", { notes: "Pause on the chest", traineeNote: "Grip felt off" }),
      benchLog(2, 100, 5),
    ]
    expect(buildCoachAlertDetail({ ...base, kind: "plateau", logs }).plateau!.lifts[0].notes).toEqual([
      { date: "2026-09-12", note: "Shoulder hurts" },
      { date: "2026-09-19", note: "Grip felt off" },
    ])
  })

  it("counts the muscles' weekly volume from the logs, and points at volume and recovery", () => {
    const chest = systemLandmarksForMuscle("chest")
    const heavy = (day: number): DetailLog => ({
      ...benchLog(day, 100, 5),
      exerciseSnapshot: [{
        exercise: { id: "exercise-bench", name: "Bench Press" },
        sets: Array.from({ length: chest.mrvSets }, (_, index) => ({ actualReps: 5, completed: true, rir: 1, setNumber: index + 1, targetReps: 6, targetRepsMin: 4, weight: 100 })),
        variation: { id: "variation-bench", isDefault: true, name: "Default", primaryMuscles: ["chest"] },
      }],
    })
    const detail = buildCoachAlertDetail({
      ...base,
      checkIns: [checkIn(3, 45), checkIn(10, 55)],
      kind: "plateau",
      logs: [heavy(16), heavy(9), heavy(2)],
    })

    expect(detail.plateau!.muscles[0]).toMatchObject({ muscleSlug: "chest" })
    expect(detail.plateau!.muscles[0].weeks.map((week) => [week.effectiveSets, week.zone])).toEqual([
      [chest.mrvSets, "near_mrv"],
      [chest.mrvSets, "near_mrv"],
      [chest.mrvSets, "near_mrv"],
    ])
    expect(detail.plateau!.readinessAverage).toBe(50)
    expect(detail.suggestions).toEqual(["reduce_volume", "review_recovery", "change_stimulus"])
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
