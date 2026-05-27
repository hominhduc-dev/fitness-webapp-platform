import { ApiError } from "@/lib/auth/api"
import { getApiBaseUrl } from "@/lib/supabase/config"

import type {
  AdminAuditLogItem,
  AdminCoachRequest,
  AdminConnectionsData,
  AdminDashboardData,
  AdminExerciseGroupDeleteResult,
  AdminExerciseItem,
  AdminExerciseImportResult,
  AdminExerciseImportRow,
  AdminMiniUser,
  AdminProgramSummary,
  AdminUserDetail,
  AdminUserListItem,
} from "./types"

type SerializedAdminMiniUser = AdminMiniUser

type SerializedAdminUserListItem = Omit<AdminUserListItem, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

type SerializedAdminCoachRequest = Omit<AdminCoachRequest, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

type SerializedAdminProgramSummary = Omit<AdminProgramSummary, "createdAt"> & {
  createdAt: string
}

type SerializedAdminExerciseItem = Omit<AdminExerciseItem, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

type SerializedAdminExerciseImportResult = AdminExerciseImportResult
type SerializedAdminExerciseGroupDeleteResult = AdminExerciseGroupDeleteResult

type SerializedAdminAuditLogItem = Omit<AdminAuditLogItem, "createdAt"> & {
  createdAt: string
}

type SerializedAdminUserDetail = Omit<AdminUserDetail, "assignedPrograms" | "coachRequests" | "createdPrograms" | "recentAuditLogs" | "recentWorkoutLogs" | "user"> & {
  assignedPrograms: SerializedAdminProgramSummary[]
  coachRequests: SerializedAdminCoachRequest[]
  createdPrograms: SerializedAdminProgramSummary[]
  recentAuditLogs: SerializedAdminAuditLogItem[]
  recentWorkoutLogs: Array<{
    completedAt?: string | null
    id: string
    startedAt: string
    totalVolume?: number
    workout: {
      id: string
      name: string
    } | null
  }>
  user: SerializedAdminUserListItem
}

type SerializedAdminConnectionsData = {
  coaches: SerializedAdminMiniUser[]
  connections: Array<{
    coach: SerializedAdminMiniUser
    trainee: SerializedAdminMiniUser
  }>
  unassignedTrainees: SerializedAdminMiniUser[]
}

type SerializedAdminDashboardData = Omit<AdminDashboardData, "charts" | "pendingCoachRequests" | "recentPrograms" | "recentUsers"> & {
  charts: {
    activeUsers: {
      monthly: Array<{ label: string; periodStart: string; value: number }>
      weekly: Array<{ label: string; periodStart: string; value: number }>
    }
    userGrowth: {
      monthly: Array<{ label: string; periodStart: string; value: number }>
      weekly: Array<{ label: string; periodStart: string; value: number }>
    }
    workoutLogs: {
      monthly: Array<{ label: string; periodStart: string; value: number }>
      weekly: Array<{ label: string; periodStart: string; value: number }>
    }
  }
  pendingCoachRequests: SerializedAdminCoachRequest[]
  recentPrograms: SerializedAdminProgramSummary[]
  recentUsers: SerializedAdminUserListItem[]
}

async function parseJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | { error?: string; message?: string } | null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && ("error" in payload || "message" in payload)
        ? payload.error ?? payload.message ?? "Request failed"
        : "Request failed"

    throw new ApiError(message, response.status)
  }

  return payload as T
}

async function request<T>(path: string, accessToken: string, init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }) {
  let response: Response

  const fetchOptions: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  }

  // Default GET requests to short revalidation; mutations stay uncached
  if (!fetchOptions.next?.revalidate && fetchOptions.cache === undefined) {
    const method = (fetchOptions.method ?? "GET").toUpperCase()
    if (method === "GET") {
      fetchOptions.next = { ...fetchOptions.next, revalidate: 30 }
    } else {
      fetchOptions.cache = "no-store"
    }
  }

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, fetchOptions)
  } catch {
    throw new ApiError("Unable to reach the API server. Make sure the backend is running.", 503)
  }

  return parseJson<T>(response)
}

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined
}

function mapAdminUserListItem(user: SerializedAdminUserListItem): AdminUserListItem {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  }
}

function mapAdminCoachRequest(requestItem: SerializedAdminCoachRequest): AdminCoachRequest {
  return {
    ...requestItem,
    createdAt: new Date(requestItem.createdAt),
    updatedAt: new Date(requestItem.updatedAt),
  }
}

function mapAdminProgramSummary(program: SerializedAdminProgramSummary): AdminProgramSummary {
  return {
    ...program,
    createdAt: new Date(program.createdAt),
  }
}

function mapAdminExerciseItem(exercise: SerializedAdminExerciseItem): AdminExerciseItem {
  return {
    ...exercise,
    createdAt: new Date(exercise.createdAt),
    updatedAt: new Date(exercise.updatedAt),
  }
}

function mapAdminAuditLogItem(log: SerializedAdminAuditLogItem): AdminAuditLogItem {
  return {
    ...log,
    createdAt: new Date(log.createdAt),
  }
}

function buildQuery(options?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams()

  Object.entries(options ?? {}).forEach(([key, value]) => {
    if (value?.trim()) {
      searchParams.set(key, value.trim())
    }
  })

  return searchParams.size > 0 ? `?${searchParams.toString()}` : ""
}

async function fetchAdminDashboard(accessToken: string): Promise<AdminDashboardData> {
  const response = await request<SerializedAdminDashboardData>("/api/admin/dashboard", accessToken)

  return {
    charts: {
      activeUsers: {
        monthly: response.charts.activeUsers.monthly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
        weekly: response.charts.activeUsers.weekly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
      },
      userGrowth: {
        monthly: response.charts.userGrowth.monthly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
        weekly: response.charts.userGrowth.weekly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
      },
      workoutLogs: {
        monthly: response.charts.workoutLogs.monthly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
        weekly: response.charts.workoutLogs.weekly.map((point) => ({
          ...point,
          periodStart: new Date(point.periodStart),
        })),
      },
    },
    pendingCoachRequests: response.pendingCoachRequests.map(mapAdminCoachRequest),
    recentPrograms: response.recentPrograms.map(mapAdminProgramSummary),
    recentUsers: response.recentUsers.map(mapAdminUserListItem),
    stats: response.stats,
    topCoaches: response.topCoaches,
  }
}

async function fetchAdminUsers(accessToken: string, options?: { role?: string; search?: string }) {
  const query = buildQuery({
    role: options?.role,
    search: options?.search,
  })
  const response = await request<{ users: SerializedAdminUserListItem[] }>(`/api/admin/users${query}`, accessToken)
  return response.users.map(mapAdminUserListItem)
}

async function fetchAdminUserDetail(accessToken: string, userId: string) {
  const response = await request<{ user: SerializedAdminUserDetail }>(`/api/admin/users/${userId}`, accessToken)

  return {
    assignedCoach: response.user.assignedCoach,
    assignedPrograms: response.user.assignedPrograms.map(mapAdminProgramSummary),
    coachRequests: response.user.coachRequests.map(mapAdminCoachRequest),
    connectedTrainees: response.user.connectedTrainees,
    createdPrograms: response.user.createdPrograms.map(mapAdminProgramSummary),
    recentAuditLogs: response.user.recentAuditLogs.map(mapAdminAuditLogItem),
    recentWorkoutLogs: response.user.recentWorkoutLogs.map((log) => ({
      ...log,
      completedAt: toDate(log.completedAt),
      startedAt: new Date(log.startedAt),
    })),
    user: mapAdminUserListItem(response.user.user),
  } satisfies AdminUserDetail
}

async function updateAdminUserRequest(
  accessToken: string,
  userId: string,
  input: {
    isActive?: boolean
    role?: string
  },
) {
  const response = await request<{ user: SerializedAdminUserListItem }>(`/api/admin/users/${userId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH",
  })

  return mapAdminUserListItem(response.user)
}

async function resetAdminUserPasswordRequest(accessToken: string, userId: string, password: string) {
  return request<{ success: boolean; userId: string }>(`/api/admin/users/${userId}/reset-password`, accessToken, {
    body: JSON.stringify({
      password,
    }),
    method: "POST",
  })
}

async function fetchAdminCoachRequests(accessToken: string, options?: { search?: string; status?: string }) {
  const query = buildQuery({
    search: options?.search,
    status: options?.status,
  })
  const response = await request<{ requests: SerializedAdminCoachRequest[] }>(`/api/admin/coach-requests${query}`, accessToken)
  return response.requests.map(mapAdminCoachRequest)
}

async function updateAdminCoachRequestStatus(accessToken: string, requestId: string, status: "approved" | "rejected") {
  const response = await request<{ request: SerializedAdminCoachRequest }>(
    `/api/admin/coach-requests/${requestId}`,
    accessToken,
    {
      body: JSON.stringify({
        status,
      }),
      method: "PATCH",
    },
  )

  return mapAdminCoachRequest(response.request)
}

async function deleteAdminCoachRequestRequest(accessToken: string, requestId: string) {
  return request<{ deleted: boolean; id: string }>(`/api/admin/coach-requests/${requestId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchAdminConnections(accessToken: string, options?: { search?: string }): Promise<AdminConnectionsData> {
  const query = buildQuery({
    search: options?.search,
  })
  const response = await request<SerializedAdminConnectionsData>(`/api/admin/connections${query}`, accessToken)

  return {
    coaches: response.coaches,
    connections: response.connections,
    unassignedTrainees: response.unassignedTrainees,
  }
}

async function assignAdminCoachConnection(accessToken: string, input: { coachId: string; traineeId: string }) {
  return request<{ coach: AdminMiniUser; trainee: AdminMiniUser }>(`/api/admin/connections`, accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })
}

async function removeAdminCoachConnection(accessToken: string, traineeId: string) {
  return request<{ removed: boolean; traineeId: string }>(`/api/admin/connections/${traineeId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchAdminPrograms(accessToken: string, options?: { search?: string }) {
  const query = buildQuery({
    search: options?.search,
  })
  const response = await request<{ programs: SerializedAdminProgramSummary[] }>(`/api/admin/programs${query}`, accessToken)
  return response.programs.map(mapAdminProgramSummary)
}

async function deleteAdminProgramRequest(accessToken: string, programId: string) {
  return request<{ deleted: boolean; id: string }>(`/api/admin/programs/${programId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchAdminExercises(accessToken: string, options?: { search?: string }) {
  const query = buildQuery({
    search: options?.search,
  })
  const response = await request<{ exercises: SerializedAdminExerciseItem[] }>(`/api/admin/exercises${query}`, accessToken)
  return response.exercises.map(mapAdminExerciseItem)
}

async function createAdminExerciseRequest(
  accessToken: string,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
    variationName?: string
  },
) {
  const response = await request<{ exercise: SerializedAdminExerciseItem }>(`/api/admin/exercises`, accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })
  return mapAdminExerciseItem(response.exercise)
}

async function updateAdminExerciseRequest(
  accessToken: string,
  exerciseId: string,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
    variationName?: string
  },
) {
  const response = await request<{ exercise: SerializedAdminExerciseItem }>(
    `/api/admin/exercises/${exerciseId}`,
    accessToken,
    {
      body: JSON.stringify(input),
      method: "PATCH",
    },
  )
  return mapAdminExerciseItem(response.exercise)
}

async function deleteAdminExerciseRequest(accessToken: string, exerciseId: string) {
  return request<{ deleted: boolean; id: string }>(`/api/admin/exercises/${exerciseId}`, accessToken, {
    method: "DELETE",
  })
}

async function deleteAdminExerciseGroupRequest(accessToken: string, muscleGroup: string) {
  return request<SerializedAdminExerciseGroupDeleteResult>(`/api/admin/exercise-groups`, accessToken, {
    body: JSON.stringify({
      muscleGroup,
    }),
    method: "DELETE",
  })
}

async function importAdminExercisesRequest(accessToken: string, rows: AdminExerciseImportRow[]) {
  const response = await request<{ result: SerializedAdminExerciseImportResult }>(
    `/api/admin/exercises/import`,
    accessToken,
    {
      body: JSON.stringify({
        rows,
      }),
      method: "POST",
    },
  )

  return response.result
}

async function fetchAdminAuditLogs(accessToken: string, options?: { entityType?: string; search?: string }) {
  const query = buildQuery({
    entityType: options?.entityType,
    search: options?.search,
  })
  const response = await request<{ logs: SerializedAdminAuditLogItem[] }>(`/api/admin/audit-logs${query}`, accessToken)
  return response.logs.map(mapAdminAuditLogItem)
}

export {
  assignAdminCoachConnection,
  createAdminExerciseRequest,
  deleteAdminCoachRequestRequest,
  deleteAdminExerciseRequest,
  deleteAdminExerciseGroupRequest,
  deleteAdminProgramRequest,
  fetchAdminAuditLogs,
  fetchAdminCoachRequests,
  fetchAdminConnections,
  fetchAdminDashboard,
  fetchAdminExercises,
  fetchAdminPrograms,
  fetchAdminUserDetail,
  fetchAdminUsers,
  importAdminExercisesRequest,
  removeAdminCoachConnection,
  resetAdminUserPasswordRequest,
  updateAdminCoachRequestStatus,
  updateAdminExerciseRequest,
  updateAdminUserRequest,
}
