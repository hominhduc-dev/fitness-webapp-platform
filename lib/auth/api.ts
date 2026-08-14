import type { AppRole, AuthResponse, UpdateProfileInput, UploadAvatarInput } from "./types"
import { getApiBaseUrl } from "@/lib/supabase/config"

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type ErrorPayload = {
  error?: string | { message?: string } | null
  message?: string
}

/**
 * The API returns two error shapes: a flat `{ error: "…" }` from the legacy auth
 * handlers and the `{ error: { code, message } }` envelope produced by the central
 * error middleware. Both resolve to a display string here.
 */
function readErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Request failed"
  }

  const { error, message } = payload as ErrorPayload

  if (typeof error === "string" && error) {
    return error
  }

  if (error && typeof error === "object" && typeof error.message === "string" && error.message) {
    return error.message
  }

  return message || "Request failed"
}

async function parseJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | ErrorPayload | null

  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload), response.status)
  }

  return payload as T
}

async function request<T>(path: string, init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }) {
  let response: Response

  const fetchOptions: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    ...init,
  }

  // Only force no-store when the caller hasn't specified any caching strategy
  if (!fetchOptions.next?.revalidate && fetchOptions.cache === undefined) {
    fetchOptions.cache = "no-store"
  }

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, fetchOptions)
  } catch {
    throw new ApiError("Unable to reach the API server. Make sure the backend is running.", 503)
  }

  return parseJson<T>(response)
}

function createHeaders(accessToken?: string) {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    "Content-Type": "application/json",
  }
}

async function loginRequest(input: { identifier: string; password: string }) {
  return request<AuthResponse>("/api/auth/login", {
    body: JSON.stringify(input),
    headers: createHeaders(),
    method: "POST",
  })
}

async function registerRequest(input: {
  email: string
  name: string
  password: string
  phone: string
  redirectTo?: string
  role?: Exclude<AppRole, "admin">
  username: string
}) {
  return request<AuthResponse>("/api/auth/register", {
    body: JSON.stringify(input),
    headers: createHeaders(),
    method: "POST",
  })
}

async function refreshSessionRequest(input: { accessToken?: string; refreshToken: string }) {
  return request<AuthResponse>("/api/auth/refresh", {
    body: JSON.stringify(input),
    headers: createHeaders(),
    method: "POST",
  })
}

async function forgotPasswordRequest(input: { identifier: string; redirectTo?: string }) {
  return request<AuthResponse>("/api/auth/forgot-password", {
    body: JSON.stringify(input),
    headers: createHeaders(),
    method: "POST",
  })
}

async function fetchCurrentProfile(accessToken: string) {
  const response = await request<AuthResponse>("/api/auth/me", {
    headers: createHeaders(accessToken),
    method: "GET",
    next: { revalidate: 30 },
  })

  return response.profile
}

async function updateProfileRequest(accessToken: string, input: UpdateProfileInput) {
  return request<AuthResponse>("/api/auth/me", {
    body: JSON.stringify(input),
    headers: createHeaders(accessToken),
    method: "PATCH",
  })
}

async function uploadAvatarRequest(accessToken: string, input: UploadAvatarInput) {
  return request<AuthResponse>("/api/auth/me/avatar", {
    body: JSON.stringify(input),
    headers: createHeaders(accessToken),
    method: "POST",
  })
}

async function resetCurrentTraineeDataRequest(accessToken: string) {
  return request<{ message: string; resetCounts: Record<string, number> }>("/api/auth/me/reset-trainee-data", {
    headers: createHeaders(accessToken),
    method: "POST",
  })
}

export {
  ApiError,
  fetchCurrentProfile,
  forgotPasswordRequest,
  loginRequest,
  resetCurrentTraineeDataRequest,
  refreshSessionRequest,
  registerRequest,
  uploadAvatarRequest,
  updateProfileRequest,
}
