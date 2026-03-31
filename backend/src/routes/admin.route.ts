import { CoachRequestStatus, UserRole } from "@prisma/client"
import { Router } from "express"

import { AuthServiceError, requireCurrentProfile } from "../services/auth.service"
import {
  assignAdminCoachToTrainee,
  createAdminExercise,
  deleteAdminCoachRequest,
  deleteAdminExercise,
  deleteAdminExerciseGroup,
  deleteAdminProgram,
  getAdminDashboard,
  getAdminUserDetail,
  importAdminExercises,
  listAdminAuditLogs,
  listAdminCoachRequests,
  listAdminConnections,
  listAdminExercises,
  listAdminPrograms,
  listAdminUsers,
  removeAdminCoachFromTrainee,
  resetAdminUserPassword,
  updateAdminCoachRequest,
  updateAdminExercise,
  updateAdminUser,
} from "../services/admin.service"
import { getAccessToken, sendError } from "./route.utils"

const adminRouter = Router()

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined
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
    const exercises = await listAdminExercises(profile, {
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

adminRouter.post("/exercises/import", async (req, res) => {
  try {
    const { profile } = await requireCurrentProfile(getAccessToken(req))
    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map((row: unknown) => {
          const source = row && typeof row === "object" ? (row as Record<string, unknown>) : {}

          return {
            exerciseName: getOptionalString(source.exerciseName) ?? getOptionalString(source.name),
            equipment: getOptionalString(source.equipment),
            isDefault: typeof source.isDefault === "boolean" ? source.isDefault : undefined,
            muscleGroup: getOptionalString(source.muscleGroup),
            rowNumber: typeof source.rowNumber === "number" ? source.rowNumber : undefined,
            sortOrder: typeof source.sortOrder === "number" ? source.sortOrder : undefined,
            variationName: getOptionalString(source.variationName),
          }
        })
      : []
    const result = await importAdminExercises(profile, rows)

    res.status(201).json({
      result,
    })
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
