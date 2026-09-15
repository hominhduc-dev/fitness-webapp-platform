import { describe, expect, it } from "vitest"

import { withRequestContext } from "../../../lib/logger"
import { buildBodyMetricOverview, buildTraineeWeekOverview, type OverviewWeekLog } from "./coach-trainee-overview"

function inZone<T>(timeZone: string, callback: () => T) {
  return withRequestContext({ method: "GET", path: "/test", requestId: "test-request", timeZone }, callback)
}

const MONDAY = new Date("2026-09-14T00:00:00.000Z")

function log(startedAt: string, options?: { completed?: boolean; sets?: boolean[]; volume?: number }): OverviewWeekLog {
  return {
    completedAt: options?.completed === false ? null : new Date(startedAt),
    exercises: [{ sets: (options?.sets ?? [true, true, true]).map((completed) => ({ completed })) }],
    startedAt: new Date(startedAt),
    totalVolume: options?.volume ?? 1_000,
  }
}

describe("buildTraineeWeekOverview", () => {
  it("returns the seven Monday-first day keys of the requested week", () => {
    const week = buildTraineeWeekOverview([], MONDAY, 4)

    expect(week.days.map((day) => day.date)).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20",
    ])
    expect(week.weekStart).toBe("2026-09-14")
    expect(week.plannedSessions).toBe(4)
  })

  it("puts each log on the client's calendar day it started on", () => {
    // 23:30 UTC on Tuesday is 06:30 on Wednesday in Vietnam.
    const lateTuesdayUtc = [log("2026-09-15T23:30:00.000Z")]

    const vietnam = inZone("Asia/Ho_Chi_Minh", () => buildTraineeWeekOverview(lateTuesdayUtc, MONDAY, 4))
    expect(vietnam.days[1].sets).toBe(0)
    expect(vietnam.days[2]).toMatchObject({ date: "2026-09-16", sessions: 1, sets: 3 })

    const utc = inZone("UTC", () => buildTraineeWeekOverview(lateTuesdayUtc, MONDAY, 4))
    expect(utc.days[1]).toMatchObject({ date: "2026-09-15", sessions: 1, sets: 3 })
  })

  it("counts only completed sessions and completed sets, and ignores other weeks", () => {
    const week = buildTraineeWeekOverview([
      log("2026-09-14T08:00:00.000Z", { sets: [true, false, true], volume: 900.4 }),
      log("2026-09-16T08:00:00.000Z", { completed: false, sets: [true], volume: 200 }),
      log("2026-09-13T08:00:00.000Z"),
      log("2026-09-21T08:00:00.000Z"),
    ], MONDAY, 3)

    expect(week.completedSessions).toBe(1)
    expect(week.totalSets).toBe(3)
    expect(week.totalVolume).toBe(1_100)
    expect(week.days[2]).toMatchObject({ sessions: 0, sets: 1, volume: 200 })
  })
})

describe("buildBodyMetricOverview", () => {
  it("keeps older waist and body fat when the newest entry is a weigh-in", () => {
    const body = buildBodyMetricOverview({
      bodyFat: { bodyFatPct: 18.5, recordedAt: new Date("2026-09-01T00:00:00.000Z") },
      waist: { recordedAt: new Date("2026-08-20T00:00:00.000Z"), waistCm: 82 },
      weights: [
        { recordedAt: new Date("2026-09-14T00:00:00.000Z"), weightKg: 73.3 },
        { recordedAt: new Date("2026-09-10T00:00:00.000Z"), weightKg: 74 },
      ],
    })

    expect(body.weightKg).toEqual({ deltaKg: -0.7, recordedAt: "2026-09-14", value: 73.3 })
    expect(body.bodyFatPct).toEqual({ recordedAt: "2026-09-01", value: 18.5 })
    expect(body.waistCm).toEqual({ recordedAt: "2026-08-20", value: 82 })
  })

  it("reports no delta for a single weigh-in and nulls for fields never recorded", () => {
    const body = buildBodyMetricOverview({
      bodyFat: null,
      waist: null,
      weights: [{ recordedAt: new Date("2026-09-14T00:00:00.000Z"), weightKg: 70 }],
    })

    expect(body.weightKg?.deltaKg).toBeNull()
    expect(body.bodyFatPct).toBeNull()
    expect(body.waistCm).toBeNull()
  })
})
