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
import {
  getNotificationPreferencesForUser,
  updateNotificationPreferencesForUser,
} from "../services/notifications/notification-preferences.service"
import { getAccessToken, sendData } from "./route.utils"
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  revokePushSubscriptionSchema,
} from "./notification.schemas"

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

notificationRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await getNotificationPreferencesForUser(profile))
  }),
)

notificationRouter.put(
  "/preferences",
  validated({ body: notificationPreferencesSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await updateNotificationPreferencesForUser(profile, req.body))
  }),
)

notificationRouter.get(
  "/",
  validated({ query: listNotificationsQuerySchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await listNotificationsForUser(profile, { limit: req.query.limit }))
  }),
)

notificationRouter.patch(
  "/:notificationId/read",
  validated({ params: notificationIdParamsSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, { notification: await markNotificationAsReadForUser(profile, req.params.notificationId) })
  }),
)

notificationRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await markAllNotificationsAsReadForUser(profile))
  }),
)

export { notificationRouter }
