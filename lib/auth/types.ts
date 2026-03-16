export type AppRole = "trainee" | "coach" | "admin"

export interface AppProfile {
  avatar?: string | null
  coachId?: string | null
  createdAt: string
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  phone?: string | null
  role: AppRole
  supabaseAuthUserId?: string | null
  updatedAt: string
  username?: string | null
}

export interface AuthenticatedUserPayload {
  email: string | null
  id: string
}

export interface AuthSessionPayload {
  accessToken: string
  expiresAt: number | null
  expiresIn: number | null
  refreshToken: string
  tokenType: string
}

export interface AuthResponse {
  message?: string
  profile: AppProfile | null
  requiresEmailConfirmation?: boolean
  session: AuthSessionPayload | null
  user: AuthenticatedUserPayload | null
}

export interface UpdateProfileInput {
  avatar?: string | null
  fitnessGoals?: string[]
  name?: string | null
}
