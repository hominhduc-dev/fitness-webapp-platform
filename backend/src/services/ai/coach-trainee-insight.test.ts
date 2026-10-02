import { describe, expect, it } from "vitest"

import type { AIProvider } from "../../lib/ai/types"
import {
  buildCoachInsightFindings,
  coachInsightFingerprint,
  generateCoachTraineeInsight,
  insightWindows,
  validateCoachInsight,
  type CoachInsightInput,
  type InsightLog,
} from "./coach-trainee-insight"

// Today is 2026-09-28; with 7 days the current window is 22–28 and the previous 15–21.
const TODAY = "2026-09-28"

function log(date: string, overrides: Partial<InsightLog> = {}): InsightLog {
  return {
    date,
    exercises: [
      {
        name: "Squat",
        sets: [
          { completed: true, reps: 5, weight: 100 },
          { completed: true, reps: 5, weight: 100 },
        ],
      },
    ],
    fromProgram: true,
    volumeKg: 1000,
    ...overrides,
  }
}

function input(overrides: Partial<CoachInsightInput> = {}): CoachInsightInput {
  return {
    days: 7,
    goals: { calories: 2500, protein: 150, targetWeightKg: 75 },
    intake: ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"].map((date) => ({ calories: 2450, date, protein: 145 })),
    logs: [log("2026-09-16"), log("2026-09-18"), log("2026-09-22"), log("2026-09-24"), log("2026-09-26")],
    plannedDates: ["2026-09-15", "2026-09-17", "2026-09-19", "2026-09-22", "2026-09-24", "2026-09-26", "2026-09-29"],
    recovery: [{ date: "2026-09-27", fatigue: 2, readiness: 80, sleepMinutes: 450, stress: 30 }],
    today: TODAY,
    wearable: [],
    weights: [
      { date: "2026-09-22", weightKg: 80 },
      { date: "2026-09-28", weightKg: 79.5 },
    ],
    ...overrides,
  }
}

const codes = (value: ReturnType<typeof buildCoachInsightFindings>) => value.signals.map((signal) => signal.code)

describe("insightWindows", () => {
  it("ends today and puts the previous window right before it", () => {
    expect(insightWindows(TODAY, 7)).toEqual({
      current: { end: "2026-09-28", start: "2026-09-22" },
      previous: { end: "2026-09-21", start: "2026-09-15" },
    })
    expect(insightWindows("2026-03-01", 28).previous.end).toBe("2026-02-01")
  })
})

describe("buildCoachInsightFindings", () => {
  it("measures program adherence against sessions due so far, not ones still ahead", () => {
    const findings = buildCoachInsightFindings(input())
    expect(findings.current.training).toMatchObject({ adherencePct: 100, completed: 3, planned: 3, setsCompleted: 6, setsTotal: 6 })
    expect(findings.previous.training).toMatchObject({ adherencePct: 67, completed: 2, planned: 3 })
    expect(codes(findings)).toContain("adherence_high")
  })

  it("keeps sessions outside the program out of adherence and flags skipped sets", () => {
    const logs = [
      log("2026-09-22", { exercises: [{ name: "Squat", sets: [{ completed: true, reps: 5, weight: 100 }, { completed: false, reps: null, weight: 100 }] }] }),
      log("2026-09-23", { fromProgram: false }),
    ]
    const findings = buildCoachInsightFindings(input({ logs }))
    expect(findings.current.training).toMatchObject({ adherencePct: 33, completed: 1, extraSessions: 1, setsCompleted: 1, setsTotal: 2 })
    expect(codes(findings)).toEqual(expect.arrayContaining(["adherence_low", "sets_skipped"]))
  })

  it("compares each main lift's best estimated 1RM with the previous window", () => {
    const logs = [log("2026-09-16"), log("2026-09-23", { exercises: [{ name: "Squat", sets: [{ completed: true, reps: 5, weight: 105 }] }] })]
    const [squat] = buildCoachInsightFindings(input({ logs })).lifts
    expect(squat).toMatchObject({ best: { e1rm: 122.5, reps: 5, weight: 105 }, changePct: 5, name: "Squat", previousBest: { weight: 100 } })
    expect(codes(buildCoachInsightFindings(input({ logs })))).toContain("lifts_up")
  })

  it("reads weight against the target and intake against the goals", () => {
    const findings = buildCoachInsightFindings(input())
    expect(findings.current.weight).toEqual({ change: -0.5, entries: 2, first: 80, last: 79.5 })
    expect(findings.toTargetKg).toBe(-4.5)
    expect(findings.current.nutrition).toMatchObject({ avgCalories: 2450, avgProtein: 145, caloriePct: 98, loggedDays: 5, proteinPct: 97 })
    expect(codes(findings)).toEqual(expect.arrayContaining(["weight_toward_target", "intake_on_target", "readiness_good"]))

    const gaining = buildCoachInsightFindings(input({ weights: [{ date: "2026-09-22", weightKg: 79 }, { date: "2026-09-28", weightKg: 80 }] }))
    expect(codes(gaining)).toEqual(expect.arrayContaining(["weight_away_from_target", "weight_changing_fast"]))
  })

  it("says so when logging is sparse and recovery is poor, rather than averaging empty days", () => {
    const findings = buildCoachInsightFindings(
      input({
        intake: [{ calories: 1500, date: "2026-09-27", protein: 80 }],
        recovery: [{ date: "2026-09-27", fatigue: 4, readiness: 40, sleepMinutes: 330, stress: 70 }],
      }),
    )
    expect(findings.current.nutrition).toMatchObject({ avgCalories: 1500, loggedDays: 1 })
    expect(findings.current.recovery).toMatchObject({ avgReadiness: 40, avgSleepHours: 5.5, avgStress: 70 })
    expect(codes(findings)).toEqual(
      expect.arrayContaining(["intake_logging_sparse", "calories_under_goal", "protein_low", "readiness_low", "sleep_short", "stress_high"]),
    )
  })

  it("has no adherence without a program and changes its fingerprint when data changes", () => {
    const findings = buildCoachInsightFindings(input({ plannedDates: [] }))
    expect(findings.current.training.adherencePct).toBeNull()
    expect(codes(findings)).toContain("no_program_sessions_due")

    const before = coachInsightFingerprint(buildCoachInsightFindings(input()))
    expect(coachInsightFingerprint(buildCoachInsightFindings(input()))).toBe(before)
    expect(coachInsightFingerprint(buildCoachInsightFindings(input({ logs: [...input().logs, log("2026-09-28")] })))).not.toBe(before)
  })
})

describe("coach insight output", () => {
  const valid = {
    sections: [{ area: "training", text: "Hoàn thành 3/3 buổi.", tone: "good" }],
    suggestions: ["Giữ nguyên volume tuần tới."],
    summary: "Tuần tốt.",
  }

  it("accepts only the known areas and at least one suggestion", () => {
    expect(validateCoachInsight(valid)).toEqual(valid)
    expect(() => validateCoachInsight({ ...valid, sections: [{ area: "mood", text: "x", tone: "good" }] })).toThrow()
    expect(() => validateCoachInsight({ ...valid, suggestions: [] })).toThrow()
  })

  it("hands the model the computed figures and signals", async () => {
    const prompts: string[] = []
    const provider = {
      async generateStructuredJSON({ userPrompt }: { userPrompt: string }) {
        prompts.push(userPrompt)
        return { data: valid, tokenUsage: 9 }
      },
      supportsTools: false,
    } as unknown as AIProvider

    const result = await generateCoachTraineeInsight(provider, buildCoachInsightFindings(input()), {
      locale: "vi",
      programNames: ["PPL <script>"],
      traineeName: "An",
    })
    expect(result.summary).toBe("Tuần tốt.")
    expect(result.tokenUsage).toBe(9)
    expect(prompts[0]).toContain("Buổi tập theo program: 3/3 buổi đến hạn (bám program 100%)")
    expect(prompts[0]).toContain("[training] good: adherence_high")
    expect(prompts[0]).not.toContain("<script>")
  })
})
