import { Router } from "express"
import { env } from "../config/env"
import { buildAuthorizationUrl } from "../lib/google"
import { requireCurrentProfile } from "../services/auth.service"
import { BadRequestError } from "../services/errors"
import { connectGoogle, createGoogleState, disconnectGoogle, getGoogleConnection, GOOGLE_STATE_MAX_AGE, verifyGoogleState } from "../services/google-connection.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"
import { getGoogleSpreadsheet, importGoogleProgram } from "../services/google-program-import.service"
import { createGoogleProgramTemplate } from "../services/google-program-template.service"

/**
 * Connecting a Google account works for coaches and trainees alike. It is served
 * at `/api/google` and, for the OAuth redirect URI already registered with
 * Google, also under `/api/coach/google`.
 */
export const googleConnectionRouter = Router()
const cookieName = "fitness_google_oauth"
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.isProduction, path: "/" }
googleConnectionRouter.get("/connection", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await getGoogleConnection(profile)) } catch (error) { sendApiError(res, error) }
})
googleConnectionRouter.post("/authorize", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    // Rejects roles that cannot hold a connection before any state is issued.
    await getGoogleConnection(profile)
    const { nonce, state } = createGoogleState(profile.id)
    res.cookie(cookieName, nonce, { ...cookieOptions, maxAge: GOOGLE_STATE_MAX_AGE })
    sendData(res, { url: buildAuthorizationUrl(state) })
  } catch (error) { sendApiError(res, error) }
})
googleConnectionRouter.get("/callback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  try {
    const nonce = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? ""
    res.clearCookie(cookieName, cookieOptions)
    const userId = verifyGoogleState(typeof req.query.state === "string" ? req.query.state : "", nonce)
    if (req.query.error || typeof req.query.code !== "string") throw new BadRequestError("Quyền Google chưa được cấp. Hãy kết nối lại.")
    const { role } = await connectGoogle(userId, req.query.code)
    res.redirect(`${env.frontendUrl}${role === "trainee" ? "/progress" : "/coach/programs"}?google=connected`)
  } catch (error) { sendApiError(res, error) }
})
googleConnectionRouter.delete("/connection", async (req, res) => {
  try { const { profile } = await requireCurrentProfile(getAccessToken(req)); sendData(res, await disconnectGoogle(profile)) } catch (error) { sendApiError(res, error) }
})

/** Coach-only program sheet features; each service asserts the coach role. */
export const googleRouter = Router()
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
googleRouter.use(googleConnectionRouter)
