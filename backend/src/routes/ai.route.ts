import { Router } from "express"

import { aiLimiter } from "../middleware/rate-limit"
import { validated } from "../middleware/validate"
import {
  acceptDailyWorkout,
  acceptAIMealPlan,
  acceptAIProgram,
  chatWithAI,
  generateDailyWorkout,
  generateMealPlan,
  generateWorkoutProgram,
} from "../services/ai.service"
import { requireCurrentProfile } from "../services/auth.service"
import {
  acceptMealPlanSchema,
  chatSchema,
  generateDailyWorkoutSchema,
  generateMealPlanSchema,
  generateProgramSchema,
  generationIdSchema,
} from "./ai.schemas"
import { getAccessToken, sendData } from "./route.utils"

const aiRouter = Router()

// Every route below spends provider tokens, so the tighter per-caller budget
// applies to the whole router rather than being repeated per endpoint.
aiRouter.use(aiLimiter)

aiRouter.post(
  "/generate-workout",
  validated({ body: generateDailyWorkoutSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await generateDailyWorkout(profile, req.body), { status: 201 })
  }),
)

aiRouter.post(
  "/accept-workout",
  validated({ body: generationIdSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await acceptDailyWorkout(profile, req.body.generationId))
  }),
)

aiRouter.post(
  "/generate-program",
  validated({ body: generateProgramSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await generateWorkoutProgram(profile, req.body), { status: 201 })
  }),
)

aiRouter.post(
  "/accept-program",
  validated({ body: generationIdSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await acceptAIProgram(profile, req.body.generationId))
  }),
)

aiRouter.post(
  "/generate-meal-plan",
  validated({ body: generateMealPlanSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await generateMealPlan(profile, req.body), { status: 201 })
  }),
)

aiRouter.post(
  "/accept-meal-plan",
  validated({ body: acceptMealPlanSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await acceptAIMealPlan(profile, req.body.generationId, req.body.date))
  }),
)

aiRouter.post(
  "/chat",
  validated({ body: chatSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await chatWithAI(profile, req.body.message, req.body.history))
  }),
)

export { aiRouter }
