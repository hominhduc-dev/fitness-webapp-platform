export type AppRole = "trainee" | "coach" | "admin"

export type AppSex = "male" | "female"

export type AppActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active"

export type AppDietType = "vegetarian" | "pescatarian"

export interface AppProfile {
  activityLevel?: AppActivityLevel | null
  avatar?: string | null
  birthDate?: string | null
  coachId?: string | null
  createdAt: string
  dailyCalorieGoal: number
  dietType?: AppDietType | null
  email: string
  fitnessGoals: string[]
  foodAllergies?: string[]
  goalStartWeightKg?: number | null
  heightCm?: number | null
  id: string
  isActive: boolean
  name: string
  phone?: string | null
  preferredWeightUnit: "kg" | "lbs"
  role: AppRole
  sex?: AppSex | null
  supabaseAuthUserId?: string | null
  targetWeightKg?: number | null
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

export interface UploadAvatarInput {
  dataUrl: string
  fileName?: string | null
}

export interface UpdateProfileInput {
  activityLevel?: AppActivityLevel | null
  avatar?: string | null
  birthDate?: string | null
  dailyCalorieGoal?: number | null
  dietType?: AppDietType | null
  fitnessGoals?: string[]
  foodAllergies?: string[]
  heightCm?: number | null
  name?: string | null
  phone?: string | null
  preferredWeightUnit?: "kg" | "lbs"
  sex?: AppSex | null
  targetWeightKg?: number | null
}
