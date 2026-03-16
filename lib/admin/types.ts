import type { UserRole } from "@/lib/types"

type AdminDashboardStats = {
  pendingCoachRequests: number
  totalAdmins: number
  totalCoaches: number
  totalMeals: number
  totalPrograms: number
  totalTrainees: number
  totalUsers: number
  totalWorkoutLogs: number
}

type AdminRecentUser = {
  createdAt: Date
  email: string
  id: string
  name: string
  programCount: number
  role: UserRole
  traineeCount: number
  workoutLogCount: number
}

type AdminPendingCoachRequest = {
  coach: {
    email: string
    id: string
    name: string
  }
  createdAt: Date
  id: string
  status: "pending"
  trainee: {
    email: string
    id: string
    name: string
  }
}

type AdminRecentProgram = {
  assignmentCount: number
  createdAt: Date
  createdBy: {
    email: string
    id: string
    name: string
  }
  difficulty: "beginner" | "intermediate" | "advanced"
  duration: number
  id: string
  name: string
  workoutsPerWeek: number
}

type AdminCoachOverview = {
  email: string
  id: string
  name: string
  programCount: number
  traineeCount: number
}

type AdminDashboardData = {
  pendingCoachRequests: AdminPendingCoachRequest[]
  recentPrograms: AdminRecentProgram[]
  recentUsers: AdminRecentUser[]
  stats: AdminDashboardStats
  topCoaches: AdminCoachOverview[]
}

export type {
  AdminCoachOverview,
  AdminDashboardData,
  AdminDashboardStats,
  AdminPendingCoachRequest,
  AdminRecentProgram,
  AdminRecentUser,
}
