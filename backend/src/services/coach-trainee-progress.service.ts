import { NotificationType } from "@prisma/client"

import type { SerializedProfile } from "./auth.service"
import { serializeProfile } from "./auth/core"
import {
  getDashboardAnalyticsForTrainee,
  getYearViewForTrainee,
  listBodyMetricsForCurrentTrainee,
} from "./fitness-data.service"
import { addLocalDays, clientCalendarDay, formatUtcDateOnly, parseLocalDateInput } from "./fitness-data/shared/dates"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "./fitness-data/shared/guards"
import { logger } from "../lib/logger"
import { buildLiftHistories, classifyLift, PLATEAU_LOOKBACK_DAYS, type LiftStatus } from "./notifications/coach-trainee-alerts"
import { getTraineeTelemetrySummary } from "./recommendation-telemetry/recommendation-telemetry.service"
import { getVolumeRecoveryForTrainee, listRecoveryHistoryForTrainee } from "./volume-recovery/volume-recovery.service"

/**
 * One trainee's progress for their coach: the same analytics the trainee's own
 * Overview reads, computed by the same services so both see the same numbers,
 * plus what only a coach needs — open alerts, how each lift stands, and how
 * closely the trainee follows the engine.
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** Strength trends and the consistency grid cover twelve weeks. */
const OVERVIEW_WEEKS = 12
const READINESS_DAYS = 14
const WEIGHT_DAYS = 90
const TELEMETRY_DAYS = 28
const ALERT_DAYS = 21

type AlertKind = "low_readiness" | "missed_workouts" | "plateau"

function readMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {}
}

async function getCoachTraineeProgressOverview(coach: SerializedProfile, traineeId: string, now = new Date()) {
  assertCoach(coach)
  const trainee = await assertCoachOwnsTrainee(coach.id, traineeId)
  const profile = serializeProfile(trainee)!
  const db = ensurePrisma()

  const today = clientCalendarDay(now)
  const periodStart = parseLocalDateInput(formatUtcDateOnly(new Date(today.getTime() - (OVERVIEW_WEEKS * 7 - 1) * DAY_MS)))!
  const periodEnd = new Date(addLocalDays(parseLocalDateInput(formatUtcDateOnly(today))!, 1).getTime() - 1)
  const year = today.getUTCFullYear()
  const gridStartYear = new Date(today.getTime() - OVERVIEW_WEEKS * 7 * DAY_MS).getUTCFullYear()

  const assignment = await db.programAssignment.findFirst({
    orderBy: { assignedAt: "desc" },
    select: { programId: true },
    where: { program: { archivedAt: null }, userId: trainee.id },
  })

  const [dashboard, thisYear, lastYear, recovery, bodyMetrics, volume, telemetry, alerts, liftLogs] = await Promise.all([
    getDashboardAnalyticsForTrainee(profile, periodStart, periodEnd),
    getYearViewForTrainee(profile, year),
    gridStartYear < year ? getYearViewForTrainee(profile, gridStartYear) : Promise.resolve(null),
    listRecoveryHistoryForTrainee(profile, READINESS_DAYS),
    listBodyMetricsForCurrentTrainee(profile, { days: WEIGHT_DAYS }),
    // A broken program context leaves the volume block empty rather than the page.
    getVolumeRecoveryForTrainee(profile, undefined, assignment?.programId ?? undefined).catch((error: unknown) => {
      logger.warn("volume recovery unavailable for coach overview", { error, traineeId })
      return null
    }),
    getTraineeTelemetrySummary(trainee.id, { from: new Date(now.getTime() - TELEMETRY_DAYS * DAY_MS), to: now }),
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, id: true, metadata: true, readAt: true },
      where: {
        createdAt: { gte: new Date(now.getTime() - ALERT_DAYS * DAY_MS) },
        metadata: { equals: trainee.id, path: ["traineeId"] },
        type: NotificationType.coach_trainee_alert,
        userId: coach.id,
      },
    }),
    db.workoutLog.findMany({
      select: { exerciseSnapshot: true, startedAt: true, workoutSnapshot: true },
      where: { completedAt: { not: null }, startedAt: { gte: new Date(now.getTime() - PLATEAU_LOOKBACK_DAYS * DAY_MS) }, userId: trainee.id },
    }),
  ])

  const liftStatuses: Record<string, LiftStatus> = {}
  for (const history of buildLiftHistories(liftLogs, now)) liftStatuses[history.name] = classifyLift(history, now)

  return {
    alerts: alerts.flatMap((alert) => {
      const metadata = readMetadata(alert.metadata)
      const kind = metadata.kind
      const weekStart = metadata.weekStart
      if ((kind !== "low_readiness" && kind !== "missed_workouts" && kind !== "plateau") || typeof weekStart !== "string") return []
      return [{
        averageReadiness: typeof metadata.averageReadiness === "number" ? metadata.averageReadiness : null,
        completed: typeof metadata.completed === "number" ? metadata.completed : null,
        days: typeof metadata.days === "number" ? metadata.days : null,
        exercises: Array.isArray(metadata.exercises) ? metadata.exercises.filter((entry): entry is string => typeof entry === "string") : [],
        id: alert.id,
        kind: kind as AlertKind,
        planned: typeof metadata.planned === "number" ? metadata.planned : null,
        raisedAt: alert.createdAt.toISOString(),
        read: alert.readAt != null,
        weekStart,
      }]
    }),
    bodyMetrics,
    consistencyDays: [...(lastYear?.days ?? []), ...thisYear.days],
    dashboard,
    liftStatuses,
    recovery,
    targetWeightKg: trainee.targetWeightKg,
    telemetry: telemetry.map((row) => ({
      action: row.action,
      algorithmVersion: row.algorithmVersion,
      compliance: row.compliance,
      outcomes: row.outcomes,
      rates: row.rates,
      shown: row.shown,
    })),
    volume,
  }
}

export { getCoachTraineeProgressOverview }
