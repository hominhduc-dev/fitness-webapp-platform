import { Router } from "express"

import {
  acceptAIMealPlan,
  acceptAIProgram,
  chatWithAI,
  generateMealPlan,
  generateWorkoutProgram,
} from "../services/ai.service"
import { requireCurrentProfile } from "../services/auth.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"

const aiRouter = Router()

aiRouter.post("/generate-program", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await generateWorkoutProgram(profile, req.body)

    sendData(res, result, { status: 201 })
  } catch (error) {
    sendApiError(res, error)
  }
})

aiRouter.post("/accept-program", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await acceptAIProgram(profile, String(req.body.generationId))

    sendData(res, result)
  } catch (error) {
    sendApiError(res, error)
  }
})

aiRouter.post("/generate-meal-plan", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await generateMealPlan(profile, req.body)

    sendData(res, result, { status: 201 })
  } catch (error) {
    sendApiError(res, error)
  }
})

aiRouter.post("/accept-meal-plan", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await acceptAIMealPlan(profile, String(req.body.generationId), String(req.body.date))

    sendData(res, result)
  } catch (error) {
    sendApiError(res, error)
  }
})

aiRouter.post("/chat", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await chatWithAI(profile, String(req.body.message ?? ""), req.body.history ?? [])

    sendData(res, result)
  } catch (error) {
    sendApiError(res, error)
  }
})

export { aiRouter }
