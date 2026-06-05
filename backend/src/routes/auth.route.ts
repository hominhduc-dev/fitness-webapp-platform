import { Router } from "express"

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
import { getAccessToken, sendError } from "./route.utils"

const authRouter = Router()

authRouter.post("/register", async (req, res) => {
  try {
    const result = await registerUser({
      email: String(req.body.email ?? ""),
      name: String(req.body.name ?? ""),
      password: String(req.body.password ?? ""),
      phone: String(req.body.phone ?? ""),
      redirectTo: typeof req.body.redirectTo === "string" ? req.body.redirectTo : undefined,
      role: typeof req.body.role === "string" ? req.body.role : undefined,
      username: String(req.body.username ?? ""),
    })

    res.status(result.requiresEmailConfirmation ? 202 : 201).json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/login", async (req, res) => {
  try {
    const result = await loginUser({
      identifier: String(req.body.identifier ?? req.body.email ?? ""),
      password: String(req.body.password ?? ""),
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/refresh", async (req, res) => {
  try {
    const result = await refreshAuthSession({
      accessToken: typeof req.body.accessToken === "string" ? req.body.accessToken : undefined,
      refreshToken: String(req.body.refreshToken ?? ""),
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/forgot-password", async (req, res) => {
  try {
    const result = await requestPasswordReset({
      email: String(req.body.identifier ?? req.body.email ?? ""),
      redirectTo: typeof req.body.redirectTo === "string" ? req.body.redirectTo : undefined,
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.get("/me", async (req, res) => {
  try {
    const result = await getCurrentProfile(getAccessToken(req))
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/me/avatar", async (req, res) => {
  try {
    const result = await uploadCurrentProfileAvatar(getAccessToken(req), {
      dataUrl: typeof req.body.dataUrl === "string" ? req.body.dataUrl : "",
      fileName: typeof req.body.fileName === "string" ? req.body.fileName : undefined,
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.patch("/me", async (req, res) => {
  try {
    const result = await updateCurrentProfile(getAccessToken(req), {
      avatar: typeof req.body.avatar === "string" || req.body.avatar === null ? req.body.avatar : undefined,
      dailyCalorieGoal:
        req.body.dailyCalorieGoal == null ? req.body.dailyCalorieGoal : Number(req.body.dailyCalorieGoal),
      fitnessGoals: Array.isArray(req.body.fitnessGoals)
        ? req.body.fitnessGoals.map((goal: unknown) => String(goal))
        : undefined,
      heightCm: req.body.heightCm == null ? req.body.heightCm : Number(req.body.heightCm),
      name: typeof req.body.name === "string" || req.body.name === null ? req.body.name : undefined,
      phone: typeof req.body.phone === "string" || req.body.phone === null ? req.body.phone : undefined,
      preferredWeightUnit:
        typeof req.body.preferredWeightUnit === "string" || req.body.preferredWeightUnit === null
          ? req.body.preferredWeightUnit
          : undefined,
      targetWeightKg: req.body.targetWeightKg == null ? req.body.targetWeightKg : Number(req.body.targetWeightKg),
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/me/reset-trainee-data", async (req, res) => {
  try {
    const currentProfile = await requireCurrentProfile(getAccessToken(req))
    const result = await resetCurrentTraineeData(currentProfile.profile)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

authRouter.post("/logout", async (req, res) => {
  try {
    const result = await logoutCurrentSession(getAccessToken(req))
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

export { authRouter }
