import type { ExerciseActivityType, ExerciseMedia, ExerciseMuscleProfile, MuscleProfileSource, MuscleProfileStatus, MuscleSlug, UserRole } from "@/lib/types"
import type { CoachApprovalStatus } from "@/lib/auth/types"

type AdminMiniUser = {
  avatar?: string
  email: string
  id: string
  isActive: boolean
  name: string
  phone?: string
  role: UserRole
}

type AdminUserStats = {
  assignedPrograms: number
  createdPrograms: number
  meals: number
  trainees: number
  workoutLogs: number
}

type AdminUserListItem = {
  coach: AdminMiniUser | null
  /** Coach accounts only: where a self-signup stands with the admin queue. */
  coachApprovalStatus?: CoachApprovalStatus | null
  coachId?: string | null
  createdAt: Date
  dailyCalorieGoal: number
  email: string
  fitnessGoals: string[]
  id: string
  isActive: boolean
  name: string
  phone?: string
  preferredWeightUnit: "kg" | "lbs"
  role: UserRole
  stats: AdminUserStats
  updatedAt: Date
  username?: string
}

type AdminCoachRequest = {
  coach: AdminMiniUser
  coachId: string
  createdAt: Date
  id: string
  status: "pending" | "approved" | "rejected"
  trainee: AdminMiniUser
  traineeId: string
  updatedAt: Date
}

type AdminProgramSummary = {
  assignmentCount: number
  createdAt: Date
  createdBy: AdminMiniUser
  description?: string
  difficulty: "beginner" | "intermediate" | "advanced"
  duration: number
  id: string
  name: string
  workoutsPerWeek: number
}

type AdminExerciseMediaKind = "thumbnail" | "animation"

/** Files an admin picked for a variation; a missing side keeps the current media. */
type AdminExerciseMediaFiles = Partial<Record<AdminExerciseMediaKind, File>>

/** A one-time grant to upload one media file straight to Cloudinary. */
type AdminExerciseMediaUpload = {
  apiKey: string
  cloudName: string
  contentType: string
  kind: AdminExerciseMediaKind
  publicId: string
  resourceType: "image" | "video"
  signature: string
  timestamp: number
  uploadUrl: string
}

type AdminExerciseMediaUploadedAsset = {
  cloudName: string
  contentType: string
  publicId: string
  resourceType: "image" | "video"
  secureUrl: string
  version: number
}

type AdminExerciseItem = ExerciseMuscleProfile & {
  createdAt: Date
  createdBy: AdminMiniUser | null
  equipment?: string
  id: string
  isDefault: boolean
  media?: ExerciseMedia
  /** Where `media` comes from: admin upload or Cloudinary CDN metadata. */
  mediaSource?: "custom" | "cdn"
  muscleGroup: string
  muscleProfileRationale?: string
  muscleProfileSource?: MuscleProfileSource
  muscleProfileStatus?: MuscleProfileStatus
  name: string
  updatedAt: Date
  usageCount: number
  variationName: string
}

type AdminExerciseImportRow = {
  activityType: ExerciseActivityType
  exerciseName: string
  equipment?: string
  isDefault?: boolean
  muscleGroup: string
  primaryMuscles: MuscleSlug[]
  rowNumber: number
  sortOrder?: number
  secondaryMuscles: MuscleSlug[]
  variationName: string
}

type AdminExerciseImportSkippedRow = AdminExerciseImportRow & {
  reason: "already_exists" | "duplicate_in_file"
}

type AdminExerciseImportResult = {
  createdCount: number
  skippedCount: number
  skippedRows: AdminExerciseImportSkippedRow[]
  totalRows: number
}

type AdminExerciseImportRequest = {
  createdAt: Date
  fileName?: string
  id: string
  result?: Record<string, unknown>
  reviewedAt?: Date
  reviewedBy: AdminMiniUser | null
  reviewNote?: string
  rowCount: number
  rows: AdminExerciseImportRow[]
  status: "pending" | "approved" | "rejected"
  submittedBy: AdminMiniUser
  updatedAt: Date
}

type AdminExerciseGroupDeleteSkippedItem = {
  id: string
  name: string
  usageCount: number
}

type AdminExerciseGroupDeleteResult = {
  deletedCount: number
  deletedIds: string[]
  muscleGroup: string
  skippedCount: number
  skippedExercises: AdminExerciseGroupDeleteSkippedItem[]
}

type AdminAuditLogItem = {
  action: string
  admin: AdminMiniUser
  createdAt: Date
  entityId?: string
  entityLabel?: string
  entityType: string
  id: string
  metadata?: unknown
}

type AdminCustomFoodItem = {
  calories: number
  carbs: number
  category: string
  createdAt: Date
  createdBy: Pick<AdminMiniUser, "email" | "id" | "name"> | null
  fat: number
  id: string
  name: string
  nameEn?: string | null
  protein: number
  reviewNote: string | null
  reviewedAt: Date | null
  reviewedBy: Pick<AdminMiniUser, "email" | "id" | "name"> | null
  reviewStatus: "pending" | "approved" | "rejected"
  servingAmount: number
  servingLabel: string
  servingUnit: string
  source: "system" | "user"
  updatedAt: Date
}

type AdminUserWorkoutLog = {
  completedAt?: Date
  id: string
  startedAt: Date
  totalVolume?: number
  workout: {
    id: string
    name: string
  } | null
}

type AdminUserDetail = {
  assignedCoach: AdminMiniUser | null
  assignedPrograms: AdminProgramSummary[]
  coachRequests: AdminCoachRequest[]
  connectedTrainees: AdminMiniUser[]
  createdPrograms: AdminProgramSummary[]
  recentAuditLogs: AdminAuditLogItem[]
  recentWorkoutLogs: AdminUserWorkoutLog[]
  user: AdminUserListItem
}

type AdminConnection = {
  coach: AdminMiniUser
  trainee: AdminMiniUser
}

type AdminConnectionsData = {
  coaches: AdminMiniUser[]
  connections: AdminConnection[]
  unassignedTrainees: AdminMiniUser[]
}

type AdminChartPoint = {
  label: string
  periodStart: Date
  value: number
}

type AdminChartSeries = {
  monthly: AdminChartPoint[]
  weekly: AdminChartPoint[]
}

type AdminDashboardStats = {
  activeUsersLast30Days: number
  activeUsersLast7Days: number
  pendingCoachRequests: number
  totalAdmins: number
  totalCoaches: number
  totalMeals: number
  totalPrograms: number
  totalTrainees: number
  totalUsers: number
  totalWorkoutLogs: number
}

type AdminCoachOverview = {
  email: string
  id: string
  isActive: boolean
  name: string
  programCount: number
  traineeCount: number
}

type AdminDashboardData = {
  charts: {
    activeUsers: AdminChartSeries
    userGrowth: AdminChartSeries
    workoutLogs: AdminChartSeries
  }
  pendingCoachRequests: AdminCoachRequest[]
  recentPrograms: AdminProgramSummary[]
  recentUsers: AdminUserListItem[]
  stats: AdminDashboardStats
  topCoaches: AdminCoachOverview[]
}

type ExerciseSyncRow = {
  activityType?: ExerciseActivityType
  id?: string
  exerciseName: string
  equipment?: string
  muscleGroup: string
  primaryMuscles?: MuscleSlug[]
  secondaryMuscles?: MuscleSlug[]
  variationName: string
}

type ExerciseSyncFieldChange<T = string> = { from: T; to: T }

type ExerciseSyncModifiedItem = {
  id: string
  exerciseName: string
  variationName: string
  changes: {
    activityType?: ExerciseSyncFieldChange<ExerciseActivityType | undefined>
    exerciseName?: ExerciseSyncFieldChange
    equipment?: ExerciseSyncFieldChange<string | undefined>
    muscleGroup?: ExerciseSyncFieldChange
    primaryMuscles?: ExerciseSyncFieldChange<MuscleSlug[]>
    secondaryMuscles?: ExerciseSyncFieldChange<MuscleSlug[]>
    variationName?: ExerciseSyncFieldChange
  }
  usageCount: number
  hasConflict?: boolean
}

type ExerciseSyncAddedItem = {
  activityType?: ExerciseActivityType
  exerciseName: string
  equipment?: string
  muscleGroup: string
  primaryMuscles?: MuscleSlug[]
  secondaryMuscles?: MuscleSlug[]
  variationName: string
}

type ExerciseSyncDeletedItem = {
  id: string
  exerciseName: string
  muscleGroup: string
  variationName: string
  equipment?: string
  usageCount: number
  canDelete: boolean
}

type ExerciseSyncPreview = {
  added: ExerciseSyncAddedItem[]
  modified: ExerciseSyncModifiedItem[]
  deleted: ExerciseSyncDeletedItem[]
  unchangedCount: number
}

type ExerciseSyncResult = {
  addedCount: number
  modifiedCount: number
  deletedCount: number
  skippedModifyCount: number
  skippedDeleteCount: number
}

export type {
  AdminAuditLogItem,
  AdminCustomFoodItem,
  AdminCoachOverview,
  AdminCoachRequest,
  AdminChartPoint,
  AdminChartSeries,
  AdminConnection,
  AdminConnectionsData,
  AdminDashboardData,
  AdminDashboardStats,
  AdminExerciseItem,
  AdminExerciseMediaFiles,
  AdminExerciseMediaKind,
  AdminExerciseMediaUpload,
  AdminExerciseMediaUploadedAsset,
  AdminExerciseImportResult,
  AdminExerciseImportRequest,
  AdminExerciseImportRow,
  AdminExerciseImportSkippedRow,
  AdminExerciseGroupDeleteResult,
  AdminExerciseGroupDeleteSkippedItem,
  AdminMiniUser,
  ExerciseSyncAddedItem,
  ExerciseSyncDeletedItem,
  ExerciseSyncFieldChange,
  ExerciseSyncModifiedItem,
  ExerciseSyncPreview,
  ExerciseSyncResult,
  ExerciseSyncRow,
  AdminProgramSummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserStats,
  AdminUserWorkoutLog,
}
