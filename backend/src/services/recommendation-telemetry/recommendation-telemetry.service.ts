import { UserRole } from "@prisma/client"

import type { SerializedProfile } from "../auth.service"
import { logger } from "../../lib/logger"
import { ForbiddenError } from "../errors"
import { getWorkoutDetailForTrainee } from "../fitness-data/core"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { getVolumeRecoveryForTrainee } from "../volume-recovery/volume-recovery.service"
import {
  buildRecommendationEventRows,
  evaluateEvent,
  evaluateOutcome,
  performedSets,
  type ExerciseLike,
  type SnapshotContext,
} from "./recommendation-events"
import { summarizeTelemetry, type GroupedCount } from "./telemetry-summary"

/**
 * Recommendation telemetry: what the engine suggested for each exercise of a
 * session, what the trainee then did, and how the next session went.
 *
 * Nothing here may fail the request that triggers it — the callers fire and
 * forget, and every entry point logs and swallows its own errors.
 */

/** A draft first synced later than this was trained offline; the log snapshot covers it. */
const SNAPSHOT_MAX_SESSION_AGE_MS = 3 * 60 * 60 * 1000
/** A snapshot older than this is not the session a log belongs to. */
const OPEN_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

async function loadIncrementsFor(variationIds: readonly string[]) {
  const db = ensurePrisma()
  const variations = variationIds.length > 0
    ? await db.variation.findMany({ select: { id: true, loadIncrementKg: true }, where: { id: { in: [...new Set(variationIds)] } } })
    : []
  return new Map(variations.map((variation) => [variation.id, variation.loadIncrementKg]))
}

const variationIdsOf = (exercises: readonly ExerciseLike[]) =>
  exercises.flatMap((exercise) => (exercise.variation?.id ? [exercise.variation.id] : []))

/**
 * Freezes the session's recommendations when its draft is first saved — the
 * moment the trainee has started the session. Computed by the same path as the
 * workout read, so it is what the session screen showed. Idempotent per
 * session: a second device or a re-created draft finds the rows already there.
 */
async function snapshotSessionRecommendations(profile: SerializedProfile, workoutId: string, sessionStartedAt: Date, now = new Date()) {
  if (profile.role !== "trainee") return 0
  if (now.getTime() - sessionStartedAt.getTime() > SNAPSHOT_MAX_SESSION_AGE_MS) return 0

  const db = ensurePrisma()
  const sessionKey = { sessionStartedAt, userId: profile.id, workoutId }
  const existing = await db.trainingRecommendationEvent.count({ where: sessionKey })
  if (existing > 0) {
    // Discarded, then resumed: the same session is live again.
    await db.trainingRecommendationEvent.updateMany({ data: { abandonedAt: null }, where: { ...sessionKey, abandonedAt: { not: null } } })
    return 0
  }

  const workoutRow = await db.workout.findUnique({ select: { programId: true }, where: { id: workoutId } })
  const recovery = await getVolumeRecoveryForTrainee(profile, undefined, workoutRow?.programId ?? undefined)
  const workout = await getWorkoutDetailForTrainee(profile, workoutId, { recovery })
  const context: SnapshotContext = {
    dayGuidance: recovery.guidance,
    muscles: recovery.muscles,
    phase: recovery.programContext?.phase ?? null,
    readiness: recovery.readiness,
    targetRir: recovery.programContext?.targetRir ?? null,
  }
  const exercises = workout.exercises as unknown as ExerciseLike[]
  const rows = buildRecommendationEventRows({
    context,
    exercises,
    loadIncrementByVariationId: await loadIncrementsFor(variationIdsOf(exercises)),
    programId: workout.programId ?? null,
    sessionStartedAt,
    source: "session_start",
    userId: profile.id,
    workoutId,
  })
  if (rows.length === 0) return 0

  const { count } = await db.trainingRecommendationEvent.createMany({ data: rows, skipDuplicates: true })
  return count
}

/** The session was discarded without a log: its open recommendations were never acted on. */
async function abandonOpenRecommendations(userId: string, workoutId: string, now = new Date()) {
  const db = ensurePrisma()
  const { count } = await db.trainingRecommendationEvent.updateMany({
    data: { abandonedAt: now },
    where: { abandonedAt: null, userId, workoutId, workoutLogId: null },
  })
  return count
}

type LoggedSession = {
  completedAt: Date | string | null
  exercises: readonly unknown[]
  id: string
  programId?: string | null
  startedAt: Date | string
}

/**
 * Closes the loop when a session is logged. The next-session outcome of any
 * earlier suggestion for the same exercises is settled first, then this
 * session's own suggestions are compared with what was done. A session that
 * never had a server snapshot (trained offline) is snapshotted from the
 * suggestions the log itself carries.
 */
async function recordLoggedSession(userId: string, workoutId: string, log: LoggedSession, now = new Date()) {
  const db = ensurePrisma()
  // A replayed log has been recorded already.
  if ((await db.trainingRecommendationEvent.count({ where: { userId, workoutLogId: log.id } })) > 0) return { evaluated: 0, outcomes: 0 }

  const exercises = log.exercises as ExerciseLike[]
  const completedAt = log.completedAt ? new Date(log.completedAt) : now
  const outcomes = await settleOutcomes(userId, log.id, completedAt, exercises)

  let events = await openSessionEvents(userId, workoutId, now)
  if (events.length === 0) {
    const rows = buildRecommendationEventRows({
      context: null,
      exercises,
      loadIncrementByVariationId: await loadIncrementsFor(variationIdsOf(exercises)),
      programId: log.programId ?? null,
      sessionStartedAt: new Date(log.startedAt),
      source: "log_snapshot",
      userId,
      workoutId,
    })
    if (rows.length > 0) await db.trainingRecommendationEvent.createMany({ data: rows, skipDuplicates: true })
    events = await db.trainingRecommendationEvent.findMany({
      where: { sessionStartedAt: new Date(log.startedAt), userId, workoutId, workoutLogId: null },
    })
  }

  await db.$transaction(events.map((event) =>
    db.trainingRecommendationEvent.update({
      data: { ...evaluateEvent(event, exercises), abandonedAt: null, completedAt, workoutLogId: log.id },
      where: { id: event.id },
    }),
  ))

  return { evaluated: events.length, outcomes }
}

/** The latest session snapshot for this workout that no log has claimed yet. */
async function openSessionEvents(userId: string, workoutId: string, now: Date) {
  const db = ensurePrisma()
  const where = {
    sessionStartedAt: { gte: new Date(now.getTime() - OPEN_SESSION_MAX_AGE_MS) },
    userId,
    workoutId,
    workoutLogId: null,
  }
  const latest = await db.trainingRecommendationEvent.findFirst({ orderBy: { sessionStartedAt: "desc" }, select: { sessionStartedAt: true }, where })
  return latest ? db.trainingRecommendationEvent.findMany({ where: { ...where, sessionStartedAt: latest.sessionStartedAt } }) : []
}

/** For each exercise trained in this log, the verdict on the last suggestion made for it. */
async function settleOutcomes(userId: string, logId: string, completedAt: Date, exercises: readonly ExerciseLike[]) {
  const db = ensurePrisma()
  let settled = 0
  for (const exercise of exercises) {
    const variationId = exercise.variation?.id
    if (!variationId || performedSets(exercise).length === 0) continue

    const previous = await db.trainingRecommendationEvent.findFirst({
      orderBy: { completedAt: "desc" },
      where: { completedAt: { lt: completedAt }, outcome: null, userId, variationId, workoutLogId: { not: null } },
    })
    if (!previous || previous.workoutLogId === logId) continue

    const outcome = evaluateOutcome(previous, exercise)
    if (!outcome) continue
    await db.trainingRecommendationEvent.update({
      data: { outcome, outcomeAt: completedAt, outcomeLogId: logId },
      where: { id: previous.id },
    })
    settled += 1
  }
  return settled
}

/**
 * Compliance and outcome rates per algorithm version and action, overall and
 * by equipment, for recommendations shown in [from, to).
 */
async function getRecommendationTelemetrySummary(profile: SerializedProfile, range: { from: Date; to: Date }) {
  if (profile.role !== UserRole.admin) throw new ForbiddenError("Chỉ admin mới có quyền truy cập dữ liệu này.")

  const db = ensurePrisma()
  const by = ["algorithmVersion", "action", "equipment", "overallCompliance", "outcome"] as const
  const shownAt = { gte: range.from, lt: range.to }
  const [live, abandoned] = await Promise.all([
    db.trainingRecommendationEvent.groupBy({ _count: { _all: true }, by: [...by], where: { abandonedAt: null, shownAt } }),
    db.trainingRecommendationEvent.groupBy({ _count: { _all: true }, by: [...by], where: { abandonedAt: { not: null }, shownAt } }),
  ])
  const groups: GroupedCount[] = [
    ...live.map((group) => ({ ...group, abandoned: false, count: group._count._all })),
    ...abandoned.map((group) => ({ ...group, abandoned: true, count: group._count._all })),
  ]

  return {
    byAction: summarizeTelemetry(groups, { byEquipment: false }),
    byEquipment: summarizeTelemetry(groups, { byEquipment: true }),
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  }
}

/** Fire-and-forget wrappers for the request paths. */
function trackSessionStarted(profile: SerializedProfile, workoutId: string, sessionStartedAt: Date) {
  void snapshotSessionRecommendations(profile, workoutId, sessionStartedAt).catch((error: unknown) => {
    logger.warn("recommendation snapshot failed", { error, workoutId })
  })
}

function trackSessionDiscarded(userId: string, workoutId: string) {
  void abandonOpenRecommendations(userId, workoutId).catch((error: unknown) => {
    logger.warn("recommendation abandon failed", { error, workoutId })
  })
}

function trackSessionLogged(userId: string, workoutId: string, log: LoggedSession) {
  void recordLoggedSession(userId, workoutId, log).catch((error: unknown) => {
    logger.warn("recommendation outcome failed", { error, logId: log.id, workoutId })
  })
}

export {
  abandonOpenRecommendations,
  getRecommendationTelemetrySummary,
  recordLoggedSession,
  snapshotSessionRecommendations,
  trackSessionDiscarded,
  trackSessionLogged,
  trackSessionStarted,
}
