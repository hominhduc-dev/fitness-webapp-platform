import { ApiError } from "@/lib/auth/api"
import { getApiBaseUrl } from "@/lib/supabase/config"

export type FeedbackCategory = "bug" | "suggestion"
export type FeedbackStatus = "new" | "in_progress" | "resolved"
export type FeedbackItem = {
  id: string
  category: FeedbackCategory
  message: string
  pagePath: string | null
  appVersion: string | null
  status: FeedbackStatus
  createdAt: string
  updatedAt: string
  reporter?: { id: string; name: string; email: string; role: string }
}
export type FeedbackDetail = FeedbackItem & { screenshot: string | null; userAgent: string | null }
export type FeedbackList = { items: FeedbackItem[]; total: number; page: number; limit: number }
export type FeedbackInput = { category: FeedbackCategory; message: string; pagePath: string; appVersion?: string; screenshot?: string }

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}/api/feedback${path}`, {
      ...init,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
  } catch {
    throw new ApiError("Unable to reach the server", 503, { isNetworkError: true })
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(payload?.error?.message ?? "Request failed", response.status)
  return payload.data as T
}

export function createFeedback(token: string, input: FeedbackInput) {
  return request<FeedbackItem>(token, "", { method: "POST", body: JSON.stringify(input) })
}
export function listFeedback(token: string, options: { admin?: boolean; status?: FeedbackStatus; category?: FeedbackCategory; page?: number }) {
  const params = new URLSearchParams({ page: String(options.page ?? 1), limit: "10" })
  if (options.status) params.set("status", options.status)
  if (options.category) params.set("category", options.category)
  return request<FeedbackList>(token, `${options.admin ? "" : "/mine"}?${params}`)
}
export function getFeedback(token: string, id: string) {
  return request<FeedbackDetail>(token, `/${encodeURIComponent(id)}`)
}
export function updateFeedback(token: string, item: FeedbackItem, status: FeedbackStatus) {
  return request<FeedbackItem>(token, `/${encodeURIComponent(item.id)}`, {
    method: "PATCH", body: JSON.stringify({ status, expectedUpdatedAt: item.updatedAt }),
  })
}
