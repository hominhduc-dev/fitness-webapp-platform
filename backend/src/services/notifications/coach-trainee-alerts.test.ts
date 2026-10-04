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

  describe("judged on comparable sessions, not calendar weeks", () => {
    function session(day: number, options: {
      phase?: string
      progression?: { action: string; muscleAction?: string }
      range?: [number, number]
      variation?: string
      weight?: number
    } = {}) {
      const [min, max] = options.range ?? [8, 10]
      const variation = options.variation ?? "bench"
      return {
        exerciseSnapshot: [{
          exercise: { id: `exercise-${variation}`, name: variation === "bench" ? "Bench Press" : "Machine Chest Press" },
          progression: options.progression,
          sets: [{ actualReps: 8, completed: true, rir: 2, setNumber: 1, targetReps: max, targetRepsMin: min, targetRir: 2, weight: options.weight ?? 80 }],
          variation: { id: `variation-${variation}`, isDefault: true, name: "Default", primaryMuscles: ["chest"] },
        }],
        startedAt: daysAgo(day),
        workoutSnapshot: options.phase ? { phase: options.phase } : null,
      }
    }
    const detect = (logs: ReturnType<typeof session>[]) => detectCoachTraineeAlerts({ checkIns: [], logs, now, workoutsPerWeek: 0 })
    const stalled = [{ exercises: ["Bench Press"], kind: "plateau" }]

    it("waits for a third bench session when the gym's bench was taken one week", () => {
      const swapped = [session(16), session(9, { variation: "machine", weight: 60 }), session(2)]
      expect(detect(swapped)).toEqual([])
      // The machine press is its own lift; the bench gets its third session a week later.
      expect(detect([session(23), ...swapped])).toEqual(stalled)
    })

    it("starts over when the coach moves the rep range, but not when only the sets change", () => {
      expect(detect([session(16, { range: [8, 10] }), session(9, { range: [15, 20] }), session(2, { range: [15, 20] })])).toEqual([])
      expect(detect([session(16, { range: [8, 10] }), session(9, { range: [6, 8] }), session(2, { range: [8, 10] })])).toEqual(stalled)
    })

    it("skips deload sessions and the lighter ones the engine asked for, without breaking the run", () => {
      expect(detect([session(16), session(12, { phase: "deload", weight: 70 }), session(9), session(2)])).toEqual(stalled)
      expect(detect([session(16), session(9, { progression: { action: "reduce_load" }, weight: 72.5 }), session(2)])).toEqual([])
      expect(detect([session(23), session(16), session(9, { progression: { action: "maintain", muscleAction: "deload" } }), session(2)])).toEqual(stalled)
    })

    it("needs the sessions spread out, and the latest one recent", () => {
      expect(detect([session(6), session(4), session(2)])).toEqual([])
      expect(detect([session(30), session(23), session(16)])).toEqual([])
    })
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
