import type { DailyNutrition, Exercise, Meal, Program, Workout, WorkoutLog } from "@/lib/types"

type AssignedTrainee = {
  avatar?: string | null
  email: string
  fitnessGoals: string[]
  id: string
  name: string
}

type CoachProgram = Program & {
  assignedTrainees: AssignedTrainee[]
  createdAt: Date
}

type CoachTrainee = {
  avatar?: string | null
  createdAt: Date
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  programCount: number
  thisWeekWorkouts: number
  totalWorkoutLogs: number
}

type CoachRequestSummary = {
  coachId: string
  createdAt: Date
  id: string
  status: "pending" | "approved" | "rejected"
  trainee: AssignedTrainee
  traineeId: string
}

type WeeklyCaloriesPoint = {
  calories: number
  day: string
  target: number
}

type WorkoutCollection = {
  recentLogs: WorkoutLog[]
  schedule: Record<number, Workout | null>
  todayWorkout: Workout | null
  workouts: Workout[]
}

type MealCollection = {
  dailyNutrition: DailyNutrition
  meals: Meal[]
  weeklyCalories: WeeklyCaloriesPoint[]
}

type CoachDashboardData = {
  pendingRequests: CoachRequestSummary[]
  trainees: CoachTrainee[]
}

type DiscoverableCoach = {
  activeTrainees: number
  avatar?: string | null
  createdAt: Date
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  requestId?: string
  requestStatus: "none" | "pending" | "approved" | "rejected" | "connected"
}

type CoachTraineeDetail = {
  programs: CoachProgram[]
  recentLogs: WorkoutLog[]
  trainee: CoachTrainee
}

type CreateCoachProgramInput = {
  description?: string
  difficulty: CoachProgram["difficulty"]
  duration: number
  name: string
  workouts: Array<{
    duration?: number
    exercises: Array<{
      exerciseId: string
      reps: number
      restTime?: number
      sets: number
    }>
    name: string
    scheduledDay?: number
  }>
}

type WorkoutLogInput = {
  completedAt?: string
  exercises: Workout["exercises"]
  notes?: string
  startedAt?: string
}

export type {
  AssignedTrainee,
  CoachDashboardData,
  CoachProgram,
  CoachRequestSummary,
  CoachTrainee,
  CoachTraineeDetail,
  CreateCoachProgramInput,
  DiscoverableCoach,
  MealCollection,
  WeeklyCaloriesPoint,
  WorkoutCollection,
  WorkoutLogInput,
}

export type { Exercise }
