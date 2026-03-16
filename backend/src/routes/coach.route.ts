import { CoachRequestStatus, ProgramDifficulty } from "@prisma/client"
import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  createCoachRequestForTrainee,
  createCoachProgram,
  deleteCoachProgram,
  getCoachDashboard,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  listAvailableCoachesForTrainee,
  listCoachPrograms,
  listCoachTrainees,
  updateCoachProgram,
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
          }

          return {
            duration: safeRecord.duration == null ? undefined : Number(safeRecord.duration),
            exercises: Array.isArray(safeRecord.exercises)
              ? safeRecord.exercises.map((exercise: unknown) => {
                  const exerciseRecord = exercise && typeof exercise === "object" ? exercise : {}
                  const safeExercise = exerciseRecord as {
                    exerciseId?: unknown
                    reps?: unknown
                    restTime?: unknown
                    sets?: unknown
                  }

                  return {
                    exerciseId: String(safeExercise.exerciseId ?? ""),
                    reps: Number(safeExercise.reps ?? 0),
                    restTime: safeExercise.restTime == null ? undefined : Number(safeExercise.restTime),
                    sets: Number(safeExercise.sets ?? 0),
                  }
                })
              : [],
            name: String(safeRecord.name ?? ""),
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

coachRouter.delete("/programs/:programId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteCoachProgram(profile.profile, String(req.params.programId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

coachRouter.get("/trainees", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const trainees = await listCoachTrainees(profile.profile)

    res.json({
      trainees,
    })
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
