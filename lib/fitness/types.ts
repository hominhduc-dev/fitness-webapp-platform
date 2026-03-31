import type {
  DailyNutrition,
  ExerciseBase,
  ExerciseLibraryExercise,
  ExerciseSource,
  ExerciseVariation,
  ExerciseVariationOption,
  Meal,
  Program,
  Workout,
  WorkoutLog,
  WorkoutLogComment,
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
  assignedProgramIds?: string[]
  avatar?: string | null
  completionRate?: number
  createdAt: Date
  email: string
  fitnessGoals: string[]
  id: string
  lastCheckInAt?: Date
  latestWeightKg?: number
  name: string
  plannedSessionsPerWeek?: number
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
  historyLogs: WorkoutLog[]
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

type MealHistoryPage = {
  meals: Meal[]
  nextCursor?: string
}

type FoodSearchQueryKind = "branded" | "generic"

type FoodSearchMeta = {
  queryKind: FoodSearchQueryKind
  queryMapped?: string
  queryNormalized: string
  queryOriginal: string
  resolvedQuery: string
  searchFallbackUsed: boolean
}

type FoodSearchResult = {
  brandOwner?: string
  canLogByGram?: boolean
  dataType?: string
  fdcId: number
  logWarning?: string
  name: string
  nutritionPreview?: {
    calories?: number
    carbs?: number
    fat?: number
    fiber?: number
    protein?: number
    sodium?: number
    sugar?: number
  }
}

type FoodSearchResponse = {
  meta: FoodSearchMeta
  results: FoodSearchResult[]
}

type CoachDashboardSummary = {
  atRiskTraineeCount: number
  averageCompletionRate: number
  totalPlannedSessions: number
  totalTrainees: number
  unreadNotificationCount: number
  workoutsThisWeek: number
}

type CoachDashboardActivityPoint = {
  date: Date
  label: string
  totalVolume: number
  workouts: number
}

type CoachDashboardRecentWorkoutLog = {
  commentCount: number
  completedAt?: Date
  id: string
  startedAt: Date
  totalVolume?: number
  trainee: AssignedTrainee
  workout: {
    id: string
    name: string
  }
}

type CoachDashboardData = {
  activityByDay: CoachDashboardActivityPoint[]
  atRiskTrainees: CoachTrainee[]
  pendingRequests: CoachRequestSummary[]
  recentWorkoutLogs: CoachDashboardRecentWorkoutLog[]
  summary: CoachDashboardSummary
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

type CoachWorkoutLogPage = {
  logs: WorkoutLog[]
  nextCursor?: string
}

type CoachExercise = {
  canManage: boolean
  createdAt: Date
  createdById?: string
  createdByName?: string
  equipment?: string
  id: string
  muscleGroup: string
  name: string
  source: ExerciseSource
  updatedAt: Date
  usageCount: number
  variationId?: string
  variationName: string
}

type CoachExerciseInput = {
  equipment?: string
  muscleGroup: string
  name: string
}

type AppNotificationType =
  | "check_in_reminder"
  | "coach_request"
  | "general"
  | "meal_reminder"
  | "program_assigned"
  | "workout_logged"
  | "workout_reminder"

type AppNotificationStatus = "cancelled" | "failed" | "pending" | "sent"

type AppNotification = {
  createdAt: Date
  id: string
  message: string
  metadata?: Record<string, unknown>
  readAt?: Date
  relatedEntityId?: string
  relatedEntityType?: string
  scheduledFor: Date
  status: AppNotificationStatus
  title: string
  type: AppNotificationType
}

type NotificationList = {
  notifications: AppNotification[]
  unreadCount: number
}

export type {
  AppNotification,
  AppNotificationStatus,
  AppNotificationType,
  AssignedTrainee,
  BodyMetricEntry,
  CoachCheckIn,
  CoachDashboardActivityPoint,
  CoachDashboardData,
  CoachDashboardRecentWorkoutLog,
  CoachDashboardSummary,
  CoachExercise,
  CoachExerciseInput,
  CoachProgressSummary,
  CoachProgram,
  CoachRequestSummary,
  CoachTrainee,
  CoachTraineeDetail,
  CoachWorkoutLogPage,
  CreateCoachProgramInput,
  CreateWorkoutInput,
  DiscoverableCoach,
  FoodSearchMeta,
  FoodSearchQueryKind,
  FoodSearchResponse,
  FoodSearchResult,
  MealHistoryPage,
  MealCollection,
  NotificationList,
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
export type { ExerciseBase, ExerciseLibraryExercise, ExerciseSource, ExerciseVariation, ExerciseVariationOption, WorkoutLogComment }
