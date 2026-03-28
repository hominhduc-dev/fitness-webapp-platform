import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  createPersonalWorkoutForTrainee,
  createWorkoutLogForTrainee,
  deletePersonalWorkoutForTrainee,
  deleteWorkoutLogForTrainee,
  getWorkoutDetailForTrainee,
  listWorkoutsForTrainee,
  updatePersonalWorkoutForTrainee,
} from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const workoutRouter = Router()

function parsePersonalWorkoutInput(body: unknown) {
  const payload = typeof body === "object" && body !== null ? body : {}
  const requestBody = payload as {
    duration?: unknown
    exercises?: Array<{
      repsMin?: unknown
      variationId?: unknown
      reps?: unknown
      restTime?: unknown
      sets?: unknown
      weight?: unknown
    }>
    name?: unknown
    notes?: unknown
    scheduledDay?: unknown
    scheduledDate?: unknown
  }

  return {
    duration: typeof requestBody.duration === "number" ? requestBody.duration : undefined,
    exercises: Array.isArray(requestBody.exercises)
      ? requestBody.exercises.map((exercise) => ({
          repsMin: typeof exercise?.repsMin === "number" ? exercise.repsMin : undefined,
          variationId: typeof exercise?.variationId === "string" ? exercise.variationId : "",
          reps: typeof exercise?.reps === "number" ? exercise.reps : 0,
          restTime: typeof exercise?.restTime === "number" ? exercise.restTime : undefined,
          sets: typeof exercise?.sets === "number" ? exercise.sets : 0,
          weight: typeof exercise?.weight === "number" ? exercise.weight : undefined,
        }))
      : [],
    name: typeof requestBody.name === "string" ? requestBody.name : "",
    notes: typeof requestBody.notes === "string" ? requestBody.notes : undefined,
    scheduledDay: typeof requestBody.scheduledDay === "number" ? requestBody.scheduledDay : undefined,
    scheduledDate: typeof requestBody.scheduledDate === "string" ? requestBody.scheduledDate : undefined,
  }
}

workoutRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await listWorkoutsForTrainee(profile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.get("/:workoutId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const workout = await getWorkoutDetailForTrainee(profile.profile, String(req.params.workoutId))

    res.json({
      workout,
    })
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.post("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const workout = await createPersonalWorkoutForTrainee(profile.profile, parsePersonalWorkoutInput(req.body))

    res.status(201).json({
      workout,
    })
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.patch("/:workoutId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const workout = await updatePersonalWorkoutForTrainee(
      profile.profile,
      String(req.params.workoutId),
      parsePersonalWorkoutInput(req.body),
    )

    res.json({
      workout,
    })
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.post("/:workoutId/logs", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const log = await createWorkoutLogForTrainee(profile.profile, String(req.params.workoutId), {
      completedAt: typeof req.body.completedAt === "string" ? req.body.completedAt : undefined,
      exercises: Array.isArray(req.body.exercises) ? req.body.exercises : [],
      notes: typeof req.body.notes === "string" ? req.body.notes : undefined,
      startedAt: typeof req.body.startedAt === "string" ? req.body.startedAt : undefined,
    })

    res.status(201).json({
      log,
    })
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.delete("/:workoutId/logs/:logId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteWorkoutLogForTrainee(
      profile.profile,
      String(req.params.workoutId),
      String(req.params.logId),
    )

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

workoutRouter.delete("/:workoutId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deletePersonalWorkoutForTrainee(profile.profile, String(req.params.workoutId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

export { workoutRouter }
