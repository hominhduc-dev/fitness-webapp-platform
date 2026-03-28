import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { listExerciseLibrary, listExercises } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const exerciseRouter = Router()

function parseExerciseQuery(query: Record<string, unknown>) {
  return {
    equipment: typeof query.equipment === "string" ? query.equipment : undefined,
    muscleGroup: typeof query.muscleGroup === "string" ? query.muscleGroup : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
  }
}

exerciseRouter.get("/library", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const exercises = await listExerciseLibrary(profile.profile, parseExerciseQuery(req.query as Record<string, unknown>))

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

    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { exerciseRouter }
