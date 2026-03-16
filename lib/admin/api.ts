import { ApiError } from "@/lib/auth/api"
import { getApiBaseUrl } from "@/lib/supabase/config"

import type {
  AdminCoachOverview,
  AdminDashboardData,
  AdminPendingCoachRequest,
  AdminRecentProgram,
  AdminRecentUser,
} from "./types"

type SerializedAdminDashboardStats = AdminDashboardData["stats"]

type SerializedAdminRecentUser = Omit<AdminRecentUser, "createdAt"> & {
  createdAt: string
}

type SerializedAdminPendingCoachRequest = Omit<AdminPendingCoachRequest, "createdAt"> & {
  createdAt: string
}

type SerializedAdminRecentProgram = Omit<AdminRecentProgram, "createdAt"> & {
  createdAt: string
}

type SerializedAdminDashboardData = {
  pendingCoachRequests: SerializedAdminPendingCoachRequest[]
  recentPrograms: SerializedAdminRecentProgram[]
  recentUsers: SerializedAdminRecentUser[]
  stats: SerializedAdminDashboardStats
  topCoaches: AdminCoachOverview[]
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

async function request<T>(path: string, accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  return parseJson<T>(response)
}

async function fetchAdminDashboard(accessToken: string): Promise<AdminDashboardData> {
  const response = await request<SerializedAdminDashboardData>("/api/admin/dashboard", accessToken)

  return {
    pendingCoachRequests: response.pendingCoachRequests.map((requestItem) => ({
      ...requestItem,
      createdAt: new Date(requestItem.createdAt),
    })),
    recentPrograms: response.recentPrograms.map((program) => ({
      ...program,
      createdAt: new Date(program.createdAt),
    })),
    recentUsers: response.recentUsers.map((user) => ({
      ...user,
      createdAt: new Date(user.createdAt),
    })),
    stats: response.stats,
    topCoaches: response.topCoaches,
  }
}

export { fetchAdminDashboard }
