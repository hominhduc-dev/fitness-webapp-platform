import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activity: vi.fn(),
  daily: vi.fn(),
  deleteBodyMetrics: vi.fn(),
  findBodyMetric: vi.fn(),
  findConnection: vi.fn(),
  findConnections: vi.fn(),
  sleep: vi.fn(),
  updateConnection: vi.fn(),
  updateConnections: vi.fn(),
  upsertBodyMetric: vi.fn(),
  upsertSummary: vi.fn(),
  upsertWorkout: vi.fn(),
}))

vi.mock("../config/env", () => ({ env: { huaweiHealthSyncIntervalMs: 3_600_000 } }))
vi.mock("../lib/prisma", () => ({
  prisma: {
    bodyMetricEntry: { deleteMany: mocks.deleteBodyMetrics, findFirst: mocks.findBodyMetric, upsert: mocks.upsertBodyMetric },
    healthConnection: {
      findMany: mocks.findConnections,
      findUnique: mocks.findConnection,
      update: mocks.updateConnection,
      updateMany: mocks.updateConnections,
    },
    healthDailySummary: { upsert: mocks.upsertSummary },
    healthWorkout: { upsert: mocks.upsertWorkout },
  },
}))
vi.mock("../lib/huawei-token-crypto", () => ({
  decryptHuaweiToken: (value: string) => value,
  encryptHuaweiToken: (value: string) => value,
  isHuaweiTokenCryptoConfigured: () => true,
}))
vi.mock("../lib/huawei", async (original) => ({
  ...(await original<typeof import("../lib/huawei")>()),
  fetchActivityRecords: mocks.activity,
  fetchDailyPolymerize: mocks.daily,
  fetchSleepRecords: mocks.sleep,
  isHuaweiOAuthConfigured: () => true,
}))

import { ExternalServiceError } from "./errors"
import {
  mergeDailyPolymerize,
  runHuaweiSyncTick,
  sleepSummaryByDate,
  syncHuaweiHealthForUser,
} from "./huawei-health.service"

const PLUS_SEVEN = 7 * 60
/** 2026-09-29 00:30 at UTC+7 is 2026-09-28 17:30 UTC. */
const LOCAL_EARLY_MS = Date.UTC(2026, 8, 28, 17, 30)
const LOCAL_EARLY_NS = LOCAL_EARLY_MS * 1e6

const STEPS = { dataType: "steps", columns: [{ column: "steps" as const, fields: ["steps"], fold: "max" as const }] }
const HEART = {
  dataType: "heart",
  columns: [
    { column: "avgHeartRate" as const, fields: ["avg"], fold: "mean" as const },
    { column: "minHeartRate" as const, fields: ["min"], fold: "min" as const },
    { column: "maxHeartRate" as const, fields: ["max"], fold: "max" as const },
  ],
}

function reply(points: Array<{ startTime?: number | string; value: Array<Record<string, unknown>> }>, groupStart?: number) {
  return { group: [{ startTime: groupStart, sampleSet: points.map((point) => ({ samplePoints: [point] })) }] }
}

describe("mergeDailyPolymerize", () => {
  it("files a nanosecond point under the user's local day", () => {
    const days = mergeDailyPolymerize(new Map(), reply([{ startTime: LOCAL_EARLY_NS, value: [{ fieldName: "steps", integerValue: 8421 }] }]), STEPS, PLUS_SEVEN)
    expect([...days]).toEqual([["2026-09-29", { steps: 8421 }]])
  })

  it("falls back to the group's millisecond start when a point has none", () => {
    const days = mergeDailyPolymerize(new Map(), reply([{ value: [{ fieldName: "steps", integerValue: 500 }] }], LOCAL_EARLY_MS), STEPS, PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ steps: 500 })
  })

  it("takes the larger total when the phone and the band both report a day", () => {
    const days = mergeDailyPolymerize(new Map(), reply([
      { startTime: LOCAL_EARLY_NS, value: [{ fieldName: "steps", integerValue: 3000 }] },
      { startTime: String(LOCAL_EARLY_NS), value: [{ fieldName: "steps", integerValue: 7000 }] },
    ]), STEPS, PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ steps: 7000 })
  })

  it("averages, mins and maxes heart rate across devices regardless of order", () => {
    const days = mergeDailyPolymerize(new Map(), reply([
      { startTime: LOCAL_EARLY_NS, value: [{ fieldName: "avg", floatValue: 60 }, { fieldName: "min", floatValue: 50 }, { fieldName: "max", floatValue: 140 }] },
      { startTime: LOCAL_EARLY_NS, value: [{ fieldName: "avg", floatValue: 70 }, { fieldName: "min", floatValue: 48 }, { fieldName: "max", floatValue: 150 }] },
      { startTime: LOCAL_EARLY_NS, value: [{ fieldName: "avg", floatValue: 80 }] },
    ]), HEART, PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ avgHeartRate: 70, maxHeartRate: 150, minHeartRate: 48 })
  })
})

describe("sleepSummaryByDate", () => {
  const night = (startHourUtc: number, endHourUtc: number, value?: Array<Record<string, unknown>>) => ({
    endTime: String(Date.UTC(2026, 8, 28, endHourUtc) * 1e6),
    startTime: String(Date.UTC(2026, 8, 28, startHourUtc) * 1e6),
    value,
  })
  const ms = (minutes: number) => minutes * 60_000

  it("counts one night seen by two devices once", () => {
    // 22:00–06:00 and 23:00–05:00 local (UTC+7) are the same night.
    const days = sleepSummaryByDate([night(15, 23), night(16, 22)], ["2026-09-29"], PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ sleepMinutes: 8 * 60 })
  })

  it("still adds a separate nap on the same day", () => {
    const nap = { startTime: String(Date.UTC(2026, 8, 29, 6) * 1e6), endTime: String(Date.UTC(2026, 8, 29, 7) * 1e6) }
    const days = sleepSummaryByDate([night(15, 22), nap], ["2026-09-29"], PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ sleepMinutes: 7 * 60 + 60 })
  })

  it("uses the record's own sleep and stage durations, from the device that saw the most", () => {
    const watch = night(15, 23, [
      { fieldName: "all_sleep_time", integerValue: ms(420) },
      { fieldName: "deep_sleep_time", integerValue: ms(90) },
      { fieldName: "light_sleep_time", integerValue: ms(240) },
      { fieldName: "dream_time", integerValue: ms(90) },
      { fieldName: "awake_time", integerValue: ms(60) },
    ])
    const phone = night(16, 22, [{ fieldName: "all_sleep_time", integerValue: ms(300) }])

    const days = sleepSummaryByDate([phone, watch], ["2026-09-29"], PLUS_SEVEN)

    expect(days.get("2026-09-29")).toEqual({
      awakeMinutes: 60,
      deepSleepMinutes: 90,
      lightSleepMinutes: 240,
      remSleepMinutes: 90,
      sleepMinutes: 420,
    })
  })

  it("accepts durations already in minutes", () => {
    const days = sleepSummaryByDate([night(15, 23, [{ fieldName: "all_sleep_time", integerValue: 435 }])], ["2026-09-29"], PLUS_SEVEN)
    expect(days.get("2026-09-29")).toEqual({ sleepMinutes: 435 })
  })
})

describe("syncHuaweiHealthForUser", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 3)))
    mocks.findConnection.mockResolvedValue({
      accessTokenEncrypted: "token",
      dataRegionBaseUrl: null,
      expiresAt: new Date(Date.UTC(2027, 0, 1)),
      id: "connection",
      refreshTokenEncrypted: "refresh",
      scope: "openid https://www.huawei.com/healthkit/step.read",
    })
    mocks.daily.mockImplementation(async (_token, input) => ({
      baseUrl: "https://health-api.cloud.huawei.com",
      data: input.dataType.includes("steps")
        ? reply([{ startTime: LOCAL_EARLY_NS, value: [{ fieldName: "steps", integerValue: 8421 }] }])
        : { group: [] },
    }))
    mocks.sleep.mockResolvedValue({ baseUrl: "https://health-api.cloud.huawei.com", data: { healthRecords: [] } })
    mocks.activity.mockResolvedValue({ baseUrl: "https://health-api.cloud.huawei.com", data: { activityRecord: [] } })
  })

  it("asks dailyPolymerize for one type at a time over the user's local days", async () => {
    await syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })

    expect(mocks.daily).toHaveBeenCalledTimes(6)
    expect(mocks.daily.mock.calls[0][1]).toEqual({
      dataType: "com.huawei.continuous.steps.delta",
      endDay: "20260929",
      startDay: "20260923",
      timeZone: "+0700",
    })
    expect(mocks.updateConnection.mock.calls[0][0].data).toMatchObject({ syncTimezoneOffset: "+0700" })
  })

  it("keeps syncing other sources when Huawei refuses one, without blanking that column", async () => {
    mocks.daily.mockImplementation(async (_token, input) => {
      if (input.dataType.includes("stress")) throw new ExternalServiceError("refused", { code: "HUAWEI_HEALTH_REQUEST_FAILED" })
      return {
        baseUrl: "https://health-api.cloud.huawei.com",
        data: input.dataType.includes("steps") ? reply([{ startTime: LOCAL_EARLY_NS, value: [{ fieldName: "steps", integerValue: 8421 }] }]) : { group: [] },
      }
    })

    const result = await syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })

    expect(result.failedSources).toEqual(["com.huawei.instantaneous.stress"])
    expect(mocks.sleep).toHaveBeenCalled()
    const { update } = mocks.upsertSummary.mock.calls[0][0]
    expect(update).toMatchObject({ steps: 8421, avgHeartRate: null, sleepMinutes: null })
    expect(update).not.toHaveProperty("stressAvg")
  })

  it("skips weight without its optional scope, and logs it to the weight log when granted", async () => {
    mocks.findBodyMetric.mockResolvedValue(null)
    mocks.daily.mockImplementation(async (_token, input) => ({
      baseUrl: "https://health-api.cloud.huawei.com",
      data: input.dataType.includes("body_weight")
        ? reply([{ startTime: LOCAL_EARLY_NS, value: [{ fieldName: "last", floatValue: 72.4 }, { fieldName: "avg_body_fat_rate", floatValue: 18.5 }] }])
        : { group: [] },
    }))

    await syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })
    expect(mocks.daily.mock.calls.map(([, input]) => input.dataType)).not.toContain("com.huawei.instantaneous.body_weight")
    expect(mocks.upsertBodyMetric).not.toHaveBeenCalled()

    vi.clearAllMocks()
    mocks.findConnection.mockResolvedValue({
      accessTokenEncrypted: "token",
      expiresAt: new Date(Date.UTC(2027, 0, 1)),
      id: "connection",
      refreshTokenEncrypted: "refresh",
      scope: "openid https://www.huawei.com/healthkit/heightweight.read",
    })

    const result = await syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })

    expect(result.weightsSynced).toBe(1)
    expect(mocks.upsertSummary.mock.calls[0][0].update).toMatchObject({ bodyFatPct: 18.5, weightKg: 72.4 })
    const upsert = mocks.upsertBodyMetric.mock.calls[0][0]
    expect(upsert.where).toEqual({ traineeId_externalId: { externalId: "huawei:2026-09-29", traineeId: "trainee" } })
    // Local noon on 2026-09-29 at UTC+7.
    expect(upsert.create).toMatchObject({ recordedAt: new Date(Date.UTC(2026, 8, 29, 5)), source: "huawei", weightKg: 72.4 })
  })

  it("leaves a day's weight to the trainee when they logged one themselves", async () => {
    mocks.findConnection.mockResolvedValue({
      accessTokenEncrypted: "token",
      expiresAt: new Date(Date.UTC(2027, 0, 1)),
      id: "connection",
      refreshTokenEncrypted: "refresh",
      scope: "https://www.huawei.com/healthkit/heightweight.read",
    })
    mocks.findBodyMetric.mockResolvedValue({ id: "manual" })
    mocks.daily.mockImplementation(async (_token, input) => ({
      baseUrl: "https://health-api.cloud.huawei.com",
      data: input.dataType.includes("body_weight") ? reply([{ startTime: LOCAL_EARLY_NS, value: [{ fieldName: "last", floatValue: 72.4 }] }]) : { group: [] },
    }))

    const result = await syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })

    expect(result.weightsSynced).toBe(0)
    expect(mocks.findBodyMetric.mock.calls[0][0].where).toMatchObject({
      recordedAt: { gte: new Date(Date.UTC(2026, 8, 28, 17)), lt: new Date(Date.UTC(2026, 8, 29, 17)) },
      source: null,
    })
    expect(mocks.deleteBodyMetrics).toHaveBeenCalledWith({ where: { externalId: "huawei:2026-09-29", traineeId: "trainee" } })
    expect(mocks.upsertBodyMetric).not.toHaveBeenCalled()
  })

  it("fails, after recording the attempt, when every source fails", async () => {
    const refused = new ExternalServiceError("refused", { code: "HUAWEI_HEALTH_REQUEST_FAILED" })
    mocks.daily.mockRejectedValue(refused); mocks.sleep.mockRejectedValue(refused); mocks.activity.mockRejectedValue(refused)

    await expect(syncHuaweiHealthForUser("trainee", { days: 7, timezoneOffset: "+0700" })).rejects.toMatchObject({ code: "HUAWEI_HEALTH_SYNC_FAILED" })
    expect(mocks.updateConnections.mock.calls[0][0].data).toHaveProperty("lastSyncAttemptAt")
    expect(mocks.updateConnection).not.toHaveBeenCalled()
  })
})

describe("runHuaweiSyncTick", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findConnection.mockResolvedValue(null)
  })

  it("syncs each due trainee with their stored offset, the default zone otherwise, and survives failures", async () => {
    mocks.findConnections.mockResolvedValue([
      { syncTimezoneOffset: "+0900", userId: "a" },
      { syncTimezoneOffset: null, userId: "b" },
    ])

    // No stored grant, so each sync fails at the token step after stamping its attempt.
    await expect(runHuaweiSyncTick(new Date(Date.UTC(2026, 8, 29)))).resolves.toEqual({ due: 2, synced: 0 })
    expect(mocks.updateConnections).toHaveBeenCalledTimes(2)

    const { where } = mocks.findConnections.mock.calls[0][0]
    expect(where).toMatchObject({ provider: "huawei", refreshTokenEncrypted: { not: null }, user: { role: "trainee" } })
    expect(where.OR[1].lastSyncAttemptAt.lt).toEqual(new Date(Date.UTC(2026, 8, 28, 23)))
  })
})
