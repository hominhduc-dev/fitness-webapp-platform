import { Router } from "express"

import { authLimiter } from "../middleware/rate-limit"
import { asyncHandler, validated } from "../middleware/validate"
import {
  getCurrentProfile,
  loginUser,
  logoutCurrentSession,
  refreshAuthSession,
  requireCurrentProfile,
  registerUser,
  requestPasswordReset,
  uploadCurrentProfileAvatar,
  updateCurrentProfile,
} from "../services/auth.service"
import { resetCurrentTraineeData } from "../services/fitness-data.service"
import {
  avatarSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.schemas"
import { getAccessToken } from "./route.utils"

const authRouter = Router()

// Auth endpoints return a flatter payload than the `{ data, error, meta }` envelope
// used elsewhere; the frontend auth client depends on that shape, so these handlers
// call res.json() directly. Errors still travel to the central error middleware.

authRouter.post(
  "/register",
  authLimiter,
  validated({ body: registerSchema }, async (req, res) => {
    const result = await registerUser(req.body)
    res.status(result.requiresEmailConfirmation ? 202 : 201).json(result)
  }),
)

authRouter.post(
  "/login",
  authLimiter,
  validated({ body: loginSchema }, async (req, res) => {
    res.json(await loginUser(req.body))
  }),
)

authRouter.post(
  "/refresh",
  authLimiter,
  validated({ body: refreshSchema }, async (req, res) => {
    res.json(await refreshAuthSession(req.body))
  }),
)

authRouter.post(
  "/forgot-password",
  authLimiter,
  validated({ body: forgotPasswordSchema }, async (req, res) => {
    res.json(await requestPasswordReset(req.body))
  }),
)

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json(await getCurrentProfile(getAccessToken(req)))
  }),
)

authRouter.post(
  "/me/avatar",
  validated({ body: avatarSchema }, async (req, res) => {
    res.json(await uploadCurrentProfileAvatar(getAccessToken(req), req.body))
  }),
)

authRouter.patch(
  "/me",
  validated({ body: updateProfileSchema }, async (req, res) => {
    res.json(await updateCurrentProfile(getAccessToken(req), req.body))
  }),
)

authRouter.post(
  "/me/reset-trainee-data",
  asyncHandler(async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json(await resetCurrentTraineeData(profile))
  }),
)

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.json(await logoutCurrentSession(getAccessToken(req)))
  }),
)

export { authRouter }
