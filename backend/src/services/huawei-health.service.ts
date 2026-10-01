import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { HealthProvider, UserRole } from "@prisma/client"

import { env } from "../config/env"
import * as huawei from "../lib/huawei"
import { logger } from "../lib/logger"
import { DEFAULT_TIME_ZONE, getTimeZoneOffsetMs } from "../lib/time-zone"
import {
  decryptHuaweiToken,
  encryptHuaweiToken,
  isHuaweiTokenCryptoConfigured,
} from "../lib/huawei-token-crypto"
import type { SerializedProfile } from "./auth.service"
import { AppError, BadRequestError, ExternalServiceError } from "./errors"
import { assertTrainee, ensurePrisma } from "./fitness-data/shared/guards"

const PROVIDER = HealthProvider.huawei
const CONNECTABLE_ROLE = UserRole.trainee
const MAX_SYNC_DAYS = 30
const DEFAULT_SYNC_DAYS = 7

/** Background sync re-reads a short window: bands upload late, but rarely by more than a day or two. */
const BACKGROUND_SYNC_DAYS = 3
const BACKGROUND_SYNC_BATCH_SIZE = 25

type SummaryColumn =
  | "activeCalories"
  | "avgHeartRate"
  | "awakeMinutes"
  | "bodyFatPct"
  | "deepSleepMinutes"
  | "distanceMeters"
  | "lightSleepMinutes"
  | "maxHeartRate"
  | "minHeartRate"
  | "remSleepMinutes"
  | "restingHeartRate"
  | "sleepMinutes"
  | "steps"
  | "stressAvg"
  | "weightKg"

/** Columns stored as whole numbers. */
const INTEGER_COLUMNS: ReadonlySet<SummaryColumn> = new Set([
  "awakeMinutes",
  "deepSleepMinutes",
  "lightSleepMinutes",
  "remSleepMinutes",
  "sleepMinutes",
  "steps",
])

const SLEEP_COLUMNS = [
  "sleepMinutes",
  "deepSleepMinutes",
  "lightSleepMinutes",
  "remSleepMinutes",
  "awakeMinutes",
] as const satisfies readonly SummaryColumn[]

const WEIGHT_SCOPE = "https://www.huawei.com/healthkit/heightweight.read"
type SummaryValues = Partial<Record<SummaryColumn, number>>

/**
 * How several readings for one day fold together. Totals take the larger value
 * rather than a sum: when the phone and the band both report a day, Huawei can
 * return a point per device, and adding them would double count.
 */
type Fold = "max" | "mean" | "min"

/**
 * Raw data types queried through `sampleSet:dailyPolymerize`, one per request,
 * and the fields of the statistics type Huawei answers with.
 */
const DAILY_METRICS: Array<{
  columns: Array<{ column: SummaryColumn; fields: string[]; fold: Fold }>
  dataType: string
  /** Optional scope the grant must hold; the type is skipped, not failed, without it. */
  scope?: string
}> = [
  { dataType: "com.huawei.continuous.steps.delta", columns: [{ column: "steps", fields: ["steps"], fold: "max" }] },
  { dataType: "com.huawei.continuous.distance.delta", columns: [{ column: "distanceMeters", fields: ["distance"], fold: "max" }] },
  {
    dataType: "com.huawei.continuous.calories.burnt",
    columns: [{ column: "activeCalories", fields: ["calories_total", "calories"], fold: "max" }],
  },
  {
    dataType: "com.huawei.instantaneous.heart_rate",
    columns: [
      { column: "avgHeartRate", fields: ["avg"], fold: "mean" },
      { column: "minHeartRate", fields: ["min"], fold: "min" },
      { column: "maxHeartRate", fields: ["max"], fold: "max" },
    ],
  },
  {
    dataType: "com.huawei.instantaneous.resting_heart_rate",
    columns: [{ column: "restingHeartRate", fields: ["avg", "last"], fold: "mean" }],
  },
  { dataType: "com.huawei.instantaneous.stress", columns: [{ column: "stressAvg", fields: ["avg"], fold: "mean" }] },
  {
    // Body fat is part of the weight type: its daily statistics carry the weight
    // as avg/max/min/last and the body fat rate as avg_body_fat_rate.
    dataType: "com.huawei.instantaneous.body_weight",
    columns: [
      { column: "weightKg", fields: ["last", "avg"], fold: "mean" },
      { column: "bodyFatPct", fields: ["avg_body_fat_rate"], fold: "mean" },
    ],
    scope: WEIGHT_SCOPE,
  },
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
      latestSummary: null,
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
  const requiredHealthScopes = huawei.SCOPES.filter(
    (scope) => scope.startsWith("https://") && !huawei.OPTIONAL_SCOPES.has(scope),
  )
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

/** How many readings each day's mean columns average, kept off the values themselves. */
const meanCounts = new WeakMap<SummaryValues, Map<SummaryColumn, number>>()

function foldValue(values: SummaryValues, column: SummaryColumn, fold: Fold, value: number) {
  const current = values[column]

  if (fold === "mean") {
    const counts = meanCounts.get(values) ?? new Map<SummaryColumn, number>()
    const count = (counts.get(column) ?? 0) + 1
    counts.set(column, count)
    meanCounts.set(values, counts)
    values[column] = current === undefined ? value : current + (value - current) / count
    return
  }

  values[column] = current === undefined ? value : fold === "max" ? Math.max(current, value) : Math.min(current, value)
}

/**
 * Folds one `dailyPolymerize` reply into per-day values. Each request names a
 * single data type, so every point in the reply belongs to `metric`.
 */
function mergeDailyPolymerize(
  into: Map<string, SummaryValues>,
  response: huawei.HuaweiPolymerizeResponse,
  metric: (typeof DAILY_METRICS)[number],
  offsetMinutes: number,
) {
  for (const group of response.group ?? []) {
    for (const set of group.sampleSet ?? []) {
      for (const point of set.samplePoints ?? []) {
        const startMs = epochToMs(point.startTime ?? group.startTime)
        if (startMs == null) continue

        const dateKey = dateKeyFromMs(startMs, offsetMinutes)
        const values = into.get(dateKey) ?? {}
        const fields = valuesMap(point.value)

        for (const { column, fields: names, fold } of metric.columns) {
          const name = names.find((candidate) => fields.has(candidate))
          if (name) foldValue(values, column, fold, fields.get(name)!)
        }

        into.set(dateKey, values)
      }
    }
  }

  return into
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

/**
 * Health Kit mixes units: `dailyPolymerize` groups are epoch milliseconds around
 * sample points in nanoseconds, and health records are nanoseconds, sometimes
 * sent as strings. Any post-2001 instant is >= 1e12 in ms and >= 1e18 in ns, so
 * the unit is read off the magnitude.
 */
function epochToMs(value: number | string | undefined) {
  let epoch: number
  if (typeof value === "number") {
    epoch = value
  } else if (typeof value === "string" && /^\d+$/.test(value)) {
    // Nanosecond strings exceed Number precision; BigInt keeps the millisecond part exact.
    if (value.length > 15) return Number(BigInt(value) / 1_000_000n)
    epoch = Number(value)
  } else {
    return null
  }

  if (!Number.isFinite(epoch)) return null
  if (epoch >= 1e17) return Math.floor(epoch / 1_000_000)
  if (epoch >= 1e14) return Math.floor(epoch / 1_000)
  return epoch
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

/**
 * Sleep durations are milliseconds in health records, but a minute value is
 * accepted too: no real duration is both over 1440 minutes and under a minute.
 */
function durationToMinutes(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined
  return value > 1440 ? value / 60_000 : value
}

type SleepSummary = Partial<Record<(typeof SLEEP_COLUMNS)[number], number>>

/**
 * Sleep per day, keyed by the local day each sleep ends on.
 *
 * Overlapping records are one sleep seen by several devices (the phone and the
 * watch): each such cluster counts once, through the record that saw the most
 * of it, while a separate nap still adds. A record's own `all_sleep_time` and
 * stage durations are used when present, since its interval also covers time
 * awake; otherwise the cluster's span is the sleep time.
 */
function sleepSummaryByDate(
  records: huawei.HuaweiHealthRecord[],
  dateKeys: string[],
  offsetMinutes: number,
) {
  const allowed = new Set(dateKeys)
  const recordsByDate = new Map<string, Array<{ endMs: number; fields: Map<string, number>; startMs: number }>>()

  for (const record of records) {
    const startMs = epochToMs(record.startTime)
    const endMs = epochToMs(record.endTime)
    if (startMs == null || endMs == null || endMs <= startMs) continue

    const dateKey = dateKeyFromMs(endMs, offsetMinutes)
    if (!allowed.has(dateKey)) continue

    const dayRecords = recordsByDate.get(dateKey) ?? []
    dayRecords.push({ endMs, fields: valuesMap(record.value), startMs })
    recordsByDate.set(dateKey, dayRecords)
  }

  const summaries = new Map<string, SleepSummary>()
  for (const [dateKey, dayRecords] of recordsByDate) {
    dayRecords.sort((left, right) => left.startMs - right.startMs)

    const clusters: Array<{ endMs: number; records: typeof dayRecords; startMs: number }> = []
    for (const record of dayRecords) {
      const current = clusters[clusters.length - 1]
      if (current && record.startMs <= current.endMs) {
        current.endMs = Math.max(current.endMs, record.endMs)
        current.records.push(record)
      } else {
        clusters.push({ endMs: record.endMs, records: [record], startMs: record.startMs })
      }
    }

    const summary: SleepSummary = {}
    const add = (column: keyof SleepSummary, minutes: number | undefined) => {
      if (minutes != null) summary[column] = (summary[column] ?? 0) + minutes
    }

    for (const cluster of clusters) {
      const asleep = (record: (typeof dayRecords)[number]) =>
        durationToMinutes(record.fields.get("all_sleep_time")) ?? (record.endMs - record.startMs) / 60_000
      const best = cluster.records.reduce((left, right) => (asleep(right) > asleep(left) ? right : left))

      add("sleepMinutes", durationToMinutes(best.fields.get("all_sleep_time")) ?? (cluster.endMs - cluster.startMs) / 60_000)
      add("deepSleepMinutes", durationToMinutes(best.fields.get("deep_sleep_time")))
      add("lightSleepMinutes", durationToMinutes(best.fields.get("light_sleep_time")))
      add("remSleepMinutes", durationToMinutes(best.fields.get("dream_time")))
      add("awakeMinutes", durationToMinutes(best.fields.get("awake_time")))
    }

    summaries.set(dateKey, summary)
  }

  return summaries
}

/**
 * Mirrors a day's Huawei weight into the trainee's weight log (BodyMetricEntry),
 * one entry per local day at local noon. A weight the trainee entered themselves
 * that day wins: the synced entry is then removed rather than shown beside it.
 */
async function syncWeightEntries(
  userId: string,
  weightsByDate: Map<string, { bodyFatPct?: number; weightKg: number }>,
  offsetMinutes: number,
) {
  const db = ensurePrisma()
  let synced = 0

  for (const [dateKey, { bodyFatPct, weightKg }] of weightsByDate) {
    const dayStart = new Date(dateFromKey(dateKey).getTime() - offsetMinutes * 60_000)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const externalId = `huawei:${dateKey}`

    const manual = await db.bodyMetricEntry.findFirst({
      select: { id: true },
      where: { recordedAt: { gte: dayStart, lt: dayEnd }, source: null, traineeId: userId, weightKg: { not: null } },
    })
    if (manual) {
      await db.bodyMetricEntry.deleteMany({ where: { externalId, traineeId: userId } })
      continue
    }

    const data = { bodyFatPct: bodyFatPct ?? null, weightKg }
    await db.bodyMetricEntry.upsert({
      create: {
        ...data,
        externalId,
        recordedAt: new Date(dayStart.getTime() + 12 * 3_600_000),
        source: PROVIDER,
        traineeId: userId,
      },
      update: data,
      where: { traineeId_externalId: { externalId, traineeId: userId } },
    })
    synced += 1
  }

  return synced
}

function failureCode(error: unknown) {
  return error instanceof AppError ? error.code : "UNKNOWN"
}

/**
 * Pulls `days` of Huawei data for one user. Every source is fetched on its own,
 * so a type Huawei refuses (or a scope the user later revoked) does not stop the
 * rest; a column whose source failed keeps the value it already had.
 */
async function syncHuaweiHealthForUser(userId: string, options: { days: number; timezoneOffset: string }) {
  const offsetMinutes = parseTimezoneOffset(options.timezoneOffset)
  const db = ensurePrisma()

  // Stamped before anything can fail, so the background job backs off a broken
  // grant instead of retrying it every tick.
  await db.healthConnection.updateMany({
    where: { provider: PROVIDER, userId },
    data: { lastSyncAttemptAt: new Date() },
  })

  const { accessToken, connection } = await getHuaweiAccessToken(userId)
  const { dateKeys, endTime, startTime } = buildSyncRange(options.days, offsetMinutes)
  const startDay = dateKeys[0].replaceAll("-", "")
  const endDay = dateKeys[dateKeys.length - 1].replaceAll("-", "")

  let regionBaseUrl = connection.dataRegionBaseUrl
  const failedSources: string[] = []
  const syncedColumns = new Set<SummaryColumn>()
  const valuesByDate = new Map<string, SummaryValues>()

  const attempt = async <T>(source: string, request: () => Promise<huawei.HuaweiHealthResult<T>>) => {
    try {
      const result = await request()
      regionBaseUrl = result.baseUrl
      return result.data
    } catch (error) {
      failedSources.push(source)
      logger.warn("huawei health source failed", { code: failureCode(error), source, userId })
      return null
    }
  }

  const grantedScopes = new Set(connection.scope.split(/\s+/).filter(Boolean))

  for (const metric of DAILY_METRICS) {
    if (metric.scope && !grantedScopes.has(metric.scope)) continue
    const daily = await attempt(metric.dataType, () =>
      huawei.fetchDailyPolymerize(
        accessToken,
        { dataType: metric.dataType, endDay, startDay, timeZone: options.timezoneOffset },
        regionBaseUrl,
      ),
    )
    if (!daily) continue
    mergeDailyPolymerize(valuesByDate, daily, metric, offsetMinutes)
    for (const { column } of metric.columns) syncedColumns.add(column)
  }

  const sleep = await attempt("com.huawei.health.record.sleep", () =>
    huawei.fetchSleepRecords(
      accessToken,
      { endTimeNs: nsFromMs(endTime), startTimeNs: nsFromMs(startTime) },
      regionBaseUrl,
    ),
  )
  if (sleep) {
    for (const column of SLEEP_COLUMNS) syncedColumns.add(column)
    for (const [dateKey, summary] of sleepSummaryByDate(sleep.healthRecords ?? [], dateKeys, offsetMinutes)) {
      valuesByDate.set(dateKey, { ...valuesByDate.get(dateKey), ...summary })
    }
  }

  const workouts = await attempt("activityRecords", () =>
    huawei.fetchActivityRecords(accessToken, { endTime, startTime }, regionBaseUrl),
  )

  if (syncedColumns.size === 0 && !workouts) {
    throw new ExternalServiceError("Không lấy được dữ liệu nào từ Huawei Health.", {
      code: "HUAWEI_HEALTH_SYNC_FAILED",
      details: { failedSources },
    })
  }

  let summariesSynced = 0
  for (const dateKey of dateKeys) {
    const dayValues = valuesByDate.get(dateKey) ?? {}
    // Only columns whose source answered: a failed source must not blank out
    // what an earlier sync stored.
    const values: Partial<Record<SummaryColumn, number | null>> = {}
    for (const column of syncedColumns) {
      const value = dayValues[column]
      values[column] = value == null ? null : INTEGER_COLUMNS.has(column) ? Math.round(value) : value
    }

    const hasAnyValue = Object.values(values).some((value) => value != null)
    if (!hasAnyValue) continue

    const syncedAt = new Date()
    await db.healthDailySummary.upsert({
      where: {
        userId_provider_date: {
          date: dateFromKey(dateKey),
          provider: PROVIDER,
          userId,
        },
      },
      create: {
        ...values,
        date: dateFromKey(dateKey),
        provider: PROVIDER,
        syncedAt,
        userId,
      },
      update: { ...values, syncedAt },
    })
    summariesSynced += 1
  }

  let weightsSynced = 0
  if (syncedColumns.has("weightKg")) {
    const weightsByDate = new Map<string, { bodyFatPct?: number; weightKg: number }>()
    for (const dateKey of dateKeys) {
      const { bodyFatPct, weightKg } = valuesByDate.get(dateKey) ?? {}
      if (weightKg != null) weightsByDate.set(dateKey, { bodyFatPct, weightKg })
    }
    weightsSynced = await syncWeightEntries(userId, weightsByDate, offsetMinutes)
  }

  let workoutsSynced = 0
  for (const record of workouts?.activityRecord ?? []) {
    if (typeof record.startTime !== "number" || typeof record.endTime !== "number") continue

    const externalId =
      record.id ??
      [record.startTime, record.endTime, record.activityType ?? "unknown", record.name ?? ""].join(":")

    await db.healthWorkout.upsert({
      where: {
        userId_provider_externalId: {
          externalId,
          provider: PROVIDER,
          userId: userId,
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
        userId: userId,
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
    data: { dataRegionBaseUrl: regionBaseUrl, lastSyncedAt, syncTimezoneOffset: options.timezoneOffset },
  })

  return {
    daysRequested: options.days,
    failedSources,
    lastSyncedAt: lastSyncedAt.toISOString(),
    summariesSynced,
    weightsSynced,
    workoutsSynced,
  }
}

/** The "Sync" button. Remembers the browser's offset for the background job. */
async function syncHuaweiHealth(
  profile: SerializedProfile,
  options?: { days?: number; timezoneOffset?: string },
) {
  assertConnectableProfile(profile)

  const requestedDays = options?.days ?? DEFAULT_SYNC_DAYS
  const days = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(MAX_SYNC_DAYS, Math.trunc(requestedDays)))
    : DEFAULT_SYNC_DAYS

  return syncHuaweiHealthForUser(profile.id, { days, timezoneOffset: options?.timezoneOffset ?? "+0000" })
}

/** `+0700` for the app's default zone, used for a connection that never ran a manual sync. */
function defaultTimezoneOffset(now = new Date()) {
  const minutes = Math.round(getTimeZoneOffsetMs(now, DEFAULT_TIME_ZONE) / 60_000)
  const abs = Math.abs(minutes)
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`
}

/** One pass over the trainees due for a sync. A failing user is logged and does not stop the others. */
async function runHuaweiSyncTick(now = new Date()) {
  const due = await ensurePrisma().healthConnection.findMany({
    orderBy: { lastSyncAttemptAt: { nulls: "first", sort: "asc" } },
    select: { syncTimezoneOffset: true, userId: true },
    take: BACKGROUND_SYNC_BATCH_SIZE,
    where: {
      OR: [
        { lastSyncAttemptAt: null },
        { lastSyncAttemptAt: { lt: new Date(now.getTime() - env.huaweiHealthSyncIntervalMs) } },
      ],
      provider: PROVIDER,
      refreshTokenEncrypted: { not: null },
      user: { role: CONNECTABLE_ROLE },
    },
  })

  let synced = 0
  for (const connection of due) {
    try {
      await syncHuaweiHealthForUser(connection.userId, {
        days: BACKGROUND_SYNC_DAYS,
        timezoneOffset: connection.syncTimezoneOffset ?? defaultTimezoneOffset(now),
      })
      synced += 1
    } catch (error) {
      logger.warn("huawei health background sync failed", { code: failureCode(error), userId: connection.userId })
    }
  }

  if (due.length > 0) logger.info("huawei health sync tick", { due: due.length, synced })
  return { due: due.length, synced }
}

let timer: NodeJS.Timeout | null = null
let running = false

function startHuaweiSyncScheduler() {
  if (timer || !env.huaweiHealthSyncEnabled || !env.databaseUrl || !isHuaweiConfigured()) return

  const tick = async () => {
    // A slow tick (many users, slow Huawei) must not overlap the next one.
    if (running) return
    running = true
    try {
      await runHuaweiSyncTick()
    } catch (error) {
      logger.error("huawei health sync tick failed", { error })
    } finally {
      running = false
    }
  }

  // Ticks run more often than the per-user interval so a batch left over from a
  // busy tick is picked up well before the next interval.
  const tickMs = Math.max(60_000, Math.floor(env.huaweiHealthSyncIntervalMs / 6))
  timer = setInterval(() => void tick(), tickMs)
  timer.unref()
  logger.info("huawei health sync scheduler started", { intervalMs: env.huaweiHealthSyncIntervalMs, tickMs })
}

function stopHuaweiSyncScheduler() {
  if (timer) clearInterval(timer)
  timer = null
}

export {
  connectHuawei,
  createHuaweiState,
  disconnectHuawei,
  getHuaweiConnection,
  isHuaweiConfigured,
  mergeDailyPolymerize,
  runHuaweiSyncTick,
  sleepSummaryByDate,
  startHuaweiSyncScheduler,
  stopHuaweiSyncScheduler,
  syncHuaweiHealth,
  syncHuaweiHealthForUser,
  verifyHuaweiState,
}
