import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { HealthProvider, UserRole } from "@prisma/client"

import { env } from "../config/env"
import * as huawei from "../lib/huawei"
import {
  decryptHuaweiToken,
  encryptHuaweiToken,
  isHuaweiTokenCryptoConfigured,
} from "../lib/huawei-token-crypto"
import type { SerializedProfile } from "./auth.service"
import { BadRequestError } from "./errors"
import { assertTrainee, ensurePrisma } from "./fitness-data/shared/guards"

const PROVIDER = HealthProvider.huawei
const CONNECTABLE_ROLE = UserRole.trainee
const MAX_SYNC_DAYS = 30
const DEFAULT_SYNC_DAYS = 7

const DAILY_DATA_TYPES = [
  "com.huawei.continuous.steps.delta",
  "com.huawei.continuous.distance.delta",
  "com.huawei.continuous.calories.burnt",
  "com.huawei.instantaneous.heart_rate",
  "com.huawei.instantaneous.resting_heart_rate",
  "com.huawei.instantaneous.stress",
]

export const HUAWEI_STATE_MAX_AGE = 10 * 60 * 1000

function isHuaweiConfigured() {
  return huawei.isHuaweiOAuthConfigured() && isHuaweiTokenCryptoConfigured()
}

function requireConfigured() {
  if (!isHuaweiConfigured()) {
    throw new BadRequestError("Huawei Health chưa được cấu hình.", {
      code: "HUAWEI_NOT_CONFIGURED",
    })
  }
}

function signState(value: string) {
  requireConfigured()
  return createHmac("sha256", env.huaweiClientSecret!).update(value).digest("base64url")
}

function createHuaweiState(userId: string) {
  const nonce = randomBytes(32).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ expires: Date.now() + HUAWEI_STATE_MAX_AGE, nonce, userId }),
  ).toString("base64url")

  return { nonce, state: `${payload}.${signState(payload)}` }
}

function verifyHuaweiState(state: string, nonce: string) {
  const invalid = () =>
    new BadRequestError("Phiên kết nối Huawei Health không hợp lệ hoặc đã hết hạn. Hãy kết nối lại.", {
      code: "HUAWEI_STATE_INVALID",
    })

  const [payload, signature, extra] = state.split(".")
  if (!payload || !signature || extra || !nonce) throw invalid()

  const expected = Buffer.from(signState(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid()

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      expires?: number
      nonce?: string
      userId?: string
    }

    if (
      typeof value.userId !== "string" ||
      value.nonce !== nonce ||
      !Number.isFinite(value.expires) ||
      value.expires! <= Date.now()
    ) {
      throw invalid()
    }

    return value.userId
  } catch (error) {
    if (error instanceof BadRequestError) throw error
    throw invalid()
  }
}

function assertConnectableProfile(profile: SerializedProfile) {
  assertTrainee(profile)
}

async function getHuaweiConnection(profile: SerializedProfile) {
  assertConnectableProfile(profile)

  if (!isHuaweiConfigured()) {
    return {
      configured: false,
      connected: false,
      lastSyncedAt: null,
      scopes: [] as string[],
    }
  }

  const db = ensurePrisma()
  const [connection, latestSummary] = await Promise.all([
    db.healthConnection.findUnique({
      where: { userId_provider: { provider: PROVIDER, userId: profile.id } },
      select: { lastSyncedAt: true, refreshTokenEncrypted: true, scope: true },
    }),
    db.healthDailySummary.findFirst({
      orderBy: { date: "desc" },
      select: {
        activeCalories: true,
        date: true,
        restingHeartRate: true,
        sleepMinutes: true,
        steps: true,
        stressAvg: true,
      },
      where: { provider: PROVIDER, userId: profile.id },
    }),
  ])

  return {
    configured: true,
    connected: Boolean(connection?.refreshTokenEncrypted),
    lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
    latestSummary: latestSummary
      ? {
          ...latestSummary,
          date: latestSummary.date.toISOString().slice(0, 10),
        }
      : null,
    scopes: connection?.scope ? connection.scope.split(/\s+/).filter(Boolean) : [],
  }
}

async function connectHuawei(userId: string, code: string) {
  requireConfigured()
  const db = ensurePrisma()

  const user = await db.user.findFirst({
    where: { id: userId, role: CONNECTABLE_ROLE },
    select: { id: true, role: true },
  })
  if (!user) {
    throw new BadRequestError("Tài khoản không còn hợp lệ để kết nối Huawei Health.", {
      code: "HUAWEI_ROLE_UNSUPPORTED",
    })
  }

  const tokens = await huawei.exchangeCodeForTokens(code)
  if (!tokens.refreshToken) {
    throw new BadRequestError(
      "Huawei không cấp refresh token. Hãy kết nối lại và cấp quyền truy cập ngoại tuyến.",
      { code: "HUAWEI_REFRESH_TOKEN_MISSING" },
    )
  }

  const granted = new Set(tokens.scope.split(/\s+/).filter(Boolean))
  const requiredHealthScopes = huawei.SCOPES.filter((scope) => scope.startsWith("https://"))
  const missingScopes = requiredHealthScopes.filter((scope) => !granted.has(scope))

  if (missingScopes.length > 0) {
    throw new BadRequestError("Chưa cấp đủ quyền Huawei Health cần thiết.", {
      code: "HUAWEI_SCOPE_MISSING",
      details: { missingScopes },
    })
  }

  await db.healthConnection.upsert({
    where: { userId_provider: { provider: PROVIDER, userId } },
    create: {
      accessTokenEncrypted: encryptHuaweiToken(tokens.accessToken),
      expiresAt: tokens.expiresAt,
      provider: PROVIDER,
      refreshTokenEncrypted: encryptHuaweiToken(tokens.refreshToken),
      scope: tokens.scope,
      userId,
    },
    update: {
      accessTokenEncrypted: encryptHuaweiToken(tokens.accessToken),
      dataRegionBaseUrl: null,
      expiresAt: tokens.expiresAt,
      lastSyncedAt: null,
      refreshTokenEncrypted: encryptHuaweiToken(tokens.refreshToken),
      scope: tokens.scope,
    },
  })

  return { role: user.role }
}

async function disconnectHuawei(profile: SerializedProfile) {
  assertConnectableProfile(profile)
  await ensurePrisma().healthConnection.deleteMany({
    where: { provider: PROVIDER, userId: profile.id },
  })

  return { connected: false }
}

async function getHuaweiAccessToken(userId: string) {
  requireConfigured()
  const db = ensurePrisma()
  const connection = await db.healthConnection.findUnique({
    where: { userId_provider: { provider: PROVIDER, userId } },
  })

  if (!connection?.refreshTokenEncrypted) {
    throw new BadRequestError("Hãy kết nối lại Huawei Health.", {
      code: "HUAWEI_RECONNECT_REQUIRED",
    })
  }

  if (connection.expiresAt.getTime() > Date.now() + huawei.EXPIRY_SKEW_MS) {
    return { accessToken: decryptHuaweiToken(connection.accessTokenEncrypted), connection }
  }

  const tokens = await huawei.refreshAccessToken(decryptHuaweiToken(connection.refreshTokenEncrypted))
  const updated = await db.healthConnection.updateMany({
    where: { id: connection.id, updatedAt: connection.updatedAt },
    data: {
      accessTokenEncrypted: encryptHuaweiToken(tokens.accessToken),
      expiresAt: tokens.expiresAt,
      ...(tokens.refreshToken
        ? { refreshTokenEncrypted: encryptHuaweiToken(tokens.refreshToken) }
        : {}),
    },
  })

  if (!updated.count) {
    throw new BadRequestError("Kết nối Huawei Health đã thay đổi. Vui lòng thử lại.", {
      code: "HUAWEI_CONNECTION_CHANGED",
    })
  }

  const refreshed = await db.healthConnection.findUniqueOrThrow({ where: { id: connection.id } })
  return { accessToken: tokens.accessToken, connection: refreshed }
}

function numericValue(value: huawei.HuaweiValue | undefined) {
  if (!value) return null

  for (const candidate of [value.floatValue, value.integerValue, value.longValue]) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate
  }

  return null
}

function valuesMap(values: huawei.HuaweiValue[] | undefined) {
  const result = new Map<string, number>()
  for (const value of values ?? []) {
    if (!value.fieldName) continue
    const numberValue = numericValue(value)
    if (numberValue != null) result.set(value.fieldName, numberValue)
  }
  return result
}

function pointsInGroup(group: huawei.HuaweiPolymerizeGroup) {
  return (group.sampleSet ?? []).flatMap((set) => set.samplePoints ?? [])
}

function metricFromGroup(
  group: huawei.HuaweiPolymerizeGroup,
  dataTypeName: string,
  fields: string[],
) {
  for (const point of pointsInGroup(group)) {
    if (point.dataTypeName !== dataTypeName) continue
    const map = valuesMap(point.value)
    for (const field of fields) {
      const value = map.get(field)
      if (value != null) return value
    }
  }

  return null
}

function parseTimezoneOffset(value: string) {
  if (!/^[+-](?:[01]\d|2[0-3])[0-5]\d$/.test(value)) {
    throw new BadRequestError("Múi giờ sync Huawei không hợp lệ.", {
      code: "HUAWEI_TIMEZONE_INVALID",
    })
  }

  const sign = value.startsWith("-") ? -1 : 1
  const hours = Number(value.slice(1, 3))
  const minutes = Number(value.slice(3, 5))
  return sign * (hours * 60 + minutes)
}

function dateKeyFromMs(ms: number, offsetMinutes: number) {
  return new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 10)
}

function dateFromKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`)
}

function buildSyncRange(days: number, offsetMinutes: number) {
  const now = Date.now()
  const shiftedNow = new Date(now + offsetMinutes * 60_000)
  const currentLocalMidnight = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate(),
  )
  const startLocalMidnight = currentLocalMidnight - (days - 1) * 86_400_000
  const startTime = startLocalMidnight - offsetMinutes * 60_000

  const dateKeys: string[] = []
  for (let cursor = startLocalMidnight; cursor <= currentLocalMidnight; cursor += 86_400_000) {
    dateKeys.push(new Date(cursor).toISOString().slice(0, 10))
  }

  return { dateKeys, endTime: now, startTime }
}

function nsFromMs(ms: number) {
  return (BigInt(Math.trunc(ms)) * 1_000_000n).toString()
}

function timestampToMs(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value / 1_000_000
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return Number(BigInt(value) / 1_000_000n)
    } catch {
      return null
    }
  }
  return null
}

function activityMetric(
  record: huawei.HuaweiActivityRecord,
  dataTypeIncludes: string,
  fields: string[],
) {
  for (const summary of record.activitySummary?.dataSummary ?? []) {
    if (!summary.dataTypeName?.includes(dataTypeIncludes)) continue
    const map = valuesMap(summary.value)
    for (const field of fields) {
      const value = map.get(field)
      if (value != null) return value
    }
  }
  return null
}

function sleepMinutesByDate(
  records: huawei.HuaweiHealthRecord[],
  dateKeys: string[],
  offsetMinutes: number,
) {
  const allowed = new Set(dateKeys)
  const totals = new Map<string, number>()

  for (const record of records) {
    const startMs = timestampToMs(record.startTime)
    const endMs = timestampToMs(record.endTime)
    if (startMs == null || endMs == null || endMs <= startMs) continue

    const dateKey = dateKeyFromMs(endMs, offsetMinutes)
    if (!allowed.has(dateKey)) continue

    const durationMinutes = Math.round((endMs - startMs) / 60_000)
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + durationMinutes)
  }

  return totals
}

async function syncHuaweiHealth(
  profile: SerializedProfile,
  options?: { days?: number; timezoneOffset?: string },
) {
  assertConnectableProfile(profile)

  const requestedDays = options?.days ?? DEFAULT_SYNC_DAYS
  const days = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(MAX_SYNC_DAYS, Math.trunc(requestedDays)))
    : DEFAULT_SYNC_DAYS
  const timezoneOffset = options?.timezoneOffset ?? "+0000"
  const offsetMinutes = parseTimezoneOffset(timezoneOffset)
  const { accessToken, connection } = await getHuaweiAccessToken(profile.id)
  const { dateKeys, endTime, startTime } = buildSyncRange(days, offsetMinutes)

  let regionBaseUrl = connection.dataRegionBaseUrl

  const daily = await huawei.polymerizeDaily(
    accessToken,
    { dataTypes: DAILY_DATA_TYPES, endTime, startTime, timeZone: timezoneOffset },
    regionBaseUrl,
  )
  regionBaseUrl = daily.baseUrl

  const sleep = await huawei.fetchSleepRecords(
    accessToken,
    { endTimeNs: nsFromMs(endTime), startTimeNs: nsFromMs(startTime) },
    regionBaseUrl,
  )
  regionBaseUrl = sleep.baseUrl

  const workouts = await huawei.fetchActivityRecords(
    accessToken,
    { endTime, startTime },
    regionBaseUrl,
  )
  regionBaseUrl = workouts.baseUrl

  const sleepByDate = sleepMinutesByDate(sleep.data.healthRecords ?? [], dateKeys, offsetMinutes)
  const groupByDate = new Map<string, huawei.HuaweiPolymerizeGroup>()

  for (const group of daily.data.group ?? []) {
    if (typeof group.startTime !== "number") continue
    groupByDate.set(dateKeyFromMs(group.startTime, offsetMinutes), group)
  }

  const db = ensurePrisma()

  let summariesSynced = 0
  for (const dateKey of dateKeys) {
    const group = groupByDate.get(dateKey)

    const avgHeartRate = group
      ? metricFromGroup(group, "com.huawei.continuous.heart_rate.statistics", ["avg"])
      : null
    const minHeartRate = group
      ? metricFromGroup(group, "com.huawei.continuous.heart_rate.statistics", ["min"])
      : null
    const maxHeartRate = group
      ? metricFromGroup(group, "com.huawei.continuous.heart_rate.statistics", ["max"])
      : null

    const values = {
      activeCalories: group
        ? metricFromGroup(group, "com.huawei.continuous.calories.burnt.total", ["calories_total", "calories"])
        : null,
      avgHeartRate,
      distanceMeters: group
        ? metricFromGroup(group, "com.huawei.continuous.distance.total", ["distance"])
        : null,
      maxHeartRate,
      minHeartRate,
      restingHeartRate: group
        ? metricFromGroup(group, "com.huawei.continuous.resting_heart_rate.statistics", ["avg", "last"])
        : null,
      sleepMinutes: sleepByDate.get(dateKey) ?? null,
      steps: group
        ? metricFromGroup(group, "com.huawei.continuous.steps.total", ["steps"])
        : null,
      stressAvg: group
        ? metricFromGroup(group, "com.huawei.instantaneous.stress.statistics", ["avg"])
        : null,
    }

    const hasAnyValue = Object.values(values).some((value) => value != null)
    if (!hasAnyValue) continue

    await db.healthDailySummary.upsert({
      where: {
        userId_provider_date: {
          date: dateFromKey(dateKey),
          provider: PROVIDER,
          userId: profile.id,
        },
      },
      create: {
        ...values,
        provider: PROVIDER,
        syncedAt: new Date(),
        userId: profile.id,
        date: dateFromKey(dateKey),
        steps: values.steps == null ? null : Math.round(values.steps),
      },
      update: {
        ...values,
        syncedAt: new Date(),
        steps: values.steps == null ? null : Math.round(values.steps),
      },
    })
    summariesSynced += 1
  }

  let workoutsSynced = 0
  for (const record of workouts.data.activityRecord ?? []) {
    if (typeof record.startTime !== "number" || typeof record.endTime !== "number") continue

    const externalId =
      record.id ??
      [record.startTime, record.endTime, record.activityType ?? "unknown", record.name ?? ""].join(":")

    await db.healthWorkout.upsert({
      where: {
        userId_provider_externalId: {
          externalId,
          provider: PROVIDER,
          userId: profile.id,
        },
      },
      create: {
        activityType: record.activityType == null ? null : String(record.activityType),
        avgHeartRate: activityMetric(record, "heart_rate.statistics", ["avg"]),
        calories: activityMetric(record, "calories.burnt", ["calories_total", "calories"]),
        distanceMeters: activityMetric(record, "distance", ["distance"]),
        durationSeconds: Math.max(0, Math.round((record.endTime - record.startTime) / 1000)),
        endTime: new Date(record.endTime),
        externalId,
        maxHeartRate: activityMetric(record, "heart_rate.statistics", ["max"]),
        minHeartRate: activityMetric(record, "heart_rate.statistics", ["min"]),
        name: record.name ?? record.desc ?? null,
        provider: PROVIDER,
        rawData: JSON.parse(JSON.stringify(record)),
        startTime: new Date(record.startTime),
        steps: (() => {
          const value = activityMetric(record, "steps", ["steps"])
          return value == null ? null : Math.round(value)
        })(),
        syncedAt: new Date(),
        userId: profile.id,
      },
      update: {
        activityType: record.activityType == null ? null : String(record.activityType),
        avgHeartRate: activityMetric(record, "heart_rate.statistics", ["avg"]),
        calories: activityMetric(record, "calories.burnt", ["calories_total", "calories"]),
        distanceMeters: activityMetric(record, "distance", ["distance"]),
        durationSeconds: Math.max(0, Math.round((record.endTime - record.startTime) / 1000)),
        endTime: new Date(record.endTime),
        maxHeartRate: activityMetric(record, "heart_rate.statistics", ["max"]),
        minHeartRate: activityMetric(record, "heart_rate.statistics", ["min"]),
        name: record.name ?? record.desc ?? null,
        rawData: JSON.parse(JSON.stringify(record)),
        startTime: new Date(record.startTime),
        steps: (() => {
          const value = activityMetric(record, "steps", ["steps"])
          return value == null ? null : Math.round(value)
        })(),
        syncedAt: new Date(),
      },
    })
    workoutsSynced += 1
  }

  const lastSyncedAt = new Date()
  await db.healthConnection.update({
    where: { id: connection.id },
    data: { dataRegionBaseUrl: regionBaseUrl, lastSyncedAt },
  })

  return {
    daysRequested: days,
    lastSyncedAt: lastSyncedAt.toISOString(),
    summariesSynced,
    workoutsSynced,
  }
}

export {
  connectHuawei,
  createHuaweiState,
  disconnectHuawei,
  getHuaweiConnection,
  isHuaweiConfigured,
  syncHuaweiHealth,
  verifyHuaweiState,
}
