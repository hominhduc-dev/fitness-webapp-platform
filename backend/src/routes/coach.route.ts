import { CoachRequestStatus, ProgramDifficulty } from "@prisma/client"
import { Router } from "express"
import { parseMuscleListValue, parseMuscleProfileInput } from "../domain/muscle-profile"
import { isSetIntensityTag, type SetIntensityAssignment } from "../domain/set-intensity-tag"

import { requireCurrentProfile } from "../services/auth.service"
import {
  adjustCoachProgramForTrainee,
  assignCoachProgramToTrainee,
  createCoachExercise,
  createBodyMetricForTrainee,
  createCoachRequestForTrainee,
  createCoachCheckInForTrainee,
  createCoachProgram,
  createWorkoutLogCommentForCoach,
  deleteCoachExercise,
  archiveCoachProgram,
  deleteCoachProgram,
  deleteWorkoutLogCommentForCoach,
  exportCoachWorkoutLogsToGoogleSheetsForTrainee,
  getCoachDashboard,
  getCoachNavCounts,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  listBodyMetricsForTrainee,
  listCoachExerciseImportRequests,
  listCoachExercises,
  listAvailableCoachesForTrainee,
  listCoachPrograms,
  listCoachWorkoutLogsForTrainee,
  listCoachTrainees,
  restoreCoachProgram,
  submitCoachExerciseImportRequest,
  unassignCoachProgramFromTrainee,
  updateCoachExercise,
  updateCoachProgram,
  updateWorkoutLogCommentForCoach,
  updateCoachRequestStatus,
} from "../services/fitness-data.service"
import {
  importNotionProgram,
  isNotionConfigured,
  listNotionProgramTemplates,
  overwriteNotionProgram,
} from "../services/notion-program-import.service"
import { getAccessToken, sendError } from "./route.utils"
import { googleRouter } from "./google.route"
import { assertCoach, ensurePrisma } from "../services/fitness-data/shared/guards"
import { BadRequestError } from "../services/errors"
import { sendData, sendApiError } from "./route.utils"

const coachRouter = Router()
coachRouter.use("/google", googleRouter)

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function parseExerciseImportRows(body: Record<string, unknown>) {
  return Array.isArray(body.rows)
    ? body.rows.map((row: unknown) => {
        const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {}

        return {
          activityType: getOptionalString(source.activityType),
          exerciseName: getOptionalString(source.exerciseName) ?? getOptionalString(source.name),
          equipment: getOptionalString(source.equipment),
          isDefault: typeof source.isDefault === "boolean" ? source.isDefault : undefined,
          muscleGroup: getOptionalString(source.muscleGroup),
          primaryMuscles: parseMuscleListValue(source.primaryMuscles),
          rowNumber: typeof source.rowNumber === "number" ? source.rowNumber : undefined,
          sortOrder: typeof source.sortOrder === "number" ? source.sortOrder : undefined,
          secondaryMuscles: parseMuscleListValue(source.secondaryMuscles),
          variationName: getOptionalString(source.variationName),
        }
      })
    : []
}

/**
 * Reads the per-set method tags a coach assigned. Anything that is not a known
 * tag or a positive set number is dropped here; the service clamps what remains
 * to the exercise's actual set count.
 */
function parseSetIntensityTags(value: unknown): SetIntensityAssignment[] | undefined {
  if (!Array.isArray(value)) return undefined

  const assignments = value.flatMap((entry: unknown) => {
    const record = entry && typeof entry === "object" ? (entry as { setNumber?: unknown; tag?: unknown }) : {}
    const setNumber = Number(record.setNumber)

    if (!Number.isInteger(setNumber) || setNumber < 1) return []
    if (!isSetIntensityTag(record.tag)) return []

    return [{ setNumber, tag: record.tag }]
  })

  return assignments.length ? assignments : undefined
}

function parseProgramInput(body: Record<string, unknown>) {
  return {
    assignToUserIds: Array.isArray(body.assignToUserIds)
      ? body.assignToUserIds.map((value: unknown) => String(value))
      : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    difficulty: Object.values(ProgramDifficulty).includes(body.difficulty as ProgramDifficulty)
      ? (body.difficulty as ProgramDifficulty)
      : ProgramDifficulty.beginner,
    duration: Number(body.duration ?? 0),
    name: String(body.name ?? ""),
    startDate: typeof body.startDate === "string" ? body.startDate : null,
    notionSourceId: typeof body.notionSourceId === "string" ? body.notionSourceId : undefined,
    googleSpreadsheetId: typeof body.googleSpreadsheetId === "string" ? body.googleSpreadsheetId : undefined,
    googleSheetName: typeof body.googleSheetName === "string" ? body.googleSheetName : undefined,
    workouts: Array.isArray(body.workouts)
      ? body.workouts.map((workout: unknown) => {
          const record = workout && typeof workout === "object" ? workout : {}
          const safeRecord = record as {
            duration?: unknown
            exercises?: unknown
            name?: unknown
            scheduledDay?: unknown
            scheduledDate?: unknown
            weekIndex?: unknown
          }

          return {
            duration: safeRecord.duration == null ? undefined : Number(safeRecord.duration),
            exercises: Array.isArray(safeRecord.exercises)
              ? safeRecord.exercises.map((exercise: unknown) => {
                  const exerciseRecord = exercise && typeof exercise === "object" ? exercise : {}
                  const safeExercise = exerciseRecord as {
                    notes?: unknown
                    repsMin?: unknown
                    rir?: unknown
                    restTime?: unknown
                    setIntensityTags?: unknown
                    variationId?: unknown
                    reps?: unknown
                    sets?: unknown
                    weight?: unknown
                  }

                  return {
                    notes: typeof safeExercise.notes === "string" ? safeExercise.notes : undefined,
                    repsMin: safeExercise.repsMin == null ? undefined : Number(safeExercise.repsMin),
                    rir: safeExercise.rir == null ? undefined : Number(safeExercise.rir),
                    restTime: safeExercise.restTime == null ? undefined : Number(safeExercise.restTime),
                    setIntensityTags: parseSetIntensityTags(safeExercise.setIntensityTags),
                    variationId: String(safeExercise.variationId ?? ""),
                    reps: Number(safeExercise.reps ?? 0),
                    sets: Number(safeExercise.sets ?? 0),
                    weight: safeExercise.weight == null ? undefined : Number(safeExercise.weight),
                  }
                })
              : [],
            name: String(safeRecord.name ?? ""),
            scheduledDate: typeof safeRecord.scheduledDate === "string" ? safeRecord.scheduledDate : undefined,
            scheduledDay: typeof safeRecord.scheduledDay === "number" ? safeRecord.scheduledDay : undefined,
            weekIndex: typeof safeRecord.weekIndex === "number" ? safeRecord.weekIndex : undefined,
          }
        })
      : [],
  }
}

coachRouter.get("/dashboard", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await getCoachDashboard(profile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.put("/google/program-import/:programId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    assertCoach(profile)
    const input = parseProgramInput(req.body)
    const existing = await ensurePrisma().program.findFirst({ where: {
      id: String(req.params.programId), createdById: profile.id,
    }, include: { assignments: true } })
    if (!existing || !input.googleSpreadsheetId || existing.googleSpreadsheetId !== input.googleSpreadsheetId || existing.googleSheetName !== input.googleSheetName) {
      throw new BadRequestError("Nguồn Google Sheets không khớp chương trình.")
    }
    const program = await updateCoachProgram(profile, existing.id, {
      ...input, assignToUserIds: existing.assignments.map((assignment) => assignment.userId),
    })
    sendData(res, { program })
  } catch (error) { sendApiError(res, error) }
})

coachRouter.get("/nav-counts", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const counts = await getCoachNavCounts(profile.profile)

    res.json(counts)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/discover", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const coaches = await listAvailableCoachesForTrainee(profile.profile)

    res.json({
      coaches,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/requests", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await createCoachRequestForTrainee(profile.profile, String(req.body.coachId ?? ""))

    res.status(201).json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/programs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const includeArchived = req.query.includeArchived === "1" || req.query.includeArchived === "true"
    const programs = await listCoachPrograms(profile.profile, { includeArchived })

    res.json({
      programs,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await createCoachProgram(profile.profile, parseProgramInput(req.body))

    res.status(201).json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/programs/:programId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await getCoachProgramDetail(profile.profile, String(req.params.programId))

    res.json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.patch("/programs/:programId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await updateCoachProgram(profile.profile, String(req.params.programId), parseProgramInput(req.body))

    res.json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs/:programId/adjustments", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await adjustCoachProgramForTrainee(
      profile.profile,
      String(req.params.programId),
      String(req.body.traineeId ?? ""),
      parseProgramInput(req.body),
    )

    res.status(201).json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.delete("/programs/:programId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteCoachProgram(profile.profile, String(req.params.programId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs/:programId/archive", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await archiveCoachProgram(profile.profile, String(req.params.programId))

    res.json({ program })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs/:programId/restore", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const program = await restoreCoachProgram(profile.profile, String(req.params.programId))

    res.json({ program })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/exercises", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    const exercises = await listCoachExercises(profile.profile, {
      search,
    })

    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/exercises", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const exercise = await createCoachExercise(profile.profile, {
      equipment: typeof req.body.equipment === "string" ? req.body.equipment : undefined,
      muscleGroup: String(req.body.muscleGroup ?? ""),
      muscleProfile: parseMuscleProfileInput(req.body),
      name: String(req.body.name ?? ""),
    })

    res.status(201).json({
      exercise,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/notion/program-templates", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))

    // Reported instead of thrown so the dialog can hide the Notion tab on a
    // deployment that never configured the integration.
    if (!isNotionConfigured()) {
      res.json({
        configured: false,
        templates: [],
      })

      return
    }

    const templates = await listNotionProgramTemplates(profile.profile)

    res.json({
      configured: true,
      templates,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/notion/program-import", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await importNotionProgram(profile.profile, {
      template: String(req.body.template ?? ""),
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.put("/notion/program-import/:programId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const input = parseProgramInput(req.body)
    const program = await overwriteNotionProgram(profile.profile, {
      // Omitted on purpose when the client does not send it: the service then
      // keeps the program's current trainees instead of unassigning them.
      assignToUserIds: Array.isArray(req.body.assignToUserIds) ? input.assignToUserIds : undefined,
      description: input.description,
      difficulty: input.difficulty,
      duration: input.duration,
      name: input.name,
      notionSourceId: String(req.body.notionSourceId ?? ""),
      programId: String(req.params.programId),
      workouts: input.workouts,
    })

    res.json({
      program,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/exercise-import-requests", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const requests = await listCoachExerciseImportRequests(profile.profile)

    res.json({
      requests,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/exercise-import-requests", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const request = await submitCoachExerciseImportRequest(profile.profile, {
      fileName: getOptionalString(req.body.fileName),
      rows: parseExerciseImportRows(req.body),
    })

    res.status(201).json({
      request,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.patch("/exercises/:exerciseId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const exercise = await updateCoachExercise(profile.profile, String(req.params.exerciseId), {
      equipment: typeof req.body.equipment === "string" ? req.body.equipment : undefined,
      muscleGroup: String(req.body.muscleGroup ?? ""),
      muscleProfile: parseMuscleProfileInput(req.body),
      name: String(req.body.name ?? ""),
    })

    res.json({
      exercise,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.delete("/exercises/:exerciseId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteCoachExercise(profile.profile, String(req.params.exerciseId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/programs/:programId/assignments", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await assignCoachProgramToTrainee(
      profile.profile,
      String(req.params.programId),
      String(req.body.traineeId ?? ""),
    )

    res.status(201).json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.delete("/programs/:programId/assignments/:traineeId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await unassignCoachProgramFromTrainee(
      profile.profile,
      String(req.params.programId),
      String(req.params.traineeId),
    )

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees/:traineeId/workout-logs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined
    const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined
    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const programId = typeof req.query.programId === "string" ? req.query.programId : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined
    const result = await listCoachWorkoutLogsForTrainee(profile.profile, String(req.params.traineeId), {
      cursor,
      from,
      limit: Number.isFinite(limit) ? limit : undefined,
      programId,
      to,
      weekStart,
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/trainees/:traineeId/workout-logs/export/google-sheets", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await exportCoachWorkoutLogsToGoogleSheetsForTrainee(
      profile.profile,
      String(req.params.traineeId),
      {
        from: typeof req.body.from === "string" ? req.body.from : undefined,
        label: typeof req.body.label === "string" ? req.body.label : undefined,
        programId: typeof req.body.programId === "string" ? req.body.programId : undefined,
        to: typeof req.body.to === "string" ? req.body.to : undefined,
        weekStart: typeof req.body.weekStart === "string" ? req.body.weekStart : undefined,
      },
    )

    res.json({
      data: result,
      error: null,
      meta: null,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const phoneQuery = typeof req.query.phone === "string" ? req.query.phone : undefined
    const trainees = await listCoachTrainees(profile.profile, {
      phone: phoneQuery,
    })

    res.json({
      trainees,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/workout-logs/:workoutLogId/comments", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const comment = await createWorkoutLogCommentForCoach(profile.profile, String(req.params.workoutLogId), {
      content: String(req.body.content ?? ""),
    })

    res.status(201).json({
      comment,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.patch("/workout-log-comments/:commentId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const comment = await updateWorkoutLogCommentForCoach(profile.profile, String(req.params.commentId), {
      content: String(req.body.content ?? ""),
    })

    res.json({
      comment,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.delete("/workout-log-comments/:commentId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteWorkoutLogCommentForCoach(profile.profile, String(req.params.commentId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees/:traineeId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await getCoachTraineeDetail(profile.profile, String(req.params.traineeId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees/:traineeId/body-metrics", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const days = typeof req.query.days === "string" ? Number(req.query.days) : undefined
    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined
    const bodyMetrics = await listBodyMetricsForTrainee(profile.profile, String(req.params.traineeId), {
      days: Number.isFinite(days) ? days : undefined,
      from,
      to,
    })

    res.json({
      bodyMetrics,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/trainees/:traineeId/body-metrics", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await createBodyMetricForTrainee(profile.profile, String(req.params.traineeId), {
      armCm: req.body.armCm == null ? undefined : Number(req.body.armCm),
      bodyFatPct: req.body.bodyFatPct == null ? undefined : Number(req.body.bodyFatPct),
      chestCm: req.body.chestCm == null ? undefined : Number(req.body.chestCm),
      hipsCm: req.body.hipsCm == null ? undefined : Number(req.body.hipsCm),
      note: typeof req.body.note === "string" ? req.body.note : undefined,
      recordedAt: typeof req.body.recordedAt === "string" ? req.body.recordedAt : undefined,
      thighCm: req.body.thighCm == null ? undefined : Number(req.body.thighCm),
      waistCm: req.body.waistCm == null ? undefined : Number(req.body.waistCm),
      weightKg: req.body.weightKg == null ? undefined : Number(req.body.weightKg),
    })

    res.status(201).json({
      bodyMetric: result,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.post("/trainees/:traineeId/check-ins", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await createCoachCheckInForTrainee(profile.profile, String(req.params.traineeId), {
      adherenceScore: req.body.adherenceScore == null ? undefined : Number(req.body.adherenceScore),
      checkInDate: typeof req.body.checkInDate === "string" ? req.body.checkInDate : undefined,
      energyScore: req.body.energyScore == null ? undefined : Number(req.body.energyScore),
      feedback: String(req.body.feedback ?? ""),
      moodScore: req.body.moodScore == null ? undefined : Number(req.body.moodScore),
      nextFocus: typeof req.body.nextFocus === "string" ? req.body.nextFocus : undefined,
      recoveryScore: req.body.recoveryScore == null ? undefined : Number(req.body.recoveryScore),
      summary: typeof req.body.summary === "string" ? req.body.summary : undefined,
    })

    res.status(201).json({
      checkIn: result,
    })
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.patch("/requests/:requestId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const status =
      req.body.status === CoachRequestStatus.approved ? CoachRequestStatus.approved : CoachRequestStatus.rejected
    const request = await updateCoachRequestStatus(profile.profile, String(req.params.requestId), status)

    res.json({
      request,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { coachRouter }
