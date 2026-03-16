import { Router } from "express"
import { MealType } from "@prisma/client"

import { requireCurrentProfile } from "../services/auth.service"
import { createMealForUser, deleteMealForUser, listMealsForUser, updateMealForUser } from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const mealRouter = Router()

mealRouter.get("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const dateValue = typeof req.query.date === "string" ? req.query.date : undefined
    const result = await listMealsForUser(profile.profile, dateValue ? new Date(dateValue) : undefined)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

mealRouter.post("/", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const meal = await createMealForUser(profile.profile, {
      calories: Number(req.body.calories ?? 0),
      carbs: req.body.carbs == null ? undefined : Number(req.body.carbs),
      fat: req.body.fat == null ? undefined : Number(req.body.fat),
      name: String(req.body.name ?? ""),
      protein: req.body.protein == null ? undefined : Number(req.body.protein),
      recordedAt: typeof req.body.recordedAt === "string" ? req.body.recordedAt : undefined,
      type: Object.values(MealType).includes(req.body.type) ? req.body.type : MealType.breakfast,
    })

    res.status(201).json({
      meal,
    })
  } catch (error) {
    sendError(res, error)
  }
})

mealRouter.patch("/:mealId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const meal = await updateMealForUser(profile.profile, String(req.params.mealId), {
      calories: Number(req.body.calories ?? 0),
      carbs: req.body.carbs == null ? undefined : Number(req.body.carbs),
      fat: req.body.fat == null ? undefined : Number(req.body.fat),
      name: String(req.body.name ?? ""),
      protein: req.body.protein == null ? undefined : Number(req.body.protein),
      recordedAt: typeof req.body.recordedAt === "string" ? req.body.recordedAt : undefined,
      type: Object.values(MealType).includes(req.body.type) ? req.body.type : MealType.breakfast,
    })

    res.json({
      meal,
    })
  } catch (error) {
    sendError(res, error)
  }
})

mealRouter.delete("/:mealId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteMealForUser(profile.profile, String(req.params.mealId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

export { mealRouter }
