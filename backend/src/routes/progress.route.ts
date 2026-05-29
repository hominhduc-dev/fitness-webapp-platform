import { Router } from "express"

import { requireCurrentProfile } from "../services/auth.service"
import {
  createBodyMetricForCurrentTrainee,
  getCalendarForTrainee,
  getProgressAnalyticsForCurrentTrainee,
  getWorkoutLogDetailForTrainee,
  getYearViewForTrainee,
  listBodyMetricsForCurrentTrainee,
} from "../services/fitness-data.service"
import { getAccessToken, sendError } from "./route.utils"

const progressRouter = Router()

progressRouter.get("/analytics", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const analytics = await getProgressAnalyticsForCurrentTrainee(profile.profile)

    res.json({
      analytics,
    })
  } catch (error) {
    sendError(res, error)
  }
})

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

progressRouter.get("/calendar", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const now = new Date()
    const year =
      typeof req.query.year === "string" ? parseInt(req.query.year, 10) : now.getUTCFullYear()
    const month =
      typeof req.query.month === "string" ? parseInt(req.query.month, 10) : now.getUTCMonth() + 1

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      res.status(400).json({ error: "year và month không hợp lệ." })
      return
    }

    const summaryOnly = req.query.summaryOnly === "true"
    const result = await getCalendarForTrainee(profile.profile, year, month, { summaryOnly })
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

progressRouter.get("/year-view", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const year =
      typeof req.query.year === "string"
        ? parseInt(req.query.year, 10)
        : new Date().getUTCFullYear()

    if (!Number.isFinite(year)) {
      res.status(400).json({ error: "year không hợp lệ." })
      return
    }

    const result = await getYearViewForTrainee(profile.profile, year)
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

progressRouter.get("/workout-log/:logId", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const log = await getWorkoutLogDetailForTrainee(profile.profile, String(req.params.logId))
    res.json({ log })
  } catch (error) {
    sendError(res, error)
  }
})

export { progressRouter }
