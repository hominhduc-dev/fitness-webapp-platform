import { Router } from "express"

import {
  getCurrentProfile,
  loginUser,
  logoutCurrentSession,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  updateCurrentProfile,
} from "../services/auth.service"
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

authRouter.patch("/me", async (req, res) => {
  try {
    const result = await updateCurrentProfile(getAccessToken(req), {
      avatar: typeof req.body.avatar === "string" || req.body.avatar === null ? req.body.avatar : undefined,
      fitnessGoals: Array.isArray(req.body.fitnessGoals)
        ? req.body.fitnessGoals.map((goal: unknown) => String(goal))
        : undefined,
      name: typeof req.body.name === "string" || req.body.name === null ? req.body.name : undefined,
    })

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
