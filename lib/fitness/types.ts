import type { SetIntensityAssignment } from "@/lib/workout/intensity-tag"
import type {
  DailyNutrition,
  ExerciseBase,
  ExerciseLibraryExercise,
  ExerciseMuscleProfile,
  ExerciseSource,
  ExerciseVariation,
  ExerciseVariationOption,
  Meal,
  Program,
  Workout,
  WorkoutLog,
  WorkoutLogComment,
  WorkoutScheduleEntry,
} from "@/lib/types"
import type { ActiveWorkoutSession } from "@/lib/workout/session-storage"

type AssignedTrainee = {
  assignedAt: Date
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

type TraineeProgram = {
  assignedAt: Date
  duration: number
  id: string
  name: string
  /** `YYYY-MM-DD`. Overrides `assignedAt` as the week-1 anchor when set. */
  startDate?: string
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
  activeSessions: ActiveWorkoutSession[]
  historyLogs: WorkoutLog[]
  programs: TraineeProgram[]
  recentLogs: WorkoutLog[]
  schedule: Record<number, Workout | null>
  scheduleEntries: WorkoutScheduleEntry[]
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

type TraineeDashboardData = {
  activeSessions: ActiveWorkoutSession[]
  dailyNutrition: DailyNutrition
  recentLogs: WorkoutLog[]
  schedule: Record<number, Workout | null>
  scheduleEntries: WorkoutScheduleEntry[]
  todayWorkout: Workout | null
  weekStats: WorkoutCollection["weekStats"]
  workouts: Workout[]
}

type MealHistoryPage = {
  meals: Meal[]
  nextCursor?: string
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

type DashboardAnalyticsSummary = {
  avgDurationMins: number
  completedDelta: number
  completedWorkouts: number
  completionRate: number
  e1rmChangePct: number
  e1rmChangeTotalKg: number
  latestPR: { deltaKg: number; exerciseName: string } | null
  newPRsCount: number
  planAdherencePct: number
  plannedWorkouts: number
  sessionsPerWeek: number
  totalVolume: number
  trainingDays: number
  volumeDeltaPct: number
}

type DashboardWorkoutFrequencyPoint = {
  completed: number
  label: string
  planned: number
}

type DashboardBodyProgress = {
  bodyFat: Array<{ date: string; value: number }>
  measurements: {
    arm: Array<{ date: string; value: number }>
    chest: Array<{ date: string; value: number }>
    hips: Array<{ date: string; value: number }>
    thigh: Array<{ date: string; value: number }>
    waist: Array<{ date: string; value: number }>
  }
  weight: Array<{ date: string; value: number }>
}

type DashboardAnalytics = {
  bodyProgress: DashboardBodyProgress
  muscleGroupDistribution: {
    groups: Array<{ fill: string; name: string; value: number; volume: number }>
    totalVolume: number
  }
  recentPRs: Array<{
    date: string
    delta: number
    exerciseName: string
    type: "weight" | "e1rm"
    unit: string
    value: number
  }>
  strengthProgress: {
    points: Array<{ label: string; values: Record<string, number | null> }>
    series: Array<{ color: string; exerciseName: string; key: string }>
  }
  summary: DashboardAnalyticsSummary
  trainingVolume: Array<{ label: string; volume: number }>
  workoutFrequency: DashboardWorkoutFrequencyPoint[]
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

type ProgressCalendarLogStub = {
  completedAt: string | null
  id: string
  startedAt: string
  totalVolume: number
  workoutId: string
  workoutKind: string | null
  workoutName: string
}

type ProgressCalendarDay = {
  date: string // "YYYY-MM-DD"
  logs: ProgressCalendarLogStub[]
}

type ProgressCalendar = {
  days: ProgressCalendarDay[]
  summary: {
    avgDurationMins: number
    totalVolume: number
    totalWorkouts: number
  }
}

type ProgressYearViewDay = {
  count: number
  date: string // "YYYY-MM-DD"
  volume: number
}

type ProgressYearView = {
  days: ProgressYearViewDay[]
  year: number
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

type CoachNutritionDailyLog = {
  calories: number
  carbs: number
  date: string
  fat: number
  items: Array<{
    amountLabel?: string
    calories: number
    carbs?: number
    fat?: number
    id: string
    mealType: Meal["type"]
    name: string
    protein?: number
  }>
  protein: number
}

type CoachNutritionSummary = {
  avgCalories: number
  avgCarbs: number
  avgFat: number
  avgProtein: number
  dailyLogs: CoachNutritionDailyLog[]
  daysTracked: number
  traineeCalorieGoal: number
}

/** Day keys are `YYYY-MM-DD` in UTC, matching the trainee's own schedule. */
type CoachTraineeOverview = {
  body: {
    bodyFatPct: { recordedAt: string; value: number } | null
    waistCm: { recordedAt: string; value: number } | null
    weightKg: { deltaKg: number | null; recordedAt: string; value: number } | null
  }
  /** Completed sessions and logged volume over the last 30 days. */
  last30Days: { sessions: number; volume: number }
  lastWorkoutAt: string | null
  recentPRs: Array<{ date: string; deltaKg: number; exerciseName: string; weightKg: number }>
  streaks: { bestDays: number; currentDays: number }
  week: {
    completedSessions: number
    days: Array<{ date: string; sessions: number; sets: number; volume: number }>
    /** Coach-assigned workouts on the trainee's schedule this week. */
    plannedSessions: number
    totalSets: number
    totalVolume: number
    weekStart: string
  }
}

type CoachTraineeDetail = {
  bodyMetrics: BodyMetricEntry[]
  checkIns: CoachCheckIn[]
  nutritionSummary?: CoachNutritionSummary
  overview: CoachTraineeOverview
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
  /** `YYYY-MM-DD`, or null to clear it and fall back to each assignment date. */
  startDate?: string | null
  googleSpreadsheetId?: string
  googleSheetName?: string
  workouts: Array<{
    duration?: number
    exercises: Array<{
      notes?: string
      repsMin?: number
      rir?: number
      /** Per-set method tags; sets left out are normal straight sets. */
      setIntensityTags?: SetIntensityAssignment[]
      variationId: string
      reps: number
      restTime?: number
      sets: number
      weight?: number
    }>
    name: string
    scheduledDay?: number
    scheduledDate?: string
    weekIndex?: number
  }>
}

type CreateWorkoutInput = {
  duration?: number
  exercises: Array<{
    notes?: string
    repsMin?: number
    rir?: number
    /** Per-set method tags; sets left out are normal straight sets. */
    setIntensityTags?: SetIntensityAssignment[]
    variationId: string
    reps: number
    restTime?: number
    sets: number
    weight?: number
  }>
  kind?: string
  name: string
  notes?: string
  scheduledDay?: number
  scheduledDate?: string
}

type WorkoutLogInput = {
  /** Idempotency key; the offline queue replays a log under the same id. */
  clientLogId?: string
  completedAt?: string
  exercises: Workout["exercises"]
  notes?: string
  plannedDate?: string
  startedAt?: string
}

type CoachWorkoutLogPage = {
  logs: WorkoutLog[]
  nextCursor?: string
}

type CoachExercise = ExerciseMuscleProfile & {
  canManage: boolean
  createdAt: Date
  createdById?: string
  createdByName?: string
  equipment?: string
  id: string
  /** Media of the default variation, when it has any. */
  media?: import("@/lib/types").ExerciseMedia
  muscleGroup: string
  name: string
  source: ExerciseSource
  updatedAt: Date
  usageCount: number
  variationId?: string
  variationName: string
}

type CoachExerciseInput = {
  activityType: import("@/lib/types").ExerciseActivityType
  equipment?: string
  muscleGroup: string
  name: string
  primaryMuscles: import("@/lib/types").MuscleSlug[]
  secondaryMuscles: import("@/lib/types").MuscleSlug[]
}

type CoachExerciseImportRow = {
  activityType: import("@/lib/types").ExerciseActivityType
  exerciseName: string
  equipment?: string
  isDefault?: boolean
  muscleGroup: string
  primaryMuscles: import("@/lib/types").MuscleSlug[]
  rowNumber: number
  sortOrder?: number
  secondaryMuscles: import("@/lib/types").MuscleSlug[]
  variationName: string
}

type CoachExerciseImportRequest = {
  createdAt: Date
  fileName?: string
  id: string
  result?: Record<string, unknown>
  reviewedAt?: Date
  reviewedBy: {
    avatar?: string | null
    email: string
    id: string
    name: string
    role: string
  } | null
  reviewNote?: string
  rowCount: number
  rows: CoachExerciseImportRow[]
  status: "pending" | "approved" | "rejected"
  submittedBy: {
    avatar?: string | null
    email: string
    id: string
    name: string
    role: string
  }
  updatedAt: Date
}

type AppNotificationType =
  | "check_in_reminder"
  | "coach_request"
  | "coach_weekly_review"
  | "general"
  | "meal_reminder"
  | "program_assigned"
  | "program_updated"
  | "weight_reminder"
  | "workout_logged"
  | "workout_reminder"
  | "workout_session_open"

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

/** Days use 0 = Sunday … 6 = Saturday; times are local `HH:mm` in `timeZone`. */
type NotificationMealType = "breakfast" | "dinner" | "lunch" | "snack"

type TimedReminderSetting = {
  enabled: boolean
  time: string
}

type NotificationPreferences = {
  coachProgramUpdates: boolean
  /** Coaches: end-of-week nudge to review trainees. `day` is 0 = Sunday … 6 = Saturday. */
  coachWeeklyReview: TimedReminderSetting & { day: number }
  dailyCheckIn: TimedReminderSetting
  mealReminders: Record<NotificationMealType, TimedReminderSetting>
  timeZone: string
  weightReminder: TimedReminderSetting & { days: number[] }
  /** Sent `offsetMinutes` (15/30/60) before `time` on days with a scheduled workout. */
  workoutReminder: TimedReminderSetting & { offsetMinutes: number }
  workoutSessionReminders: boolean
}

type NotificationPreferencesInput = {
  coachProgramUpdates?: boolean
  coachWeeklyReview?: Partial<NotificationPreferences["coachWeeklyReview"]>
  dailyCheckIn?: Partial<TimedReminderSetting>
  mealReminders?: Partial<Record<NotificationMealType, Partial<TimedReminderSetting>>>
  timeZone?: string
  weightReminder?: Partial<NotificationPreferences["weightReminder"]>
  workoutReminder?: Partial<NotificationPreferences["workoutReminder"]>
  workoutSessionReminders?: boolean
}

type VolumeZone = "above_mrv" | "below_mev" | "insufficient_data" | "mav" | "mev_to_mav" | "near_mrv"

type VolumeRecommendationAction = "decrease" | "deload" | "increase" | "maintain"

type VolumeRecommendationReason =
  | "above_mrv"
  | "below_mev"
  | "collect_more_performance"
  | "inside_mav"
  | "insufficient_evidence"
  | "performance_down"
  | "performance_stable_or_up"
  | "recovery_and_performance_declining"
  | "recovery_good"
  | "recovery_signals_elevated"

type RecoveryCheckInInput = {
  checkInDate: string
  fatigue: number
  muscles: Array<{ muscleSlug: string; pain?: number; soreness: number }>
  note?: string
  sleepMinutes?: number
  sleepQuality?: number
  stress?: number
}

type RecoveryCheckIn = {
  algorithmVersion: string | null
  checkInDate: string
  fatigue: number
  id: string
  muscles: Array<{ muscleSlug: string; pain: number | null; soreness: number }>
  note: string | null
  readinessScore: number | null
  sleepMinutes: number | null
  sleepQuality: number | null
  stress: number | null
}

type VolumeRecoveryMuscle = {
  averageRir: number | null
  directSets: number
  effectiveSets: number
  indirectSets: number
  landmarks: {
    confidence: number
    mavMaxSets: number
    mavMinSets: number
    mevSets: number
    mrvSets: number
    source: "coach" | "learned" | "system"
  }
  lowConfidenceSets: number
  muscleSlug: string
  performanceChangePct: number | null
  recommendation: {
    action: VolumeRecommendationAction
    confidence: number
    currentSets: number
    reasons: VolumeRecommendationReason[]
    recommendedSets: number
    status: VolumeRecommendationStatus
  }
  soreness: number | null
  zone: VolumeZone
}

type TrainingGuidanceAction = "light_session" | "proceed" | "reduce_volume" | "rest"

type TrainingGuidanceReason =
  | "muscles_need_backoff"
  | "no_check_in"
  | "readiness_good"
  | "readiness_low"
  | "readiness_very_low"
  | "soreness_high"

type TrainingGuidance = {
  action: TrainingGuidanceAction
  focusMuscles: string[]
  reasons: TrainingGuidanceReason[]
  setAdjustmentPct: number
}

type RecoveryHistoryEntry = {
  checkInDate: string
  fatigue: number
  readinessScore: number | null
  sleepMinutes: number | null
  sleepQuality: number | null
  soreness: number | null
  stress: number | null
}

type RecoveryHistory = {
  averages: { readinessScore: number | null; sleepMinutes: number | null }
  days: number
  entries: RecoveryHistoryEntry[]
}

type VolumeRecommendationStatus = "accepted" | "applied" | "dismissed" | "pending"

type VolumeRecoveryData = {
  algorithmVersion: string
  checkIn: RecoveryCheckIn | null
  guidance: TrainingGuidance
  confidence: {
    label: "low" | "medium"
    recoveryCheckIns: number
    workoutSessions: number
  }
  muscles: VolumeRecoveryMuscle[]
  readiness: {
    label: "insufficient_data" | "low" | "moderate" | "ready"
    score: number | null
  }
  summary: {
    averageRir: number | null
    hardSets: number
    performanceChangePct: number | null
  }
  weekEnd: string
  weekStart: string
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
  CoachExerciseImportRequest,
  CoachExerciseImportRow,
  CoachExerciseInput,
  CoachNutritionDailyLog,
  CoachNutritionSummary,
  CoachProgressSummary,
  CoachProgram,
  CoachRequestSummary,
  CoachTrainee,
  CoachTraineeDetail,
  CoachTraineeOverview,
  CoachWorkoutLogPage,
  CreateCoachProgramInput,
  CreateWorkoutInput,
  DashboardAnalytics,
  DashboardAnalyticsSummary,
  DashboardBodyProgress,
  DashboardWorkoutFrequencyPoint,
  DiscoverableCoach,
  MealHistoryPage,
  MealCollection,
  NotificationList,
  NotificationMealType,
  NotificationPreferences,
  NotificationPreferencesInput,
  ProgressAnalytics,
  ProgressAnalyticsSummary,
  ProgressCalendar,
  ProgressCalendarDay,
  ProgressCalendarLogStub,
  ProgressMuscleGroupPoint,
  ProgressPersonalRecord,
  ProgressStrengthPoint,
  ProgressStrengthSeries,
  ProgressWeeklyVolumePoint,
  ProgressYearView,
  ProgressYearViewDay,
  RecoveryCheckIn,
  RecoveryCheckInInput,
  TraineeDashboardData,
  TraineeProgram,
  WeeklyCaloriesPoint,
  WorkoutCollection,
  WorkoutLogInput,
  RecoveryHistory,
  RecoveryHistoryEntry,
  TrainingGuidance,
  TrainingGuidanceAction,
  TrainingGuidanceReason,
  VolumeRecommendationStatus,
  VolumeRecoveryData,
  VolumeRecoveryMuscle,
  VolumeRecommendationAction,
  VolumeRecommendationReason,
  VolumeZone,
}

// ---------------------------------------------------------------------------
// AI Generation Types
// ---------------------------------------------------------------------------

type AIGenerateProgramInput = {
  goal: string
  experienceLevel: string
  daysPerWeek: number
  sessionDuration: number
  availableEquipment: string
  focusAreas?: string[]
  injuries?: string
  durationWeeks: number
}

type AIGeneratedProgramExercise = {
  variationId: string
  sets: number
  reps: number
  repsMin?: number
  rir?: number
  restTime?: number
  weight?: number
}

type AIGeneratedWorkout = {
  name: string
  kind: string
  weekIndex: number
  scheduledDay: number
  duration: number
  exercises: AIGeneratedProgramExercise[]
}

type AIGeneratedProgram = {
  name: string
  description: string
  difficulty: string
  duration: number
  workoutsPerWeek: number
  workouts: AIGeneratedWorkout[]
}

type AIGenerateProgramResult = {
  generationId: string
  program: AIGeneratedProgram
  mappingRate: number
}

type AIGenerateMealPlanInput = {
  date: string
  preferences?: string
  budget?: string
  cookingTime?: string
}

type AIGeneratedMealItem = {
  foodId: string
  foodName: string
  amountValue: number
  amountUnit: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

type AIGeneratedMeal = {
  type: string
  suggestion: string
  items: AIGeneratedMealItem[]
}

type AIGenerateMealPlanResult = {
  generationId: string
  meals: AIGeneratedMeal[]
  totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  notes: string
}

export type {
  AIGenerateMealPlanInput,
  AIGenerateMealPlanResult,
  AIGenerateProgramInput,
  AIGenerateProgramResult,
  AIGeneratedMeal,
  AIGeneratedMealItem,
  AIGeneratedProgram,
  AIGeneratedProgramExercise,
  AIGeneratedWorkout,
}

export type Exercise = ExerciseVariationOption
export type { ExerciseBase, ExerciseLibraryExercise, ExerciseSource, ExerciseVariation, ExerciseVariationOption, WorkoutLogComment }
