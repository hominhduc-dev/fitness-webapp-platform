import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { getDashboardForTrainee } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const dashboardRouter = Router()

dashboardRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const dashboard = await getDashboardForTrainee(profile.profile)

    res.json({
      dashboard,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { dashboardRouter }
