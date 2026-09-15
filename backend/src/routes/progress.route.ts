import { Router } from "express"

import { validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import {
  createBodyMetricForCurrentTrainee,
  getCalendarForTrainee,
  getDashboardAnalyticsForTrainee,
  getProgressAnalyticsForCurrentTrainee,
  getWorkoutLogDetailForTrainee,
  getYearViewForTrainee,
  listBodyMetricsForCurrentTrainee,
  getVolumeRecoveryForTrainee,
  listRecoveryHistoryForTrainee,
  resetVolumeLandmarksForTrainee,
  setVolumeRecommendationStatusForTrainee,
  upsertRecoveryCheckInForTrainee,
  upsertVolumeLandmarksForTrainee,
} from "../services/fitness-data.service"
import { addLocalDays, parseLocalDateInput } from "../services/fitness-data/shared/dates"
import { getAccessToken, sendData, sendError } from "./route.utils"
import {
  recoveryCheckInSchema,
  recoveryHistoryQuerySchema,
  volumeLandmarksResetSchema,
  volumeLandmarksSchema,
  volumeRecommendationStatusSchema,
  volumeRecoveryQuerySchema,
} from "./progress.schemas"

const progressRouter = Router()

progressRouter.get(
  "/volume-recovery",
  validated({ query: volumeRecoveryQuerySchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const weekStart = req.query.weekStart
      ? new Date(`${req.query.weekStart}T00:00:00.000Z`)
      : undefined
    sendData(res, await getVolumeRecoveryForTrainee(profile, weekStart))
  }),
)

progressRouter.get(
  "/recovery-history",
  validated({ query: recoveryHistoryQuerySchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await listRecoveryHistoryForTrainee(profile, req.query.days))
  }),
)

progressRouter.put(
  "/volume-recommendation",
  validated({ body: volumeRecommendationStatusSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await setVolumeRecommendationStatusForTrainee(profile, {
      muscleSlug: req.body.muscleSlug,
      status: req.body.status,
      weekStart: req.body.weekStart ? new Date(`${req.body.weekStart}T00:00:00.000Z`) : undefined,
    }))
  }),
)

progressRouter.put(
  "/volume-landmarks",
  validated({ body: volumeLandmarksSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await upsertVolumeLandmarksForTrainee(profile, req.body))
  }),
)

progressRouter.delete(
  "/volume-landmarks",
  validated({ body: volumeLandmarksResetSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    sendData(res, await resetVolumeLandmarksForTrainee(profile, req.body.muscleSlug))
  }),
)

progressRouter.put(
  "/recovery-check-in",
  validated({ body: recoveryCheckInSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const checkIn = await upsertRecoveryCheckInForTrainee(profile, {
      ...req.body,
      checkInDate: new Date(`${req.body.checkInDate}T00:00:00.000Z`),
    })
    sendData(res, checkIn)
  }),
)

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

progressRouter.get("/dashboard", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))

    const startDateStr = typeof req.query.startDate === "string" ? req.query.startDate.trim() : ""
    const endDateStr = typeof req.query.endDate === "string" ? req.query.endDate.trim() : ""

    if (!startDateStr || !endDateStr) {
      res.status(400).json({ error: "startDate and endDate are required (YYYY-MM-DD)." })
      return
    }

    // The client's calendar days: from its midnight on startDate to the last moment of endDate.
    const startDate = parseLocalDateInput(startDateStr)
    const endDayStart = parseLocalDateInput(endDateStr)

    if (!startDate || !endDayStart) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." })
      return
    }

    const endDate = new Date(addLocalDays(endDayStart, 1).getTime() - 1)

    if (startDate >= endDate) {
      res.status(400).json({ error: "startDate must be before endDate." })
      return
    }

    const data = await getDashboardAnalyticsForTrainee(profile.profile, startDate, endDate)
    res.json({ data })
  } catch (error) {
    sendError(res, error)
  }
})

progressRouter.get("/weight", async (req, res) => {
  try {
    const profile = await requireCurrentProfile(getAccessToken(req))
    const days = typeof req.query.days === "string" ? Number(req.query.days) : undefined
    const from = typeof req.query.from === "string" ? req.query.from : undefined
    const to = typeof req.query.to === "string" ? req.query.to : undefined
    const bodyMetrics = await listBodyMetricsForCurrentTrainee(profile.profile, {
      days: Number.isFinite(days) ? days : undefined,
      from,
      to,
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
