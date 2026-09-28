import { Router, type Response } from "express"

import { EXERCISE_ACTIVITY_TYPES, MUSCLE_SLUGS } from "../domain/muscle-profile"
import { requireCurrentProfile } from "../services/auth.service"
import { AppError } from "../services/errors"
import { listExerciseLibrary, listExercises } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const exerciseRouter = Router()

/**
 * The catalogue is thousands of rows and rarely changes. The browser keeps a
 * copy but asks every time; Express answers from the body's ETag, so an
 * unchanged catalogue costs a 304 with no body. `Vary` keeps one account's copy
 * from being revalidated as another's on a shared device.
 */
function setRevalidateHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-cache")
  res.setHeader("Vary", "Authorization")
}

function parseExerciseQuery(query: Record<string, unknown>) {
  const muscle = typeof query.muscle === "string" ? query.muscle.trim().toLowerCase() : undefined
  const activityType = typeof query.activityType === "string" ? query.activityType.trim().toLowerCase() : undefined

  if (muscle && !MUSCLE_SLUGS.includes(muscle as (typeof MUSCLE_SLUGS)[number])) {
    throw new AppError("Muscle slug không hợp lệ.", { code: "INVALID_MUSCLE_SLUG", status: 400 })
  }

  if (activityType && !EXERCISE_ACTIVITY_TYPES.includes(activityType as (typeof EXERCISE_ACTIVITY_TYPES)[number])) {
    throw new AppError("Activity type không hợp lệ.", { code: "INVALID_ACTIVITY_TYPE", status: 400 })
  }

  return {
    activityType: activityType as (typeof EXERCISE_ACTIVITY_TYPES)[number] | undefined,
    equipment: typeof query.equipment === "string" ? query.equipment : undefined,
    muscle: muscle as (typeof MUSCLE_SLUGS)[number] | undefined,
    muscleGroup: typeof query.muscleGroup === "string" ? query.muscleGroup : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
  }
}

exerciseRouter.get("/library", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const exercises = await listExerciseLibrary(profile.profile, parseExerciseQuery(req.query as Record<string, unknown>))

    setRevalidateHeaders(res)
    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

exerciseRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const exercises = await listExercises(profile.profile, parseExerciseQuery(req.query as Record<string, unknown>))

    setRevalidateHeaders(res)
    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { exerciseRouter }
