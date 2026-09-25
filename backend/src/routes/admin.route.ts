import { CoachRequestStatus, ExerciseImportRequestStatus, UserRole } from "@prisma/client"
import { Router } from "express"
import {
  EXERCISE_ACTIVITY_TYPES,
  MUSCLE_SLUGS,
  parseMuscleListValue,
  parseMuscleProfileInput,
} from "../domain/muscle-profile"

import { AuthServiceError, requireCurrentProfile } from "../services/auth.service"
import {
  applyExerciseSync,
  assignAdminCoachToTrainee,
  bulkDeleteAdminExercises,
  createAdminExercise,
  createAdminExerciseMediaUpload,
  approveAdminMuscleProfiles,
  deleteAdminCoachRequest,
  deleteAdminExercise,
  deleteAdminExerciseGroup,
  deleteAdminProgram,
  getAdminDashboard,
  getAdminUserDetail,
  importAdminExercises,
  listAdminAuditLogs,
  listAdminCoachRequests,
  listAdminCoachSignups,
  listAdminConnections,
  listAdminExercises,
  listAdminCustomFoods,
  listAdminExerciseImportRequests,
  listAdminPrograms,
  listAdminUsers,
  previewExerciseSync,
  removeAdminCoachFromTrainee,
  removeAdminExerciseMedia,
  resetAdminUserPassword,
  reviewAdminCoachSignup,
  reviewAdminCustomFood,
  reviewExerciseImportRequest,
  saveAdminExerciseMedia,
  transferAdminExerciseMetadata,
  undoAdminExerciseMetadataTransfer,
  updateAdminCoachRequest,
  updateAdminCustomFood,
  updateAdminExercise,
  updateAdminUser,
} from "../services/admin.service"
import { invalidateExerciseLibrary } from "../lib/library-cache"
import { validated } from "../middleware/validate"
import {
  coachSignupParams,
  coachSignupQuery,
  customFoodParams,
  customFoodQuery,
  exerciseIdParams,
  exerciseMediaUploadSchema,
  metadataTransferParams,
  reviewCoachSignupSchema,
  reviewCustomFoodSchema,
  saveExerciseMediaSchema,
  transferExerciseMetadataSchema,
} from "./admin.schemas"
import { getAccessToken, sendError } from "./route.utils"

const adminRouter = Router()

// The exercise library is cached for minutes, not seconds, so every admin
// write clears it rather than each of the many admin exercise paths having to
// remember to. Reloading costs one query on the next read; a missed
// invalidation would show stale exercises until the TTL ran out.
adminRouter.use((req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) invalidateExerciseLibrary()
    })
  }
  next()
})

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function parseExerciseImportRows(body: Record<string, unknown>) {
  return Array.isArray(body.rows)
    ? body.rows.map((row: unknown) => {
        const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {}

        return {
          activityType: getOptionalString(source.activityType),
          exerciseName: getOptionalString(source.exerciseName) ?? getOptionalString(source.name),
          equipment: getOptionalString(source.equipment),
          isDefault: typeof source.isDefault === "boolean" ? source.isDefault : undefined,
          muscleGroup: getOptionalString(source.muscleGroup),
          primaryMuscles: parseMuscleListValue(source.primaryMuscles),
          rowNumber: typeof source.rowNumber === "number" ? source.rowNumber : undefined,
          sortOrder: typeof source.sortOrder === "number" ? source.sortOrder : undefined,
          secondaryMuscles: parseMuscleListValue(source.secondaryMuscles),
          variationName: getOptionalString(source.variationName),
        }
      })
    : []
}

function parseRole(value: unknown) {
  return value === UserRole.admin || value === UserRole.coach || value === UserRole.trainee ? value : undefined
}

function parseCoachRequestStatus(value: unknown) {
  return value === CoachRequestStatus.pending ||
    value === CoachRequestStatus.approved ||
    value === CoachRequestStatus.rejected
    ? value
    : undefined
}

adminRouter.get("/dashboard", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const dashboard = await getAdminDashboard(profile)

    res.json(dashboard)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/users", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const users = await listAdminUsers(profile, {
      role: parseRole(req.query.role) ?? (req.query.role === "all" ? "all" : undefined),
      search: getOptionalString(req.query.search),
    })

    res.json({
      users,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/users/:userId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const user = await getAdminUserDetail(profile, String(req.params.userId))

    res.json({
      user,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.patch("/users/:userId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const user = await updateAdminUser(profile, String(req.params.userId), {
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : undefined,
      role: parseRole(req.body.role),
    })

    res.json({
      user,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/users/:userId/reset-password", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await resetAdminUserPassword(profile, String(req.params.userId), String(req.body.password ?? ""))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get(
  "/coach-signups",
  validated({ query: coachSignupQuery }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const signups = await listAdminCoachSignups(profile, {
      search: req.query.search,
      status: req.query.status,
    })

    res.json({ signups })
  }),
)

adminRouter.patch(
  "/coach-signups/:userId",
  validated({ body: reviewCoachSignupSchema, params: coachSignupParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const user = await reviewAdminCoachSignup(profile, req.params.userId, req.body.decision)

    res.json({ user })
  }),
)

adminRouter.get(
  "/foods",
  validated({ query: customFoodQuery }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const foods = await listAdminCustomFoods(profile, req.query)

    res.json({ foods })
  }),
)

// The body is validated by `parseFoodDetails`, the same rules a trainee's food goes through.
adminRouter.patch(
  "/foods/:foodId",
  validated({ params: customFoodParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const food = await updateAdminCustomFood(profile, req.params.foodId, (req.body ?? {}) as Record<string, unknown>)

    res.json({ food })
  }),
)

adminRouter.patch(
  "/foods/:foodId/review",
  validated({ body: reviewCustomFoodSchema, params: customFoodParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const food = await reviewAdminCustomFood(profile, req.params.foodId, req.body)

    res.json({ food })
  }),
)

adminRouter.get("/coach-requests", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const requests = await listAdminCoachRequests(profile, {
      search: getOptionalString(req.query.search),
      status: parseCoachRequestStatus(req.query.status) ?? (req.query.status === "all" ? "all" : undefined),
    })

    res.json({
      requests,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.patch("/coach-requests/:requestId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const status = parseCoachRequestStatus(req.body.status)

    if (!status || status === CoachRequestStatus.pending) {
      throw new AuthServiceError("Trạng thái coach request không hợp lệ.", 400)
    }

    const request = await updateAdminCoachRequest(profile, String(req.params.requestId), status)

    res.json({
      request,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.delete("/coach-requests/:requestId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteAdminCoachRequest(profile, String(req.params.requestId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/connections", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await listAdminConnections(profile, {
      search: getOptionalString(req.query.search),
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/connections", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await assignAdminCoachToTrainee(profile, {
      coachId: String(req.body.coachId ?? ""),
      traineeId: String(req.body.traineeId ?? ""),
    })

    res.status(201).json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.delete("/connections/:traineeId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await removeAdminCoachFromTrainee(profile, String(req.params.traineeId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/programs", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const programs = await listAdminPrograms(profile, {
      search: getOptionalString(req.query.search),
    })

    res.json({
      programs,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.delete("/programs/:programId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteAdminProgram(profile, String(req.params.programId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/exercises", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const muscle = getOptionalString(req.query.muscle)?.toLowerCase()
    const exercises = await listAdminExercises(profile, {
      activityType: EXERCISE_ACTIVITY_TYPES.includes(req.query.activityType as (typeof EXERCISE_ACTIVITY_TYPES)[number])
        ? (req.query.activityType as (typeof EXERCISE_ACTIVITY_TYPES)[number])
        : undefined,
      equipment: getOptionalString(req.query.equipment),
      muscle: muscle && MUSCLE_SLUGS.includes(muscle as (typeof MUSCLE_SLUGS)[number])
        ? (muscle as (typeof MUSCLE_SLUGS)[number])
        : undefined,
      muscleGroup: getOptionalString(req.query.muscleGroup),
      profileStatus:
        req.query.profileStatus === "approved" || req.query.profileStatus === "pending"
          ? req.query.profileStatus
          : undefined,
      search: getOptionalString(req.query.search),
    })

    res.json({
      exercises,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/exercises", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const exercise = await createAdminExercise(profile, {
      equipment: getOptionalString(req.body.equipment),
      muscleGroup: String(req.body.muscleGroup ?? ""),
      muscleProfile: parseMuscleProfileInput(req.body),
      name: String(req.body.name ?? ""),
      variationName: getOptionalString(req.body.variationName),
    })

    res.status(201).json({
      exercise,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post(
  "/exercises/metadata-transfer",
  validated({ body: transferExerciseMetadataSchema }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const { exercise, transferId } = await transferAdminExerciseMetadata(profile, req.body)
    res.json({ exercise, transferId })
  }),
)

adminRouter.post(
  "/exercises/metadata-transfer/:transferId/undo",
  validated({ params: metadataTransferParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const exercise = await undoAdminExerciseMetadataTransfer(profile, req.params.transferId)
    res.json({ exercise })
  }),
)

adminRouter.post("/exercises/muscle-profiles/bulk-approve", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const variationIds = Array.isArray(req.body.variationIds) ? req.body.variationIds.map(String) : []
    const result = await approveAdminMuscleProfiles(profile, variationIds)
    res.json({ result })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/exercises/import", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const rows = parseExerciseImportRows(req.body)
    const result = await importAdminExercises(profile, rows)

    res.status(201).json({
      result,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/exercise-import-requests", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const status = Object.values(ExerciseImportRequestStatus).includes(req.query.status as ExerciseImportRequestStatus)
      ? (req.query.status as ExerciseImportRequestStatus)
      : undefined
    const requests = await listAdminExerciseImportRequests(profile, { status })

    res.json({
      requests,
    })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.patch("/exercise-import-requests/:requestId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const status = req.body.status === "approved" ? "approved" : req.body.status === "rejected" ? "rejected" : null

    if (!status) {
      throw new AuthServiceError("Trạng thái duyệt import không hợp lệ.", 400)
    }

    const result = await reviewExerciseImportRequest(profile, String(req.params.requestId), {
      reviewNote: getOptionalString(req.body.reviewNote),
      status,
    })

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.patch("/exercises/:exerciseId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const exercise = await updateAdminExercise(profile, String(req.params.exerciseId), {
      equipment: getOptionalString(req.body.equipment),
      muscleGroup: String(req.body.muscleGroup ?? ""),
      muscleProfile: parseMuscleProfileInput(req.body),
      name: String(req.body.name ?? ""),
      variationName: getOptionalString(req.body.variationName),
    })

    res.json({
      exercise,
    })
  } catch (error) {
    sendError(res, error)
  }
})

// Media files go from the browser straight to Cloudinary through signed upload
// params, so large animations never pass through the API's JSON body limit. The
// save call then verifies each uploaded asset before pointing the variation at it.
adminRouter.post(
  "/exercises/:exerciseId/media/upload-url",
  validated({ body: exerciseMediaUploadSchema, params: exerciseIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.status(201).json({ upload: await createAdminExerciseMediaUpload(profile, req.params.exerciseId, req.body) })
  }),
)

adminRouter.put(
  "/exercises/:exerciseId/media",
  validated({ body: saveExerciseMediaSchema, params: exerciseIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ exercise: await saveAdminExerciseMedia(profile, req.params.exerciseId, req.body) })
  }),
)

adminRouter.delete(
  "/exercises/:exerciseId/media",
  validated({ params: exerciseIdParams }, async (req, res) => {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    res.json({ exercise: await removeAdminExerciseMedia(profile, req.params.exerciseId) })
  }),
)

adminRouter.post("/exercises/sync-preview", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map((row: Record<string, unknown>) => ({
          id: getOptionalString(row.id),
          exerciseName: getOptionalString(row.exerciseName) ?? getOptionalString(row.name),
          equipment: getOptionalString(row.equipment),
          muscleGroup: getOptionalString(row.muscleGroup),
          activityType: getOptionalString(row.activityType),
          primaryMuscles: parseMuscleListValue(row.primaryMuscles),
          secondaryMuscles: parseMuscleListValue(row.secondaryMuscles),
          variationName: getOptionalString(row.variationName),
        }))
      : []
    const preview = await previewExerciseSync(profile, rows)
    res.json({ data: preview })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/exercises/sync-apply", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map((row: Record<string, unknown>) => ({
          id: getOptionalString(row.id),
          exerciseName: getOptionalString(row.exerciseName) ?? getOptionalString(row.name),
          equipment: getOptionalString(row.equipment),
          muscleGroup: getOptionalString(row.muscleGroup),
          activityType: getOptionalString(row.activityType),
          primaryMuscles: parseMuscleListValue(row.primaryMuscles),
          secondaryMuscles: parseMuscleListValue(row.secondaryMuscles),
          variationName: getOptionalString(row.variationName),
        }))
      : []
    const result = await applyExerciseSync(profile, rows)
    res.json({ data: result })
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.post("/exercises/bulk-delete", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((id: unknown) => typeof id === "string") : []
    const result = await bulkDeleteAdminExercises(profile, ids)
    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.delete("/exercises/:exerciseId", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteAdminExercise(profile, String(req.params.exerciseId))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.delete("/exercise-groups", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const result = await deleteAdminExerciseGroup(profile, String(req.body.muscleGroup ?? ""))

    res.json(result)
  } catch (error) {
    sendError(res, error)
  }
})

adminRouter.get("/audit-logs", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const logs = await listAdminAuditLogs(profile, {
      entityType: getOptionalString(req.query.entityType),
      search: getOptionalString(req.query.search),
    })

    res.json({
      logs,
    })
  } catch (error) {
    sendError(res, error)
  }
})

export { adminRouter }
