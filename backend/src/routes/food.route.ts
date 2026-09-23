import { Router } from "express"
import { z } from "zod"

import { validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import { createFoodForUser, listFoodsForUser, updateFoodForUser } from "../services/nutrition.service"
import { getAccessToken, sendApiError, sendData } from "./route.utils"

const foodParams = z.object({ foodId: z.uuid("foodId không hợp lệ.") })

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

// The body is validated by `parseFoodDetails`, the same rules creation uses.
foodRouter.patch(
  "/:foodId",
  validated({ params: foodParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, { food: await updateFoodForUser(profile, req.params.foodId, (req.body ?? {}) as Record<string, unknown>) })
  }),
)

export { foodRouter }
