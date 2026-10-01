import { WearableSource } from "@prisma/client"

import { env } from "../config/env"
import * as huawei from "../lib/huawei-health"
import type { HuaweiDailyPolymerizeResponse, HuaweiSamplePoint } from "../lib/huawei-health"
import { logger } from "../lib/logger"
import { getTimeZoneOffsetMs, toZonedDateKey } from "../lib/time-zone"
import { AppError, TooManyRequestsError } from "./errors"
import type { SerializedProfile } from "./auth.service"
import { ensurePrisma } from "./fitness-data/shared/guards"
import { getHuaweiAccessToken, getHuaweiConnection, isHuaweiConfigured } from "./huawei-connection.service"

/**
 * Pulls daily step, calorie, heart-rate and resting heart-rate totals from Huawei Health Kit into
 * WearableDailySummary.
 *
 * Each run re-reads the last SYNC_DAYS days: a band only uploads when its phone
 * app syncs, so yesterday's totals can still grow today.
 */

const SYNC_DAYS = 7
const MAX_HISTORY_DAYS = 90
const MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000
const SYNC_BATCH_SIZE = 50
const DAY_IN_MS = 24 * 60 * 60 * 1000

type DailyTotals = {
  activeKcal?: number
  avgHeartRate?: number
  maxHeartRate?: number
  minHeartRate?: number
  restingHeartRate?: number
  steps?: number
}

function fieldNumber(field: { floatValue?: number; integerValue?: number; longValue?: number }) {
  const value = field.floatValue ?? field.integerValue ?? field.longValue
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/**
 * Health Kit mixes units: `dailyPolymerize` groups are epoch milliseconds around
 * sample points in nanoseconds, sometimes sent as strings. Any post-2001 instant
 * is >= 1e12 in ms and >= 1e18 in ns, so the unit is read off the magnitude.
 */
function epochToDate(value: number | string | undefined) {
  const epoch = typeof value === "string" ? Number(value) : value
  if (typeof epoch !== "number" || !Number.isFinite(epoch)) return undefined
  if (epoch >= 1e17) return new Date(Math.floor(epoch / 1e6))
  if (epoch >= 1e14) return new Date(Math.floor(epoch / 1e3))
  return new Date(epoch)
}

/** Response data types of the heart-rate statistics, matched exactly: both contain "heart_rate". */
const HEART_RATE_STATISTICS = "com.huawei.continuous.heart_rate.statistics"
const RESTING_HEART_RATE_STATISTICS = "com.huawei.continuous.resting_heart_rate.statistics"

/** How many averages each day's mean fields are the mean of, kept off the row itself. */
const meanCounts = new WeakMap<DailyTotals, Map<keyof DailyTotals, number>>()

function foldMean(totals: DailyTotals, key: "avgHeartRate" | "restingHeartRate", value: number) {
  const counts = meanCounts.get(totals) ?? new Map<keyof DailyTotals, number>()
  const count = (counts.get(key) ?? 0) + 1
  counts.set(key, count)
  meanCounts.set(totals, counts)
  totals[key] = ((totals[key] ?? 0) * (count - 1) + value) / count
}

/**
 * Folds one point into its day. Totals take the larger reading rather than a
 * sum: when the phone and the band both report a day, Huawei can return a point
 * per device, and adding them would double count.
 */
function applyPoint(totals: DailyTotals, point: HuaweiSamplePoint) {
  const max = (current: number | undefined, next: number) => (current === undefined ? next : Math.max(current, next))
  const min = (current: number | undefined, next: number) => (current === undefined ? next : Math.min(current, next))

  for (const field of point.value ?? []) {
    const value = fieldNumber(field)
    if (value === undefined) continue

    if (point.dataTypeName === HEART_RATE_STATISTICS) {
      if (field.fieldName === "avg") foldMean(totals, "avgHeartRate", value)
      else if (field.fieldName === "max") totals.maxHeartRate = max(totals.maxHeartRate, value)
      else if (field.fieldName === "min") totals.minHeartRate = min(totals.minHeartRate, value)
    } else if (point.dataTypeName === RESTING_HEART_RATE_STATISTICS) {
      // One resting value per day; `avg` is that value when only one is recorded.
      if (field.fieldName === "avg") foldMean(totals, "restingHeartRate", value)
    } else if (field.fieldName === "steps") {
      totals.steps = max(totals.steps, Math.round(value))
    } else if (field.fieldName === "calories" || field.fieldName === "calories_total") {
      totals.activeKcal = max(totals.activeKcal, value)
    }
  }
}

/** Maps a `sampleSet:dailyPolymerize` reply to totals keyed by `YYYY-MM-DD` in `timeZone`. */
function parseDailyPolymerize(response: HuaweiDailyPolymerizeResponse, timeZone: string, into = new Map<string, DailyTotals>()) {
  for (const group of response.group ?? []) {
    for (const sampleSet of group.sampleSet ?? []) {
      for (const point of sampleSet.samplePoints ?? []) {
        const start = epochToDate(point.startTime ?? group.startTime)
        if (!start) continue
        const key = toZonedDateKey(start, timeZone)
        const totals = into.get(key) ?? {}
        applyPoint(totals, point)
        into.set(key, totals)
      }
    }
  }

  return into
}

/** Huawei wants the offset as `+0700` / `-0330`. */
function formatUtcOffset(instant: Date, timeZone: string) {
  const minutes = Math.round(getTimeZoneOffsetMs(instant, timeZone) / 60_000)
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`
}

function dayKeyMinus(key: string, days: number) {
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() - days * DAY_IN_MS).toISOString().slice(0, 10)
}

function errorCode(error: unknown) {
  return error instanceof AppError ? error.code : "HUAWEI_SYNC_FAILED"
}

async function syncHuaweiHealthForUser(userId: string, now = new Date()) {
  const db = ensurePrisma()
  const connection = await db.huaweiConnection.findUnique({ where: { userId }, select: { timeZone: true } })
  if (!connection) return { days: 0 }

  try {
    const accessToken = await getHuaweiAccessToken(userId)
    const endKey = toZonedDateKey(now, connection.timeZone)
    const range = {
      endDay: endKey.replaceAll("-", ""),
      startDay: dayKeyMinus(endKey, SYNC_DAYS - 1).replaceAll("-", ""),
      timeZone: formatUtcOffset(now, connection.timeZone),
    }

    const days = new Map<string, DailyTotals>()
    for (const dataType of huawei.DAILY_DATA_TYPES) {
      parseDailyPolymerize(await huawei.fetchDailyPolymerize(accessToken, { ...range, dataType }), connection.timeZone, days)
    }

    await db.$transaction(
      [...days].map(([key, totals]) => {
        const data = { ...totals, syncedAt: now }
        const date = new Date(`${key}T00:00:00.000Z`)
        return db.wearableDailySummary.upsert({
          create: { userId, source: WearableSource.huawei, date, ...data },
          update: data,
          where: { userId_source_date: { date, source: WearableSource.huawei, userId } },
        })
      }),
    )
    await db.huaweiConnection.updateMany({ where: { userId }, data: { lastSyncedAt: now, lastSyncError: null } })

    return { days: days.size }
  } catch (error) {
    // Stamping lastSyncedAt on failure too keeps a revoked grant from being
    // retried on every tick; the error code tells the UI to ask for a reconnect.
    await db.huaweiConnection.updateMany({ where: { userId }, data: { lastSyncedAt: now, lastSyncError: errorCode(error) } })
    throw error
  }
}

/** The "Sync now" button. Cooled down so it cannot be used to hammer Huawei's quota. */
async function requestHuaweiSync(profile: SerializedProfile, now = new Date()) {
  const status = await getHuaweiConnection(profile)
  if (status.lastSyncedAt && now.getTime() - status.lastSyncedAt.getTime() < MANUAL_SYNC_COOLDOWN_MS) {
    throw new TooManyRequestsError("Vừa đồng bộ xong. Hãy thử lại sau vài phút.", { code: "HUAWEI_SYNC_COOLDOWN" })
  }
  return syncHuaweiHealthForUser(profile.id, now)
}

async function listWearableDailySummaries(profile: SerializedProfile, days: number, now = new Date()) {
  await getHuaweiConnection(profile)
  const endKey = toZonedDateKey(now)
  const from = new Date(`${dayKeyMinus(endKey, Math.min(days, MAX_HISTORY_DAYS) - 1)}T00:00:00.000Z`)
  const rows = await ensurePrisma().wearableDailySummary.findMany({
    orderBy: { date: "asc" },
    select: { activeKcal: true, avgHeartRate: true, date: true, maxHeartRate: true, minHeartRate: true, restingHeartRate: true, source: true, steps: true, syncedAt: true },
    where: { date: { gte: from }, userId: profile.id },
  })
  return rows.map((row) => ({ ...row, date: row.date.toISOString().slice(0, 10) }))
}

/** One pass over the connections due for a sync. A failing user is logged and does not stop the others. */
async function runHuaweiSyncTick(now = new Date()) {
  const due = await ensurePrisma().huaweiConnection.findMany({
    orderBy: { lastSyncedAt: { nulls: "first", sort: "asc" } },
    select: { userId: true },
    take: SYNC_BATCH_SIZE,
    where: { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(now.getTime() - env.huaweiHealthSyncIntervalMs) } }] },
  })

  let synced = 0
  for (const { userId } of due) {
    try {
      await syncHuaweiHealthForUser(userId, now)
      synced += 1
    } catch (error) {
      logger.warn("huawei health sync failed", { code: errorCode(error), userId })
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
  formatUtcOffset,
  listWearableDailySummaries,
  parseDailyPolymerize,
  requestHuaweiSync,
  runHuaweiSyncTick,
  startHuaweiSyncScheduler,
  stopHuaweiSyncScheduler,
  syncHuaweiHealthForUser,
}
