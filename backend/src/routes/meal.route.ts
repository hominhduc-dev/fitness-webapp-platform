import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  addMealItemForUser,
  deleteMealItemForUser,
  listNutritionDayForUser,
} from "../services/nutrition.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"

const mealRouter = Router()

mealRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const nutrition = await listNutritionDayForUser(profile.profile, req.query.date)

    sendData(res, nutrition)
  } catch (error) {
    sendApiError(res, error)
  }
})

mealRouter.post("/items", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const meal = await addMealItemForUser(profile.profile, req.body)

    sendData(res, { meal }, { status: 201 })
  } catch (error) {
    sendApiError(res, error)
  }
})

mealRouter.delete("/items/:itemId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const meal = await deleteMealItemForUser(profile.profile, String(req.params.itemId))

    sendData(res, { meal })
  } catch (error) {
    sendApiError(res, error)
  }
})

export { mealRouter }
