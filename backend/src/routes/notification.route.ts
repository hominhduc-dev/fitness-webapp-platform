import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  listNotificationsForUser,
  markAllNotificationsAsReadForUser,
  markNotificationAsReadForUser,
} from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const notificationRouter = Router()

notificationRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined
    const result = await listNotificationsForUser(profile.profile, {
      limit: Number.isFinite(limit) ? limit : undefined,
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

notificationRouter.patch("/:notificationId/read", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const notification = await markNotificationAsReadForUser(profile.profile, String(req.params.notificationId))

    res.json({
      notification,
    })
  } catch (error) {
    sendError(res, error)
  }
})

notificationRouter.post("/read-all", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await markAllNotificationsAsReadForUser(profile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

export { notificationRouter }
