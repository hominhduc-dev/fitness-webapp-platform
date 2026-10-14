import { Router } from "express"
import { heavyLimiter } from "../middleware/rate-limit"
import { validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import { createFeedback, getFeedback, listFeedback, updateFeedback } from "../services/feedback.service"
import { createFeedbackSchema, feedbackIdSchema, feedbackPaginationSchema, listFeedbackSchema, updateFeedbackSchema } from "./feedback.schemas"
import { getAccessToken, sendData } from "./route.utils"

const feedbackRouter = Router()
feedbackRouter.post("/", heavyLimiter, validated({ body: createFeedbackSchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await createFeedback(profile, req.body, req.headers["user-agent"]), { status: 201 })
}))
feedbackRouter.get("/mine", validated({ query: feedbackPaginationSchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await listFeedback(profile, req.query, true))
}))
feedbackRouter.get("/", validated({ query: listFeedbackSchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await listFeedback(profile, req.query))
}))
feedbackRouter.get("/:id", validated({ params: feedbackIdSchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await getFeedback(profile, req.params.id))
}))
feedbackRouter.patch("/:id", validated({ params: feedbackIdSchema, body: updateFeedbackSchema }, async (req, res) => {
  const { profile } = await requireCurrentProfile(getAccessToken(req))
  sendData(res, await updateFeedback(profile, req.params.id, req.body))
}))
export { feedbackRouter }
