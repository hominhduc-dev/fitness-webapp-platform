export type AppRole = "trainee" | "coach" | "admin"

export interface AppProfile {
  avatar?: string | null
  coachId?: string | null
  createdAt: string
  dailyCalorieGoal: number
  email: string
  fitnessGoals: string[]
  heightCm?: number | null
  id: string
  isActive: boolean
  name: string
  phone?: string | null
  preferredWeightUnit: "kg" | "lbs"
  role: AppRole
  supabaseAuthUserId?: string | null
  targetWeightKg?: number | null
  updatedAt: string
  username?: string | null
  webhookUrl?: string | null
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

export interface UploadAvatarInput {
  dataUrl: string
  fileName?: string | null
}

export interface UpdateProfileInput {
  avatar?: string | null
  dailyCalorieGoal?: number | null
  fitnessGoals?: string[]
  heightCm?: number | null
  name?: string | null
  phone?: string | null
  preferredWeightUnit?: "kg" | "lbs"
  targetWeightKg?: number | null
  webhookUrl?: string | null
}
