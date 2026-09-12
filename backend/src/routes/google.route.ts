import { Router } from "express"
import { env } from "../config/env"
import { buildAuthorizationUrl } from "../lib/google"
import { requireCurrentProfile } from "../services/auth.service"
import { BadRequestError } from "../services/errors"
import { assertCoach } from "../services/fitness-data/shared/guards"
import { connectGoogle, createGoogleState, disconnectGoogle, getGoogleConnection, GOOGLE_STATE_MAX_AGE, verifyGoogleState } from "../services/google-connection.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"
import { getGoogleSpreadsheet, importGoogleProgram } from "../services/google-program-import.service"
import { createGoogleProgramTemplate } from "../services/google-program-template.service"

export const googleRouter = Router()
const cookieName = "fitness_google_oauth"
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.isProduction, path: "/" }
googleRouter.post("/spreadsheet", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await getGoogleSpreadsheet(profile, String(req.body.spreadsheet ?? ""))) } catch (error) { sendApiError(res, error) }
})
googleRouter.post("/program-template", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await createGoogleProgramTemplate(profile, {
      folder: typeof req.body?.folder === "string" ? req.body.folder : undefined,
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
    }))
  } catch (error) { sendApiError(res, error) }
})
googleRouter.post("/program-import", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await importGoogleProgram(profile, String(req.body.spreadsheet ?? ""), String(req.body.sheetName ?? ""))) } catch (error) { sendApiError(res, error) }
})
googleRouter.get("/connection", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await getGoogleConnection(profile)) } catch (error) { sendApiError(res, error) }
})
googleRouter.post("/authorize", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    assertCoach(profile)
    const { nonce, state } = createGoogleState(profile.id)
    res.cookie(cookieName, nonce, { ...cookieOptions, maxAge: GOOGLE_STATE_MAX_AGE })
    sendData(res, { url: buildAuthorizationUrl(state) })
  } catch (error) { sendApiError(res, error) }
})
googleRouter.get("/callback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  try {
    const nonce = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? ""
    res.clearCookie(cookieName, cookieOptions)
    const userId = verifyGoogleState(typeof req.query.state === "string" ? req.query.state : "", nonce)
    if (req.query.error || typeof req.query.code !== "string") throw new BadRequestError("Quyền Google chưa được cấp. Hãy kết nối lại.")
    await connectGoogle(userId, req.query.code)
    res.redirect(`${env.frontendUrl}/coach/programs?google=connected`)
  } catch (error) { sendApiError(res, error) }
})
googleRouter.delete("/connection", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await disconnectGoogle(profile)) } catch (error) { sendApiError(res, error) }
})
