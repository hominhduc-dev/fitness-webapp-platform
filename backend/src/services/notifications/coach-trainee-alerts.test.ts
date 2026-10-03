import { describe, expect, it } from "vitest"

import { buildCoachTraineeAlertDraft, detectCoachTraineeAlerts } from "./coach-trainee-alerts"

const now = new Date("2026-09-28T12:00:00.000Z")
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

function benchLog(day: number, weight: number, reps = 5, rir?: number) {
  return {
    exerciseSnapshot: [
      {
        exercise: { id: "exercise-bench", name: "Bench Press" },
        sets: [{ actualReps: reps, completed: true, rir, setNumber: 1, weight }],
        variation: { id: "variation-bench", isDefault: true, name: "Default" },
      },
    ],
    startedAt: daysAgo(day),
  }
}

describe("coach trainee alerts", () => {
  it("flags sessions missed against the plan over the last seven days", () => {
    const alerts = detectCoachTraineeAlerts({ checkIns: [], logs: [benchLog(2, 100)], now, workoutsPerWeek: 4 })

    expect(alerts).toEqual([{ completed: 1, kind: "missed_workouts", planned: 4 }])
    expect(detectCoachTraineeAlerts({ checkIns: [], logs: [benchLog(2, 100)], now, workoutsPerWeek: 0 })).toEqual([])
  })

  it("flags three consecutive days of low readiness, but not an old or broken streak", () => {
    const streak = [1, 2, 3].map((day) => ({ checkInDate: daysAgo(day), readinessScore: 40 }))

    expect(detectCoachTraineeAlerts({ checkIns: streak, logs: [], now, workoutsPerWeek: 0 }))
      .toEqual([{ averageReadiness: 40, days: 3, kind: "low_readiness" }])

    const broken = [...streak.slice(0, 2), { checkInDate: daysAgo(3), readinessScore: 75 }]
    expect(detectCoachTraineeAlerts({ checkIns: broken, logs: [], now, workoutsPerWeek: 0 })).toEqual([])

    const old = [6, 7, 8].map((day) => ({ checkInDate: daysAgo(day), readinessScore: 40 }))
    expect(detectCoachTraineeAlerts({ checkIns: old, logs: [], now, workoutsPerWeek: 0 })).toEqual([])
  })

  it("flags a lift with no e1RM gain across three weeks of training", () => {
    const stalled = [benchLog(16, 100), benchLog(9, 100), benchLog(2, 97.5)]
    const progressing = [benchLog(16, 100), benchLog(9, 100), benchLog(2, 102.5)]

    expect(detectCoachTraineeAlerts({ checkIns: [], logs: stalled, now, workoutsPerWeek: 0 }))
      .toEqual([{ exercises: ["Bench Press"], kind: "plateau" }])
    expect(detectCoachTraineeAlerts({ checkIns: [], logs: progressing, now, workoutsPerWeek: 0 })).toEqual([])
    // Two weeks of data is too little to call a plateau.
    expect(detectCoachTraineeAlerts({ checkIns: [], logs: stalled.slice(1), now, workoutsPerWeek: 0 })).toEqual([])
  })

  it("does not call a lift still adding reps at the same load a plateau", () => {
    // 80×8 @2, 80×9 @1, 80×10 @0 all estimate the same e1RM once RIR is counted.
    const repProgress = [benchLog(16, 80, 8, 2), benchLog(9, 80, 9, 1), benchLog(2, 80, 10, 0)]
    expect(detectCoachTraineeAlerts({ checkIns: [], logs: repProgress, now, workoutsPerWeek: 0 })).toEqual([])

    // The same reps at the same load and effort for three weeks is.
    const flat = [benchLog(16, 80, 8, 2), benchLog(9, 80, 8, 2), benchLog(2, 80, 8, 2)]
    expect(detectCoachTraineeAlerts({ checkIns: [], logs: flat, now, workoutsPerWeek: 0 }))
      .toEqual([{ exercises: ["Bench Press"], kind: "plateau" }])
  })

  it("dedupes each alert per coach, trainee, kind and week, and links to it", () => {
    const draft = buildCoachTraineeAlertDraft({
      alert: { exercises: ["Bench Press"], kind: "plateau" },
      coachId: "coach-1",
      trainee: { id: "trainee-1", name: "An" },
      weekStartKey: "2026-09-28",
    })

    expect(draft).toMatchObject({
      dedupeKey: "coach_trainee_alert:coach-1:trainee-1:plateau:2026-09-28",
      metadata: { exercises: ["Bench Press"], kind: "plateau", traineeName: "An" },
      // Opens the alert itself, which the dedupe key names.
      url: "/coach/trainees/trainee-1/alerts/plateau?week=2026-09-28",
    })
  })
})
