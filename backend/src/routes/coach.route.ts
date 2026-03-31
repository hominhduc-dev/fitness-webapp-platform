import { CoachRequestStatus, ProgramDifficulty } from "@prisma/client"
import { Router } from "express"

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
  deleteCoachProgram,
  deleteWorkoutLogCommentForCoach,
  getCoachDashboard,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  listCoachExercises,
  listAvailableCoachesForTrainee,
  listCoachPrograms,
  listCoachWorkoutLogsForTrainee,
  listCoachTrainees,
  unassignCoachProgramFromTrainee,
  updateCoachExercise,
  updateCoachProgram,
  updateWorkoutLogCommentForCoach,
  updateCoachRequestStatus,
} from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const coachRouter = Router()

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
    workouts: Array.isArray(body.workouts)
      ? body.workouts.map((workout: unknown) => {
          const record = workout && typeof workout === "object" ? workout : {}
          const safeRecord = record as {
            duration?: unknown
            exercises?: unknown
            name?: unknown
            scheduledDay?: unknown
            scheduledDate?: unknown
          }

          return {
            duration: safeRecord.duration == null ? undefined : Number(safeRecord.duration),
            exercises: Array.isArray(safeRecord.exercises)
              ? safeRecord.exercises.map((exercise: unknown) => {
                  const exerciseRecord = exercise && typeof exercise === "object" ? exercise : {}
                  const safeExercise = exerciseRecord as {
                    repsMin?: unknown
                    variationId?: unknown
                    reps?: unknown
                    sets?: unknown
                    weight?: unknown
                  }

                  return {
                    repsMin: safeExercise.repsMin == null ? undefined : Number(safeExercise.repsMin),
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
    const programs = await listCoachPrograms(profile.profile)

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
      name: String(req.body.name ?? ""),
    })

    res.status(201).json({
      exercise,
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
    const result = await listCoachWorkoutLogsForTrainee(profile.profile, String(req.params.traineeId), {
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
      weekStart,
    })

    res.json(result)
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
