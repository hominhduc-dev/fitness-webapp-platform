import { Router } from "express"

import { asyncHandler, validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import {
  listNotificationsForUser,
  markAllNotificationsAsReadForUser,
  markNotificationAsReadForUser,
} from "../services/fitness-data.service"
import {
  getPushPublicConfig,
  revokePushSubscriptionForUser,
  savePushSubscriptionForUser,
  sendTestPushForUser,
  type PushSubscriptionInput,
} from "../services/push-notification.service"
import { getAccessToken, sendData, sendError } from "./route.utils"
import { pushSubscriptionSchema, revokePushSubscriptionSchema } from "./notification.schemas"

const notificationRouter = Router()

notificationRouter.get(
  "/push/config",
  asyncHandler(async (_req, res) => {
    sendData(res, getPushPublicConfig())
  }),
)

notificationRouter.post(
  "/push/subscriptions",
  validated({ body: pushSubscriptionSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const subscription = await savePushSubscriptionForUser(
      profile,
      req.body as PushSubscriptionInput,
      req.headers["user-agent"],
    )

    sendData(res, subscription)
  }),
)

notificationRouter.delete(
  "/push/subscriptions",
  validated({ body: revokePushSubscriptionSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await revokePushSubscriptionForUser(profile, req.body.endpoint))
  }),
)

notificationRouter.post(
  "/push/test",
  asyncHandler(async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await sendTestPushForUser(profile))
  }),
)

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
