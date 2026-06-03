import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { createFoodForUser, listFoodsForUser } from "../services/nutrition.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"

const foodRouter = Router()

foodRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const foods = await listFoodsForUser(profile.profile, {
      category: req.query.category,
      query: req.query.query,
    })

    sendData(res, { foods })
  } catch (error) {
    sendApiError(res, error)
  }
})

foodRouter.post("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const food = await createFoodForUser(profile.profile, req.body)

    sendData(res, { food }, { status: 201 })
  } catch (error) {
    sendApiError(res, error)
  }
})

export { foodRouter }
