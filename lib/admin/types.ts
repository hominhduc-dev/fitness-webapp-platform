import type { UserRole } from "@/lib/types"

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

type AdminExerciseItem = {
  createdAt: Date
  createdBy: AdminMiniUser | null
  equipment?: string
  id: string
  isDefault: boolean
  muscleGroup: string
  name: string
  updatedAt: Date
  usageCount: number
  variationName: string
}

type AdminExerciseImportRow = {
  exerciseName: string
  equipment?: string
  isDefault?: boolean
  muscleGroup: string
  rowNumber: number
  sortOrder?: number
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

export type {
  AdminAuditLogItem,
  AdminCoachOverview,
  AdminCoachRequest,
  AdminChartPoint,
  AdminChartSeries,
  AdminConnection,
  AdminConnectionsData,
  AdminDashboardData,
  AdminDashboardStats,
  AdminExerciseItem,
  AdminExerciseImportResult,
  AdminExerciseImportRow,
  AdminExerciseImportSkippedRow,
  AdminExerciseGroupDeleteResult,
  AdminExerciseGroupDeleteSkippedItem,
  AdminMiniUser,
  AdminProgramSummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserStats,
  AdminUserWorkoutLog,
}
