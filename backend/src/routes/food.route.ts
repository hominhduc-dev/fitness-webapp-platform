import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import { searchFoodsForUser } from "../services/meal-log.service"
import { getAccessToken, sendError } from "./route.utils"

const foodRouter = Router()

foodRouter.get("/search", async (req, res) => {
  try {
    await requireCurrentProfile(getAccessToken(req))
    const query = typeof req.query.q === "string" ? req.query.q : ""
    const result = await searchFoodsForUser(query)

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

export { foodRouter }
