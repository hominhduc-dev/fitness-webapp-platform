import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchDaily: vi.fn(),
  findConnection: vi.fn(),
  getToken: vi.fn(),
  transaction: vi.fn(),
  updateConnection: vi.fn(),
  upsertSummary: vi.fn(),
}))

vi.mock("../config/env", () => ({ env: { huaweiHealthSyncIntervalMs: 3_600_000 } }))
vi.mock("../lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    huaweiConnection: { findUnique: mocks.findConnection, updateMany: mocks.updateConnection },
    wearableDailySummary: { upsert: mocks.upsertSummary },
  },
}))
vi.mock("../lib/huawei-health", async (original) => ({
  ...(await original<typeof import("../lib/huawei-health")>()),
  fetchDailyPolymerize: mocks.fetchDaily,
}))
vi.mock("./huawei-connection.service", () => ({
  getHuaweiAccessToken: mocks.getToken,
  getHuaweiConnection: vi.fn(),
  isHuaweiConfigured: () => true,
}))

import { ExternalServiceError } from "./errors"
import { formatUtcOffset, parseDailyPolymerize, syncHuaweiHealthForUser } from "./huawei-health-sync.service"

/** 2026-09-29 00:30 in Ho Chi Minh (UTC+7) is 2026-09-28 17:30 UTC. */
const LOCAL_EARLY_MORNING_NS = Date.UTC(2026, 8, 28, 17, 30) * 1e6

function point(dataTypeName: string, startNs: number, value: Array<Record<string, unknown>>) {
  return { group: [{ sampleSet: [{ samplePoints: [{ dataTypeName, startTime: startNs, value }] }] }] }
}

describe("parseDailyPolymerize", () => {
  it("files a point under the user's own calendar day, not the UTC one", () => {
    const days = parseDailyPolymerize(point("com.huawei.continuous.steps.total", LOCAL_EARLY_MORNING_NS, [{ fieldName: "steps", integerValue: 8421 }]), "Asia/Ho_Chi_Minh")
    expect([...days]).toEqual([["2026-09-29", { steps: 8421 }]])
  })

  it("takes the larger total when the phone and the band both report a day", () => {
    const response = {
      group: [{
        sampleSet: [
          { samplePoints: [{ dataTypeName: "com.huawei.continuous.steps.total", startTime: LOCAL_EARLY_MORNING_NS, value: [{ fieldName: "steps", integerValue: 3000 }] }] },
          { samplePoints: [{ dataTypeName: "com.huawei.continuous.steps.total", startTime: String(LOCAL_EARLY_MORNING_NS), value: [{ fieldName: "steps", integerValue: 7000 }] }] },
        ],
      }],
    }
    expect(parseDailyPolymerize(response, "Asia/Ho_Chi_Minh").get("2026-09-29")).toEqual({ steps: 7000 })
  })

  it("merges calories and heart rate into the same day and ignores unknown fields", () => {
    const days = parseDailyPolymerize(point("com.huawei.calories.burnt.total", LOCAL_EARLY_MORNING_NS, [{ fieldName: "calories_total", floatValue: 412.5 }]), "Asia/Ho_Chi_Minh")
    parseDailyPolymerize(point("com.huawei.continuous.heart_rate.statistics", LOCAL_EARLY_MORNING_NS, [
      { fieldName: "avg", floatValue: 72 },
      { fieldName: "max", floatValue: 151 },
      { fieldName: "min", floatValue: 51 },
      { fieldName: "last", floatValue: 64 },
    ]), "Asia/Ho_Chi_Minh", days)
    expect(days.get("2026-09-29")).toEqual({ activeKcal: 412.5, avgHeartRate: 72, maxHeartRate: 151, minHeartRate: 51 })
  })

  it("averages heart rate evenly across every point of the day", () => {
    const days = new Map()
    for (const avg of [60, 70, 80]) {
      parseDailyPolymerize(point("com.huawei.continuous.heart_rate.statistics", LOCAL_EARLY_MORNING_NS, [{ fieldName: "avg", floatValue: avg }]), "Asia/Ho_Chi_Minh", days)
    }
    expect(days.get("2026-09-29")).toEqual({ avgHeartRate: 70 })
  })

  it("keeps resting heart rate apart from the day's heart-rate statistics", () => {
    const days = parseDailyPolymerize(point("com.huawei.continuous.heart_rate.statistics", LOCAL_EARLY_MORNING_NS, [{ fieldName: "avg", floatValue: 78 }, { fieldName: "min", floatValue: 52 }]), "Asia/Ho_Chi_Minh")
    parseDailyPolymerize(point("com.huawei.continuous.resting_heart_rate.statistics", LOCAL_EARLY_MORNING_NS, [{ fieldName: "avg", floatValue: 55 }, { fieldName: "min", floatValue: 55 }]), "Asia/Ho_Chi_Minh", days)
    expect(days.get("2026-09-29")).toEqual({ avgHeartRate: 78, minHeartRate: 52, restingHeartRate: 55 })
  })

  it("falls back to the group's millisecond start when a point carries none", () => {
    const response = { group: [{ startTime: LOCAL_EARLY_MORNING_NS / 1e6, sampleSet: [{ samplePoints: [
      { dataTypeName: "com.huawei.continuous.steps.total", value: [{ fieldName: "steps", integerValue: 500 }] },
    ] }] }] }
    expect([...parseDailyPolymerize(response, "Asia/Ho_Chi_Minh")]).toEqual([["2026-09-29", { steps: 500 }]])
  })

  it("skips points without a usable timestamp or value", () => {
    const response = { group: [{ sampleSet: [{ samplePoints: [
      { dataTypeName: "steps", value: [{ fieldName: "steps", integerValue: 1 }] },
      { dataTypeName: "steps", startTime: LOCAL_EARLY_MORNING_NS, value: [{ fieldName: "steps" }] },
    ] }] }] }
    expect([...parseDailyPolymerize(response, "Asia/Ho_Chi_Minh")]).toEqual([["2026-09-29", {}]])
  })
})

describe("formatUtcOffset", () => {
  it("formats whole and half-hour offsets on both sides of UTC", () => {
    const now = new Date(Date.UTC(2026, 0, 15))
    expect(formatUtcOffset(now, "Asia/Ho_Chi_Minh")).toBe("+0700")
    expect(formatUtcOffset(now, "Asia/Kolkata")).toBe("+0530")
    expect(formatUtcOffset(now, "America/St_Johns")).toBe("-0330")
    expect(formatUtcOffset(now, "UTC")).toBe("+0000")
  })
})

describe("syncHuaweiHealthForUser", () => {
  const now = new Date(Date.UTC(2026, 8, 29, 3))

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findConnection.mockResolvedValue({ timeZone: "Asia/Ho_Chi_Minh" })
    mocks.getToken.mockResolvedValue("token")
    mocks.transaction.mockResolvedValue([])
    mocks.upsertSummary.mockImplementation((args) => args)
  })

  it("requests the last seven local days in the user's offset and upserts one row per day", async () => {
    mocks.fetchDaily.mockImplementation(async (_token, input) =>
      input.dataType.includes("steps") ? point("com.huawei.continuous.steps.total", LOCAL_EARLY_MORNING_NS, [{ fieldName: "steps", integerValue: 8421 }]) : { group: [] })

    await expect(syncHuaweiHealthForUser("user-1", now)).resolves.toEqual({ days: 1 })

    expect(mocks.fetchDaily).toHaveBeenCalledTimes(4)
    expect(mocks.fetchDaily.mock.calls[0][1]).toMatchObject({ startDay: "20260923", endDay: "20260929", timeZone: "+0700" })
    const [upsert] = mocks.transaction.mock.calls[0][0]
    expect(upsert.where.userId_source_date).toEqual({ date: new Date("2026-09-29T00:00:00.000Z"), source: "huawei", userId: "user-1" })
    expect(upsert.update).toEqual({ steps: 8421, syncedAt: now })
    expect(mocks.updateConnection).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { lastSyncedAt: now, lastSyncError: null } })
  })

  it("records the failure code so the UI can ask for a reconnect", async () => {
    mocks.getToken.mockRejectedValue(new ExternalServiceError("rejected", { code: "HUAWEI_AUTH_REJECTED" }))
    await expect(syncHuaweiHealthForUser("user-1", now)).rejects.toThrow("rejected")
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.updateConnection).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { lastSyncedAt: now, lastSyncError: "HUAWEI_AUTH_REJECTED" } })
  })

  it("does nothing for a user without a connection", async () => {
    mocks.findConnection.mockResolvedValue(null)
    await expect(syncHuaweiHealthForUser("user-1", now)).resolves.toEqual({ days: 0 })
    expect(mocks.getToken).not.toHaveBeenCalled()
  })
})
