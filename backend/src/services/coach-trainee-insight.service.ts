import { AIGenerationStatus, AIGenerationType, type Prisma } from "@prisma/client"
import { randomUUID } from "crypto"

import { getAIProvider } from "../lib/ai/ai-client"
import { dateKeyInstant } from "../lib/ai/calendar"
import { checkRateLimit } from "./ai.service"
import {
  buildCoachInsightFindings,
  coachInsightFingerprint,
  generateCoachTraineeInsight,
  hasAnyData,
  insightWindows,
  type CoachInsightFindings,
  type CoachInsightInput,
  type CoachInsightOutput,
  type InsightWindow,
} from "./ai/coach-trainee-insight"
import { parseExerciseSnapshot, snapshotExerciseLabel } from "./ai/context/helpers"
import type { SerializedProfile } from "./auth.service"
import { AppError, AuthServiceError, TooManyRequestsError } from "./errors"
import { selectVisibleWorkoutsForAssignmentWeek } from "./fitness-data/core"
import {
  addUtcDays,
  clientCalendarDay,
  clientDayStart,
  DISPLAY_WEEKDAY_ORDER,
  formatClientDateKey,
  formatUtcDateOnly,
  startOfUtcWeek,
} from "./fitness-data/shared/dates"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "./fitness-data/shared/guards"
import { getIntakeSummary } from "./nutrition-intake.service"

type InsightLocale = "vi" | "en"
type Db = ReturnType<typeof ensurePrisma>

type CoachTraineeInsightResponse = CoachInsightOutput & {
  id: string
  days: InsightWindow
  generatedAt: string
  /** The trainee's data has changed, or a day has passed, since this report was written. */
  stale: boolean
  findings: CoachInsightFindings
  programNames: string[]
}

type ScheduledWorkout = { id: string; scheduledDate: Date | null; scheduledDay: number | null; weekIndex: number | null }
type ProgramForSchedule = {
  assignedAt: Date
  program: { duration: number; startDate: Date | null; workouts: ScheduledWorkout[] }
}

/**
 * One `YYYY-MM-DD` per program session due between `start` and `end`, using
 * the same week gating as the trainee's own schedule: a program that has not
 * started or has finished only contributes sessions pinned to a date, and one
 * that authored fewer weeks than it runs repeats its last authored week.
 */
function listPlannedProgramDates(assignments: ProgramForSchedule[], start: string, end: string) {
  const dates: string[] = []
  const firstWeek = startOfUtcWeek(dateKeyInstant(start))
  const last = dateKeyInstant(end)

  for (const assignment of assignments) {
    const anchor = assignment.program.startDate ?? clientCalendarDay(assignment.assignedAt)
    const seen = new Set<string>()

    for (let weekStart = firstWeek; weekStart <= last; weekStart = addUtcDays(weekStart, 7)) {
      const weekEnd = formatUtcDateOnly(addUtcDays(weekStart, 6))
      const visible = selectVisibleWorkoutsForAssignmentWeek(
        assignment.program.workouts,
        anchor,
        assignment.program.duration,
        weekStart,
        false,
      )

      for (const workout of visible) {
        let date: string | null = null
        if (workout.scheduledDate) {
          date = formatUtcDateOnly(workout.scheduledDate)
          // A dated workout is "visible" every week; it is due only in its own.
          if (date < formatUtcDateOnly(weekStart) || date > weekEnd) continue
        } else if (typeof workout.scheduledDay === "number") {
          const offset = DISPLAY_WEEKDAY_ORDER.indexOf(workout.scheduledDay)
          if (offset >= 0) date = formatUtcDateOnly(addUtcDays(weekStart, offset))
        }

        const key = `${workout.id}:${date}`
        if (!date || date < start || date > end || seen.has(key)) continue
        seen.add(key)
        dates.push(date)
      }
    }
  }

  return dates.sort()
}

/** Everything the report is computed from, for the window ending today and the one before it. */
async function loadCoachInsightInput(db: Db, trainee: Awaited<ReturnType<typeof assertCoachOwnsTrainee>>, days: InsightWindow) {
  const today = formatClientDateKey(new Date())
  const windows = insightWindows(today, days)
  const from = windows.previous.start
  const fromDay = dateKeyInstant(from)
  const todayDay = dateKeyInstant(today)
  const fromInstant = clientDayStart(fromDay)
  const untilInstant = clientDayStart(addUtcDays(todayDay, 1))

  const [assignments, logs, weights, intake, recovery, wearable] = await Promise.all([
    db.programAssignment.findMany({
      select: {
        assignedAt: true,
        program: {
          select: {
            duration: true,
            id: true,
            name: true,
            startDate: true,
            workouts: { select: { id: true, scheduledDate: true, scheduledDay: true, weekIndex: true } },
          },
        },
      },
      // "The program the coach assigned": the trainee's own routines and
      // accepted AI programs are training, but not a plan to be measured against.
      where: { program: { archivedAt: null, createdById: { not: trainee.id } }, userId: trainee.id },
    }),
    db.workoutLog.findMany({
      orderBy: { startedAt: "asc" },
      select: { exerciseSnapshot: true, programId: true, startedAt: true, totalVolume: true },
      where: { completedAt: { not: null }, startedAt: { gte: fromInstant, lt: untilInstant }, userId: trainee.id },
    }),
    db.bodyMetricEntry.findMany({
      select: { recordedAt: true, weightKg: true },
      where: { recordedAt: { gte: fromInstant, lt: untilInstant }, traineeId: trainee.id, weightKg: { not: null } },
    }),
    getIntakeSummary(db, trainee.id, todayDay, days * 2),
    db.recoveryCheckIn.findMany({
      select: { checkInDate: true, fatigue: true, readinessScore: true, sleepMinutes: true, stress: true },
      where: { checkInDate: { gte: fromDay, lte: todayDay }, userId: trainee.id },
    }),
    db.healthDailySummary.findMany({
      select: { date: true, restingHeartRate: true, steps: true },
      where: { date: { gte: fromDay, lte: todayDay }, userId: trainee.id },
    }),
  ])

  const programIds = new Set(assignments.map((assignment) => assignment.program.id))
  const input: CoachInsightInput = {
    days,
    goals: {
      calories: trainee.dailyCalorieGoal,
      protein: trainee.dailyProteinGoal,
      targetWeightKg: trainee.targetWeightKg,
    },
    intake: intake.days.map((day) => ({ calories: day.calories, date: day.date, protein: day.protein })),
    logs: logs.map((log) => ({
      date: formatClientDateKey(log.startedAt),
      exercises: parseExerciseSnapshot(log.exerciseSnapshot).map((exercise) => ({
        name: snapshotExerciseLabel(exercise),
        sets: (exercise.sets ?? []).map((set) => ({
          completed: set.completed !== false,
          reps: set.actualReps ?? null,
          weight: set.weight ?? null,
        })),
      })),
      fromProgram: Boolean(log.programId && programIds.has(log.programId)),
      volumeKg: log.totalVolume,
    })),
    plannedDates: listPlannedProgramDates(assignments, from, today),
    recovery: recovery.map((row) => ({
      date: formatUtcDateOnly(row.checkInDate),
      fatigue: row.fatigue,
      readiness: row.readinessScore,
      sleepMinutes: row.sleepMinutes,
      stress: row.stress,
    })),
    today,
    wearable: wearable.map((row) => ({ date: formatUtcDateOnly(row.date), restingHeartRate: row.restingHeartRate, steps: row.steps })),
    weights: weights.map((row) => ({ date: formatClientDateKey(row.recordedAt), weightKg: row.weightKg as number })),
  }

  return { input, programNames: assignments.map((assignment) => assignment.program.name) }
}

type StoredInput = { days?: number; fingerprint?: string; findings?: CoachInsightFindings; programNames?: string[]; traineeId?: string }

function toResponse(
  generation: { createdAt: Date; id: string; input: Prisma.JsonValue; output: Prisma.JsonValue },
  currentFingerprint: string,
): CoachTraineeInsightResponse | null {
  const input = generation.input as StoredInput | null
  const output = generation.output as CoachInsightOutput | null
  if (!input?.findings || !input.days || !output?.summary) return null
  return {
    days: input.days as InsightWindow,
    findings: input.findings,
    generatedAt: generation.createdAt.toISOString(),
    id: generation.id,
    programNames: input.programNames ?? [],
    sections: output.sections,
    stale: input.fingerprint !== currentFingerprint,
    suggestions: output.suggestions,
    summary: output.summary,
  }
}

async function requireOwnTrainee(coach: SerializedProfile, traineeId: string) {
  assertCoach(coach)
  return assertCoachOwnsTrainee(coach.id, traineeId)
}

/** The last report this coach saved for this trainee and window. Costs no tokens. */
async function getCoachTraineeInsight(coach: SerializedProfile, traineeId: string, days: InsightWindow) {
  const db = ensurePrisma()
  const trainee = await requireOwnTrainee(coach, traineeId)
  const generation = await db.aIGeneration.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, id: true, input: true, output: true },
    where: {
      AND: [{ input: { equals: traineeId, path: ["traineeId"] } }, { input: { equals: days, path: ["days"] } }],
      status: AIGenerationStatus.completed,
      type: AIGenerationType.coach_trainee_insight,
      userId: coach.id,
    },
  })
  if (!generation) return null

  const { input } = await loadCoachInsightInput(db, trainee, days)
  return toResponse(generation, coachInsightFingerprint(buildCoachInsightFindings(input)))
}

async function createCoachTraineeInsight(
  coach: SerializedProfile,
  traineeId: string,
  options: { days: InsightWindow; locale?: InsightLocale },
): Promise<CoachTraineeInsightResponse> {
  const db = ensurePrisma()
  const trainee = await requireOwnTrainee(coach, traineeId)
  const locale = options.locale ?? "vi"
  const { input, programNames } = await loadCoachInsightInput(db, trainee, options.days)
  const findings = buildCoachInsightFindings(input)
  if (!hasAnyData(findings)) {
    throw new AppError(`Trainee chưa có dữ liệu tập, ăn uống, cân nặng hay phục hồi nào trong ${options.days} ngày gần đây để phân tích.`, {
      code: "NO_TRAINEE_DATA",
      status: 422,
    })
  }

  await checkRateLimit(coach.id, AIGenerationType.coach_trainee_insight)

  const fingerprint = coachInsightFingerprint(findings)
  const baseInput = { days: options.days, fingerprint, locale, traineeId }
  const generation = await db.aIGeneration.create({
    data: {
      id: randomUUID(),
      input: baseInput as Prisma.InputJsonValue,
      status: AIGenerationStatus.pending,
      type: AIGenerationType.coach_trainee_insight,
      userId: coach.id,
    },
  })

  try {
    const result = await generateCoachTraineeInsight(getAIProvider(), findings, { locale, programNames, traineeName: trainee.name })
    const output: CoachInsightOutput = { sections: result.sections, suggestions: result.suggestions, summary: result.summary }
    const saved = await db.aIGeneration.update({
      data: {
        input: { ...baseInput, findings, programNames, promptVersion: result.promptVersion } as unknown as Prisma.InputJsonValue,
        output: output as unknown as Prisma.InputJsonValue,
        status: AIGenerationStatus.completed,
        tokenUsage: result.tokenUsage,
      },
      select: { createdAt: true, id: true, input: true, output: true },
      where: { id: generation.id },
    })
    const response = toResponse(saved, fingerprint)
    if (!response) throw new AppError("Không thể lưu báo cáo phân tích.", { status: 500 })
    return response
  } catch (error) {
    // The provider refusing for its own quota is not the coach's attempt.
    const providerRateLimited = !(error instanceof AppError) && error instanceof Error && /\b429\b/.test(error.message)
    if (providerRateLimited) {
      await db.aIGeneration.delete({ where: { id: generation.id } })
      throw new TooManyRequestsError("Dịch vụ AI đang bận. Vui lòng thử lại sau ít phút.")
    }
    await db.aIGeneration.update({
      data: { errorMsg: error instanceof Error ? error.message.slice(0, 500) : "unknown", status: AIGenerationStatus.failed },
      where: { id: generation.id },
    })
    if (error instanceof AppError) throw error
    throw new AuthServiceError("Không thể phân tích dữ liệu trainee. Vui lòng thử lại sau.", 500)
  }
}

export { createCoachTraineeInsight, getCoachTraineeInsight, listPlannedProgramDates, type CoachTraineeInsightResponse }
