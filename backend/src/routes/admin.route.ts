import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { getAdminDashboard } from "../services/admin.service"
import { getAccessToken, sendError } from "./route.utils"

const adminRouter = Router()

adminRouter.get("/dashboard", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const dashboard = await getAdminDashboard(profile)

    res.json(dashboard)
  } catch (error) {
    sendError(res, error)
  }
})

export { adminRouter }
