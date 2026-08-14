import { Router } from "express"

import { heavyLimiter } from "../middleware/rate-limit"
import { asyncHandler, validated } from "../middleware/validate"
import { requireCurrentProfile } from "../services/auth.service"
import {
  createPersonalWorkoutForTrainee,
  createWorkoutLogForTrainee,
  deletePersonalWorkoutForTrainee,
  deleteWorkoutLogForTrainee,
  exportWorkoutLogsToGoogleSheetsForTrainee,
  getTraineeProgramDetail,
  getWorkoutDetailForTrainee,
  listWorkoutLogsForExportTrainee,
  listWorkoutsForTrainee,
  swapExerciseForTraineeFromWorkout,
  updatePersonalWorkoutForTrainee,
} from "../services/fitness-data.service"
import { getAccessToken } from "./route.utils"
import {
  createWorkoutLogSchema,
  exportLogsSchema,
  logParams,
  logRangeQuery,
  personalWorkoutSchema,
  programIdParams,
  swapExerciseSchema,
  swapParams,
  workoutIdParams,
} from "./workout.schemas"

const workoutRouter = Router()

type WorkoutLogInput = Parameters<typeof createWorkoutLogForTrainee>[2]

workoutRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json(await listWorkoutsForTrainee(profile))
  }),
)

workoutRouter.get(
  "/programs/:programId",
  validated({ params: programIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ program: await getTraineeProgramDetail(profile, req.params.programId) })
  }),
)

workoutRouter.get(
  "/logs",
  validated({ query: logRangeQuery }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ data: await listWorkoutLogsForExportTrainee(profile, req.query) })
  }),
)

workoutRouter.post(
  "/logs/export/google-sheets",
  heavyLimiter,
  validated({ body: exportLogsSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await exportWorkoutLogsToGoogleSheetsForTrainee(profile, req.body)

    res.json({ data: result, error: null, meta: null })
  }),
)

workoutRouter.get(
  "/:workoutId",
  validated({ params: workoutIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ workout: await getWorkoutDetailForTrainee(profile, req.params.workoutId) })
  }),
)

workoutRouter.post(
  "/",
  validated({ body: personalWorkoutSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.status(201).json({ workout: await createPersonalWorkoutForTrainee(profile, req.body) })
  }),
)

workoutRouter.patch(
  "/:workoutId",
  validated({ body: personalWorkoutSchema, params: workoutIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ workout: await updatePersonalWorkoutForTrainee(profile, req.params.workoutId, req.body) })
  }),
)

workoutRouter.post(
  "/:workoutId/logs",
  validated({ body: createWorkoutLogSchema, params: workoutIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const log = await createWorkoutLogForTrainee(profile, req.params.workoutId, req.body as WorkoutLogInput)

    res.status(201).json({ log })
  }),
)

workoutRouter.post(
  "/:workoutId/exercises/:workoutExerciseId/swap",
  validated({ body: swapExerciseSchema, params: swapParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await swapExerciseForTraineeFromWorkout(profile, {
      newVariationId: req.body.variationId,
      workoutExerciseId: req.params.workoutExerciseId,
      workoutId: req.params.workoutId,
    })

    res.json(result)
  }),
)

workoutRouter.delete(
  "/:workoutId/logs/:logId",
  validated({ params: logParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json(await deleteWorkoutLogForTrainee(profile, req.params.workoutId, req.params.logId))
  }),
)

workoutRouter.delete(
  "/:workoutId",
  validated({ params: workoutIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json(await deletePersonalWorkoutForTrainee(profile, req.params.workoutId))
  }),
)

export { workoutRouter }
