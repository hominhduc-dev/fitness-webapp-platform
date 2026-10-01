import { Router } from "express"

import { env } from "../config/env"
import { buildHuaweiAuthorizationUrl } from "../lib/huawei"
import { requireCurrentProfile } from "../services/auth.service"
import { BadRequestError } from "../services/errors"
import {
  connectHuawei,
  createHuaweiState,
  disconnectHuawei,
  getHuaweiConnection,
  HUAWEI_STATE_MAX_AGE,
  syncHuaweiHealth,
  verifyHuaweiState,
} from "../services/huawei-health.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"

const integrationsRouter = Router()
const huaweiRouter = Router()

const cookieName = "fitness_huawei_oauth"
const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: env.isProduction,
}

function readCookie(cookieHeader: string | undefined, name: string) {
  return (
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  )
}

huaweiRouter.get("/connection", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await getHuaweiConnection(profile))
  } catch (error) {
    sendApiError(res, error)
  }
})

huaweiRouter.post("/authorize", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    await getHuaweiConnection(profile)

    const { nonce, state } = createHuaweiState(profile.id)
    res.cookie(cookieName, nonce, { ...cookieOptions, maxAge: HUAWEI_STATE_MAX_AGE })
    sendData(res, { url: buildHuaweiAuthorizationUrl(state) })
  } catch (error) {
    sendApiError(res, error)
  }
})

huaweiRouter.get("/callback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")

  try {
    const nonce = readCookie(req.headers.cookie, cookieName)
    res.clearCookie(cookieName, cookieOptions)

    const userId = verifyHuaweiState(
      typeof req.query.state === "string" ? req.query.state : "",
      nonce,
    )

    if (req.query.error || typeof req.query.code !== "string") {
      throw new BadRequestError("Quyền Huawei Health chưa được cấp. Hãy kết nối lại.", {
        code: "HUAWEI_AUTHORIZATION_DENIED",
      })
    }

    await connectHuawei(userId, req.query.code)
    res.redirect(`${env.frontendUrl}/profile?huawei=connected`)
  } catch (error) {
    sendApiError(res, error)
  }
})

huaweiRouter.post("/sync", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const daysRaw = typeof req.body?.days === "number" ? req.body.days : undefined
    const timezoneOffset =
      typeof req.body?.timezoneOffset === "string" ? req.body.timezoneOffset : undefined

    sendData(
      res,
      await syncHuaweiHealth(profile, {
        days: daysRaw,
        timezoneOffset,
      }),
    )
  } catch (error) {
    sendApiError(res, error)
  }
})

huaweiRouter.delete("/connection", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await disconnectHuawei(profile))
  } catch (error) {
    sendApiError(res, error)
  }
})

integrationsRouter.use("/huawei", huaweiRouter)

export { integrationsRouter }
