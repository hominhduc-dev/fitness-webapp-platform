import { Router } from "express"
import { z } from "zod"

import { env } from "../config/env"
import { buildAuthorizationUrl } from "../lib/huawei-health"
import { getRequestTimeZone } from "../lib/time-zone"
import { asyncHandler, validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import { BadRequestError } from "../services/errors"
import {
  connectHuawei,
  createHuaweiState,
  disconnectHuawei,
  getHuaweiConnection,
  HUAWEI_STATE_MAX_AGE,
  verifyHuaweiState,
} from "../services/huawei-connection.service"
import { listWearableDailySummaries, requestHuaweiSync } from "../services/huawei-health-sync.service"
import { getAccessToken, sendData } from "./route.utils"

/** Huawei Health Kit connection and the daily wearable totals it syncs, served at `/api/huawei`. */
const huaweiRouter = Router()
const cookieName = "fitness_huawei_oauth"
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.isProduction, path: "/" }

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
  state: z.string().default(""),
})
const dailyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
})

huaweiRouter.get("/connection", asyncHandler(async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await getHuaweiConnection(profile))
}))

huaweiRouter.post("/authorize", asyncHandler(async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  // Rejects roles that cannot hold a connection before any state is issued.
  await getHuaweiConnection(profile)
  const { nonce, state } = createHuaweiState(profile.id, getRequestTimeZone())
  res.cookie(cookieName, nonce, { ...cookieOptions, maxAge: HUAWEI_STATE_MAX_AGE })
  sendData(res, { url: buildAuthorizationUrl(state) })
}))

huaweiRouter.get("/callback", validated({ query: callbackQuerySchema }, async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  const nonce = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? ""
  res.clearCookie(cookieName, cookieOptions)
  const { userId, timeZone } = verifyHuaweiState(req.query.state, nonce)
  if (req.query.error || !req.query.code) throw new BadRequestError("Quyền Huawei Health chưa được cấp. Hãy kết nối lại.")
  const { role } = await connectHuawei(userId, timeZone, req.query.code)
  res.redirect(`${env.frontendUrl}${role === "trainee" ? "/progress" : "/dashboard"}?huawei=connected`)
}))

huaweiRouter.delete("/connection", asyncHandler(async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await disconnectHuawei(profile))
}))

huaweiRouter.post("/sync", asyncHandler(async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await requestHuaweiSync(profile))
}))

huaweiRouter.get("/daily", validated({ query: dailyQuerySchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await listWearableDailySummaries(profile, req.query.days))
}))

export { huaweiRouter }
