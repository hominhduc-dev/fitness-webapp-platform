import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  activity: vi.fn(),
  daily: vi.fn(),
  findConnection: vi.fn(),
  findConnections: vi.fn(),
  sleep: vi.fn(),
  updateConnection: vi.fn(),
  updateConnections: vi.fn(),
  upsertSummary: vi.fn(),
  upsertWorkout: vi.fn(),
}))

vi.mock("../config/env", () => ({ env: { huaweiHealthSyncIntervalMs: 3_600_000 } }))
vi.mock("../lib/prisma", () => ({
  prisma: {
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
  sleepMinutesByDate,
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

describe("sleepMinutesByDate", () => {
  const night = (startHourUtc: number, endHourUtc: number) => ({
    endTime: String(Date.UTC(2026, 8, 28, endHourUtc) * 1e6),
    startTime: String(Date.UTC(2026, 8, 28, startHourUtc) * 1e6),
  })

  it("merges overlapping records from two devices instead of adding them", () => {
    // 22:00–06:00 and 23:00–05:00 local (UTC+7) are the same night.
    const totals = sleepMinutesByDate([night(15, 23), night(16, 22)], ["2026-09-29"], PLUS_SEVEN)
    expect(totals.get("2026-09-29")).toBe(8 * 60)
  })

  it("still adds a separate nap on the same day", () => {
    const totals = sleepMinutesByDate([night(15, 22), { startTime: String(Date.UTC(2026, 8, 29, 6) * 1e6), endTime: String(Date.UTC(2026, 8, 29, 7) * 1e6) }], ["2026-09-29"], PLUS_SEVEN)
    expect(totals.get("2026-09-29")).toBe(7 * 60 + 60)
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
