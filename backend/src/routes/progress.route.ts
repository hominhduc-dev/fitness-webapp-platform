import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  createBodyMetricForCurrentTrainee,
  listBodyMetricsForCurrentTrainee,
} from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const progressRouter = Router()

progressRouter.get("/weight", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const days = typeof req.query.days === "string" ? Number(req.query.days) : undefined
    const bodyMetrics = await listBodyMetricsForCurrentTrainee(profile.profile, {
      days: Number.isFinite(days) ? days : undefined,
    })

    res.json({
      bodyMetrics,
    })
  } catch (error) {
    sendError(res, error)
  }
})

progressRouter.post("/weight", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const bodyMetric = await createBodyMetricForCurrentTrainee(profile.profile, {
      note: typeof req.body.note === "string" ? req.body.note : undefined,
      recordedAt: typeof req.body.recordedAt === "string" ? req.body.recordedAt : undefined,
      weightKg: req.body.weightKg == null ? undefined : Number(req.body.weightKg),
    })

    res.status(201).json({
      bodyMetric,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { progressRouter }
