import type {
  DailyNutrition,
  ExerciseBase,
  ExerciseLibraryExercise,
  ExerciseVariation,
  ExerciseVariationOption,
  Meal,
  Program,
  Workout,
  WorkoutLog,
} from "@/lib/types"

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
  lastCheckInAt?: Date
  latestWeightKg?: number
  name: string
  phone?: string
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
  weekLogs: WorkoutLog[]
  weekStats: {
    activeDaysThisWeek: number
    todayVolume: number
    workoutsThisWeek: number
  }
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

type BodyMetricEntry = {
  armCm?: number
  bodyFatPct?: number
  chestCm?: number
  coachId?: string
  coachName?: string
  createdAt: Date
  hipsCm?: number
  id: string
  note?: string
  recordedAt: Date
  thighCm?: number
  waistCm?: number
  weightKg?: number
}

type CoachCheckIn = {
  adherenceScore?: number
  checkInDate: Date
  coachId: string
  coachName: string
  createdAt: Date
  energyScore?: number
  feedback: string
  id: string
  moodScore?: number
  nextFocus?: string
  recoveryScore?: number
  summary?: string
}

type CoachProgressSummary = {
  completionRate: number
  latestWorkoutAt?: Date
  plannedSessionsPerWeek: number
  totalVolumeLast30Days: number
  workoutsLast30Days: number
  workoutsLast7Days: number
}

type ProgressAnalyticsSummary = {
  bestStreakDays: number
  currentStreakDays: number
  totalVolumeThisMonth: number
  workoutsThisMonth: number
}

type ProgressStrengthSeries = {
  color: string
  exerciseName: string
  key: string
}

type ProgressStrengthPoint = {
  label: string
  values: Record<string, number | null>
}

type ProgressMuscleGroupPoint = {
  fill: string
  name: string
  value: number
}

type ProgressWeeklyVolumePoint = {
  day: string
  volume: number
}

type ProgressPersonalRecord = {
  date: Date
  exercise: string
  weight: number
}

type ProgressAnalytics = {
  muscleGroupDistribution: ProgressMuscleGroupPoint[]
  personalRecords: ProgressPersonalRecord[]
  strengthProgression: {
    points: ProgressStrengthPoint[]
    series: ProgressStrengthSeries[]
  }
  summary: ProgressAnalyticsSummary
  weeklyVolume: ProgressWeeklyVolumePoint[]
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
  bodyMetrics: BodyMetricEntry[]
  checkIns: CoachCheckIn[]
  programs: CoachProgram[]
  progressSummary: CoachProgressSummary
  recentLogs: WorkoutLog[]
  trainee: CoachTrainee
}

type CreateCoachProgramInput = {
  assignToUserIds?: string[]
  description?: string
  difficulty: CoachProgram["difficulty"]
  duration: number
  name: string
  workouts: Array<{
    duration?: number
    exercises: Array<{
      repsMin?: number
      variationId: string
      reps: number
      sets: number
      weight?: number
    }>
    name: string
    scheduledDay?: number
    scheduledDate?: string
  }>
}

type CreateWorkoutInput = {
  duration?: number
  exercises: Array<{
    repsMin?: number
    variationId: string
    reps: number
    restTime?: number
    sets: number
    weight?: number
  }>
  name: string
  notes?: string
  scheduledDay?: number
  scheduledDate?: string
}

type WorkoutLogInput = {
  completedAt?: string
  exercises: Workout["exercises"]
  notes?: string
  startedAt?: string
}

export type {
  AssignedTrainee,
  BodyMetricEntry,
  CoachCheckIn,
  CoachDashboardData,
  CoachProgressSummary,
  CoachProgram,
  CoachRequestSummary,
  CoachTrainee,
  CoachTraineeDetail,
  CreateCoachProgramInput,
  CreateWorkoutInput,
  DiscoverableCoach,
  MealCollection,
  ProgressAnalytics,
  ProgressAnalyticsSummary,
  ProgressMuscleGroupPoint,
  ProgressPersonalRecord,
  ProgressStrengthPoint,
  ProgressStrengthSeries,
  ProgressWeeklyVolumePoint,
  WeeklyCaloriesPoint,
  WorkoutCollection,
  WorkoutLogInput,
}

export type Exercise = ExerciseVariationOption
export type { ExerciseBase, ExerciseLibraryExercise, ExerciseVariation, ExerciseVariationOption }
