import { ApiError } from "@/lib/auth/api"
import { getApiBaseUrl } from "@/lib/supabase/config"
import type {
  DailyNutrition,
  ExerciseBase,
  ExerciseLibraryExercise,
  ExerciseSet,
  ExerciseVariation,
  ExerciseVariationOption,
  Meal,
  NutritionFood,
  Program,
  Workout,
  WorkoutLog,
  WorkoutScheduleEntry,
} from "@/lib/types"

import type {
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
  CoachProgressSummary,
  CoachProgram,
  CoachTrainee,
  CoachTraineeDetail,
  CoachWorkoutLogPage,
  CreateCoachProgramInput,
  CreateWorkoutInput,
  DiscoverableCoach,
  NotificationList,
  ProgressAnalytics,
  ProgressAnalyticsSummary,
  ProgressCalendar,
  ProgressMuscleGroupPoint,
  ProgressPersonalRecord,
  ProgressStrengthPoint,
  ProgressStrengthSeries,
  ProgressWeeklyVolumePoint,
  ProgressYearView,
  TraineeDashboardData,
  WorkoutCollection,
  WorkoutLogInput,
  AppNotification,
} from "./types"

type SerializedExerciseBase = ExerciseBase

type SerializedExerciseVariation = {
  canManage?: boolean
  createdById?: string
  equipment?: string
  id: string
  isDefault: boolean
  metadata?: Record<string, unknown>
  name: string
  source?: "coach" | "system"
  sortOrder: number
}

type SerializedExerciseVariationOption = ExerciseVariationOption

type SerializedExerciseSet = {
  actualReps?: number
  completed: boolean
  id: string
  notes?: string
  previousPerformance?: {
    completedAt: string
    reps?: number
    source: "most_recent" | "same_weekday_last_week"
    weight?: number
  }
  rir?: number
  setNumber: number
  targetRepsMin?: number
  targetReps: number
  weight?: number
}

type SerializedWorkoutExercise = {
  exercise: SerializedExerciseBase & {
    equipment?: string
  }
  id: string
  notes?: string
  restTime?: number
  sets: SerializedExerciseSet[]
  variation?: SerializedExerciseVariation | null
}

type SerializedWorkout = {
  duration?: number
  exercises: SerializedWorkoutExercise[]
  id: string
  isPersonal?: boolean
  kind?: string
  name: string
  notes?: string
  scheduledDay?: number
  scheduledDate?: string
}

type SerializedWorkoutLogComment = {
  authorAvatar?: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
  id: string
  updatedAt: string
}

type SerializedWorkoutLog = {
  comments: SerializedWorkoutLogComment[]
  completedAt?: string | null
  exercises: SerializedWorkoutExercise[]
  id: string
  notes?: string
  plannedDate?: string | null
  startedAt: string
  totalVolume?: number
  workout: SerializedWorkout
}

type SerializedWorkoutScheduleEntry = {
  date: string
  durationLabel?: string
  isCompleted: boolean
  isMissed: boolean
  isToday: boolean
  log: SerializedWorkoutLog | null
  source: "coach" | "self"
  weekday: number
  workout: SerializedWorkout | null
}

type SerializedMeal = {
  calories: number
  carbs?: number
  fat?: number
  fiber?: number
  id?: string
  items?: SerializedMealItem[]
  loggedDate?: string
  name: string
  protein?: number
  sodium?: number
  sugar?: number
  time?: string
  type: Meal["type"]
}

type SerializedMealItem = {
  amountLabel?: string
  amountUnit: string
  amountValue: number
  calories: number
  carbs?: number
  fat?: number
  fiber?: number
  foodId: string
  id: string
  name: string
  protein?: number
  sodium?: number
  sugar?: number
  weightGrams?: number
}

type SerializedNutritionFood = NutritionFood

type ApiEnvelope<T> = {
  data: T
  error: null
  meta: unknown
}

type NutritionTargets = {
  calories: number
  carbs: number
  fat: number
  protein: number
}

type NutritionTotals = {
  calories: number
  carbs: number
  fat: number
  fiber?: number
  protein: number
  sodium?: number
  sugar?: number
}

type NutritionDay = {
  date: Date
  meals: Meal[]
  recentFoods: NutritionFood[]
  targets: NutritionTargets
  totals: NutritionTotals
}

type SerializedExerciseLibraryExercise = SerializedExerciseBase & {
  canManage?: boolean
  createdById?: string
  createdByName?: string
  source?: "coach" | "system"
  variations: SerializedExerciseVariation[]
}

type SerializedAssignedTrainee = {
  assignedAt: string
  avatar?: string | null
  email: string
  fitnessGoals: string[]
  id: string
  name: string
}

type SerializedCoachProgram = Omit<Program, "createdAt" | "workouts"> & {
  assignedTrainees: SerializedAssignedTrainee[]
  createdAt: string
  workouts: SerializedWorkout[]
}

type SerializedCoachTrainee = {
  assignedProgramIds?: string[]
  avatar?: string | null
  completionRate?: number
  createdAt: string
  email: string
  fitnessGoals: string[]
  id: string
  lastCheckInAt?: string | null
  latestWeightKg?: number | null
  name: string
  plannedSessionsPerWeek?: number
  phone?: string | null
  programCount: number
  thisWeekWorkouts: number
  totalWorkoutLogs: number
}

type SerializedCoachRequest = {
  coachId: string
  createdAt: string
  id: string
  status: "pending" | "approved" | "rejected"
  trainee: SerializedAssignedTrainee
  traineeId: string
}

type SerializedDiscoverableCoach = {
  activeTrainees: number
  avatar?: string | null
  createdAt: string
  email: string
  fitnessGoals: string[]
  id: string
  name: string
  requestId?: string
  requestStatus: DiscoverableCoach["requestStatus"]
}

type SerializedCoachRequestCreate = {
  request: {
    coachId: string
    createdAt: string
    id: string
    requestStatus: "pending" | "approved" | "rejected"
    traineeId: string
  }
}

type SerializedBodyMetricEntry = {
  armCm?: number | null
  bodyFatPct?: number | null
  chestCm?: number | null
  coachId?: string | null
  coachName?: string | null
  createdAt: string
  hipsCm?: number | null
  id: string
  note?: string | null
  recordedAt: string
  thighCm?: number | null
  waistCm?: number | null
  weightKg?: number | null
}

type SerializedCoachCheckIn = {
  adherenceScore?: number | null
  checkInDate: string
  coachId: string
  coachName: string
  createdAt: string
  energyScore?: number | null
  feedback: string
  id: string
  moodScore?: number | null
  nextFocus?: string | null
  recoveryScore?: number | null
  summary?: string | null
}

type SerializedCoachProgressSummary = {
  completionRate: number
  latestWorkoutAt?: string | null
  plannedSessionsPerWeek: number
  totalVolumeLast30Days: number
  workoutsLast30Days: number
  workoutsLast7Days: number
}

type SerializedCoachDashboardSummary = {
  atRiskTraineeCount: number
  averageCompletionRate: number
  totalPlannedSessions: number
  totalTrainees: number
  unreadNotificationCount: number
  workoutsThisWeek: number
}

type SerializedCoachDashboardActivityPoint = {
  date: string
  label: string
  totalVolume: number
  workouts: number
}

type SerializedCoachDashboardRecentWorkoutLog = {
  commentCount: number
  completedAt?: string | null
  id: string
  startedAt: string
  totalVolume?: number
  trainee: SerializedAssignedTrainee
  workout: {
    id: string
    name: string
  }
}

type SerializedCoachExercise = {
  canManage: boolean
  createdAt: string
  createdById?: string
  createdByName?: string
  equipment?: string
  id: string
  muscleGroup: string
  name: string
  source: "coach" | "system"
  updatedAt: string
  usageCount: number
  variationId?: string
  variationName: string
}

type SerializedCoachExerciseImportRequest = Omit<CoachExerciseImportRequest, "createdAt" | "reviewedAt" | "updatedAt"> & {
  createdAt: string
  reviewedAt?: string
  updatedAt: string
}

type SerializedNotification = {
  createdAt: string
  id: string
  message: string
  metadata?: Record<string, unknown>
  readAt?: string | null
  relatedEntityId?: string | null
  relatedEntityType?: string | null
  scheduledFor: string
  status: AppNotification["status"]
  title: string
  type: AppNotification["type"]
}

type SerializedProgressAnalytics = {
  muscleGroupDistribution: ProgressMuscleGroupPoint[]
  personalRecords: Array<Omit<ProgressPersonalRecord, "date"> & { date: string }>
  strengthProgression: {
    points: ProgressStrengthPoint[]
    series: ProgressStrengthSeries[]
  }
  summary: ProgressAnalyticsSummary
  weeklyVolume: ProgressWeeklyVolumePoint[]
}

type SerializedDailyNutrition = Omit<DailyNutrition, "date" | "meals"> & {
  date: string
  meals: SerializedMeal[]
}

async function parseJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string | { message?: string }; message?: string }
    | null

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && ("error" in payload || "message" in payload)
        ? typeof payload.error === "string"
          ? payload.error
          : payload.error && typeof payload.error === "object" && "message" in payload.error
            ? String(payload.error.message)
            : payload.message ?? "Request failed"
        : "Request failed"

    throw new ApiError(message, response.status)
  }

  return payload as T
}

async function request<T>(path: string, accessToken: string, init?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }) {
  let response: Response

  const fetchOptions: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  }

  // Default GET requests to short revalidation; mutations stay uncached
  if (!fetchOptions.next?.revalidate && fetchOptions.cache === undefined) {
    const method = (fetchOptions.method ?? "GET").toUpperCase()
    if (method === "GET") {
      fetchOptions.next = { ...fetchOptions.next, revalidate: 30 }
    } else {
      fetchOptions.cache = "no-store"
    }
  }

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, fetchOptions)
  } catch {
    throw new ApiError("Unable to reach the API server. Make sure the backend is running.", 503)
  }

  return parseJson<T>(response)
}

function toDate(value?: string | null) {
  return value ? new Date(value) : undefined
}

function buildExerciseQuery(options?: { equipment?: string; muscleGroup?: string; search?: string }) {
  const searchParams = new URLSearchParams()

  if (options?.equipment?.trim()) {
    searchParams.set("equipment", options.equipment.trim())
  }

  if (options?.muscleGroup?.trim()) {
    searchParams.set("muscleGroup", options.muscleGroup.trim())
  }

  if (options?.search?.trim()) {
    searchParams.set("search", options.search.trim())
  }

  return searchParams.size > 0 ? `?${searchParams.toString()}` : ""
}

function buildSearchQuery(search?: string) {
  const normalizedSearch = search?.trim()

  if (!normalizedSearch) {
    return ""
  }

  const searchParams = new URLSearchParams()
  searchParams.set("search", normalizedSearch)
  return `?${searchParams.toString()}`
}

function mapExerciseSet(set: SerializedExerciseSet): ExerciseSet {
  return {
    actualReps: set.actualReps,
    completed: set.completed,
    id: set.id,
    notes: set.notes,
    previousPerformance: set.previousPerformance
      ? {
          completedAt: new Date(set.previousPerformance.completedAt),
          reps: set.previousPerformance.reps,
          source: set.previousPerformance.source,
          weight: set.previousPerformance.weight,
        }
      : undefined,
    rir: set.rir,
    setNumber: set.setNumber,
    targetRepsMin: set.targetRepsMin,
    targetReps: set.targetReps,
    weight: set.weight,
  }
}

function mapExerciseVariation(variation: SerializedExerciseVariation): ExerciseVariation {
  return {
    canManage: variation.canManage,
    createdById: variation.createdById,
    equipment: variation.equipment,
    id: variation.id,
    isDefault: variation.isDefault,
    metadata: variation.metadata,
    name: variation.name,
    source: variation.source,
    sortOrder: variation.sortOrder,
  }
}

function synthesizeExerciseVariation(exercise: SerializedWorkoutExercise): ExerciseVariation {
  return {
    equipment: exercise.exercise.equipment,
    id: exercise.exercise.id,
    isDefault: true,
    metadata: undefined,
    name: "Default",
    sortOrder: 0,
  }
}

function parseScheduledDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }

  const [year, month, day] = value.split("-").map(Number)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined
  }

  const parsedDate = new Date(year, month - 1, day)

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return parsedDate
}

function mapWorkoutExercise(exercise: SerializedWorkoutExercise): Workout["exercises"][number] {
  return {
    exercise: {
      id: exercise.exercise.id,
      muscleGroup: exercise.exercise.muscleGroup,
      name: exercise.exercise.name,
    },
    id: exercise.id,
    notes: exercise.notes,
    restTime: exercise.restTime,
    sets: exercise.sets.map(mapExerciseSet),
    variation: exercise.variation ? mapExerciseVariation(exercise.variation) : synthesizeExerciseVariation(exercise),
  }
}

function mapWorkout(workout: SerializedWorkout): Workout {
  return {
    duration: workout.duration,
    exercises: workout.exercises.map(mapWorkoutExercise),
    id: workout.id,
    isPersonal: workout.isPersonal,
    kind: workout.kind as Workout["kind"],
    name: workout.name,
    notes: workout.notes,
    scheduledDay: workout.scheduledDay,
    scheduledDate: parseScheduledDate(workout.scheduledDate),
  }
}

function mapWorkoutLog(log: SerializedWorkoutLog): WorkoutLog {
  return {
    comments: (log.comments ?? []).map((comment) => ({
      authorAvatar: comment.authorAvatar,
      authorId: comment.authorId,
      authorName: comment.authorName,
      content: comment.content,
      createdAt: new Date(comment.createdAt),
      id: comment.id,
      updatedAt: new Date(comment.updatedAt),
    })),
    completedAt: toDate(log.completedAt),
    exercises: log.exercises.map(mapWorkoutExercise),
    id: log.id,
    notes: log.notes,
    plannedDate: parseScheduledDate(log.plannedDate ?? undefined),
    startedAt: new Date(log.startedAt),
    totalVolume: log.totalVolume,
    workout: mapWorkout(log.workout),
  }
}

function mapWorkoutScheduleEntry(entry: SerializedWorkoutScheduleEntry): WorkoutScheduleEntry {
  return {
    date: parseScheduledDate(entry.date) ?? new Date(entry.date),
    durationLabel: entry.durationLabel,
    isCompleted: entry.isCompleted,
    isMissed: entry.isMissed,
    isToday: entry.isToday,
    log: entry.log ? mapWorkoutLog(entry.log) : null,
    source: entry.source,
    weekday: entry.weekday,
    workout: entry.workout ? mapWorkout(entry.workout) : null,
  }
}

function mapMeal(meal: SerializedMeal): Meal {
  return {
    calories: meal.calories,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber: meal.fiber,
    id: meal.id,
    items: (meal.items ?? []).map((item) => ({
      amountLabel: item.amountLabel,
      amountUnit: item.amountUnit,
      amountValue: item.amountValue,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      foodId: item.foodId,
      id: item.id,
      name: item.name,
      protein: item.protein,
      sodium: item.sodium,
      sugar: item.sugar,
      weightGrams: item.weightGrams,
    })),
    loggedDate: toDate(meal.loggedDate),
    name: meal.name,
    protein: meal.protein,
    sodium: meal.sodium,
    sugar: meal.sugar,
    time: toDate(meal.time),
    type: meal.type,
  }
}

function mapAssignedTrainee(t: SerializedAssignedTrainee): AssignedTrainee {
  return { ...t, assignedAt: new Date(t.assignedAt) }
}

function mapCoachProgram(program: SerializedCoachProgram): CoachProgram {
  return {
    assignedTo: program.assignedTo,
    assignedTrainees: program.assignedTrainees.map(mapAssignedTrainee),
    createdAt: new Date(program.createdAt),
    createdBy: program.createdBy,
    description: program.description,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts.map(mapWorkout),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function mapCoachTrainee(trainee: SerializedCoachTrainee): CoachTrainee {
  return {
    assignedProgramIds: trainee.assignedProgramIds,
    avatar: trainee.avatar,
    completionRate: trainee.completionRate ?? undefined,
    createdAt: new Date(trainee.createdAt),
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    lastCheckInAt: toDate(trainee.lastCheckInAt),
    latestWeightKg: trainee.latestWeightKg ?? undefined,
    name: trainee.name,
    plannedSessionsPerWeek: trainee.plannedSessionsPerWeek ?? undefined,
    phone: trainee.phone ?? undefined,
    programCount: trainee.programCount,
    thisWeekWorkouts: trainee.thisWeekWorkouts,
    totalWorkoutLogs: trainee.totalWorkoutLogs,
  }
}

function mapBodyMetricEntry(entry: SerializedBodyMetricEntry): BodyMetricEntry {
  return {
    armCm: entry.armCm ?? undefined,
    bodyFatPct: entry.bodyFatPct ?? undefined,
    chestCm: entry.chestCm ?? undefined,
    coachId: entry.coachId ?? undefined,
    coachName: entry.coachName ?? undefined,
    createdAt: new Date(entry.createdAt),
    hipsCm: entry.hipsCm ?? undefined,
    id: entry.id,
    note: entry.note ?? undefined,
    recordedAt: new Date(entry.recordedAt),
    thighCm: entry.thighCm ?? undefined,
    waistCm: entry.waistCm ?? undefined,
    weightKg: entry.weightKg ?? undefined,
  }
}

function mapCoachCheckIn(entry: SerializedCoachCheckIn): CoachCheckIn {
  return {
    adherenceScore: entry.adherenceScore ?? undefined,
    checkInDate: new Date(entry.checkInDate),
    coachId: entry.coachId,
    coachName: entry.coachName,
    createdAt: new Date(entry.createdAt),
    energyScore: entry.energyScore ?? undefined,
    feedback: entry.feedback,
    id: entry.id,
    moodScore: entry.moodScore ?? undefined,
    nextFocus: entry.nextFocus ?? undefined,
    recoveryScore: entry.recoveryScore ?? undefined,
    summary: entry.summary ?? undefined,
  }
}

function mapCoachProgressSummary(summary: SerializedCoachProgressSummary): CoachProgressSummary {
  return {
    completionRate: summary.completionRate,
    latestWorkoutAt: toDate(summary.latestWorkoutAt),
    plannedSessionsPerWeek: summary.plannedSessionsPerWeek,
    totalVolumeLast30Days: summary.totalVolumeLast30Days,
    workoutsLast30Days: summary.workoutsLast30Days,
    workoutsLast7Days: summary.workoutsLast7Days,
  }
}

function mapProgressAnalytics(analytics: SerializedProgressAnalytics): ProgressAnalytics {
  return {
    muscleGroupDistribution: analytics.muscleGroupDistribution,
    personalRecords: analytics.personalRecords.map((record) => ({
      ...record,
      date: new Date(record.date),
    })),
    strengthProgression: analytics.strengthProgression,
    summary: analytics.summary,
    weeklyVolume: analytics.weeklyVolume,
  }
}

function mapDiscoverableCoach(coach: SerializedDiscoverableCoach): DiscoverableCoach {
  return {
    activeTrainees: coach.activeTrainees,
    avatar: coach.avatar,
    createdAt: new Date(coach.createdAt),
    email: coach.email,
    fitnessGoals: coach.fitnessGoals,
    id: coach.id,
    name: coach.name,
    requestId: coach.requestId,
    requestStatus: coach.requestStatus,
  }
}

function mapExerciseLibraryExercise(exercise: SerializedExerciseLibraryExercise): ExerciseLibraryExercise {
  return {
    canManage: exercise.canManage,
    createdById: exercise.createdById,
    createdByName: exercise.createdByName,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    source: exercise.source,
    variations: exercise.variations.map(mapExerciseVariation),
  }
}

function flattenExerciseLibraryToVariationOptions(
  exercises: ExerciseLibraryExercise[],
): ExerciseVariationOption[] {
  return exercises.flatMap((exercise) =>
    exercise.variations.map((variation) => ({
      canManage: variation.canManage ?? exercise.canManage,
      createdById: variation.createdById ?? exercise.createdById,
      equipment: variation.equipment,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      id: variation.id,
      isDefault: variation.isDefault,
      metadata: variation.metadata,
      muscleGroup: exercise.muscleGroup,
      name: variation.isDefault ? exercise.name : `${exercise.name} (${variation.name})`,
      source: variation.source ?? exercise.source,
      sortOrder: variation.sortOrder,
      variationName: variation.name,
    })),
  )
}

function mapCoachDashboardSummary(summary?: Partial<SerializedCoachDashboardSummary> | null): CoachDashboardSummary {
  return {
    atRiskTraineeCount: summary?.atRiskTraineeCount ?? 0,
    averageCompletionRate: summary?.averageCompletionRate ?? 0,
    totalPlannedSessions: summary?.totalPlannedSessions ?? 0,
    totalTrainees: summary?.totalTrainees ?? 0,
    unreadNotificationCount: summary?.unreadNotificationCount ?? 0,
    workoutsThisWeek: summary?.workoutsThisWeek ?? 0,
  }
}

function mapCoachDashboardActivityPoint(point: SerializedCoachDashboardActivityPoint): CoachDashboardActivityPoint {
  return {
    date: new Date(point.date),
    label: point.label,
    totalVolume: point.totalVolume,
    workouts: point.workouts,
  }
}

function mapCoachDashboardRecentWorkoutLog(
  log: SerializedCoachDashboardRecentWorkoutLog,
): CoachDashboardRecentWorkoutLog {
  return {
    commentCount: log.commentCount,
    completedAt: toDate(log.completedAt),
    id: log.id,
    startedAt: new Date(log.startedAt),
    totalVolume: log.totalVolume,
    trainee: mapAssignedTrainee(log.trainee),
    workout: log.workout,
  }
}

function mapCoachExercise(exercise: SerializedCoachExercise): CoachExercise {
  return {
    canManage: exercise.canManage,
    createdAt: new Date(exercise.createdAt),
    createdById: exercise.createdById,
    createdByName: exercise.createdByName,
    equipment: exercise.equipment,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    source: exercise.source,
    updatedAt: new Date(exercise.updatedAt),
    usageCount: exercise.usageCount,
    variationId: exercise.variationId,
    variationName: exercise.variationName,
  }
}

function mapCoachExerciseImportRequest(request: SerializedCoachExerciseImportRequest): CoachExerciseImportRequest {
  return {
    ...request,
    createdAt: new Date(request.createdAt),
    reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : undefined,
    updatedAt: new Date(request.updatedAt),
  }
}

function mapNotification(notification: SerializedNotification): AppNotification {
  return {
    createdAt: new Date(notification.createdAt),
    id: notification.id,
    message: notification.message,
    metadata: notification.metadata,
    readAt: toDate(notification.readAt),
    relatedEntityId: notification.relatedEntityId ?? undefined,
    relatedEntityType: notification.relatedEntityType ?? undefined,
    scheduledFor: new Date(notification.scheduledFor),
    status: notification.status,
    title: notification.title,
    type: notification.type,
  }
}

function mapDailyNutrition(nutrition: SerializedDailyNutrition): DailyNutrition {
  return {
    date: new Date(nutrition.date),
    meals: nutrition.meals.map(mapMeal),
    targetCalories: nutrition.targetCalories,
    totalCalories: nutrition.totalCalories,
  }
}

function mapNutritionDay(day: {
  date: string
  meals: SerializedMeal[]
  recentFoods?: SerializedNutritionFood[]
  targets: NutritionTargets
  totals: NutritionTotals
}): NutritionDay {
  return {
    date: new Date(`${day.date}T00:00:00`),
    meals: day.meals.map(mapMeal),
    recentFoods: day.recentFoods ?? [],
    targets: day.targets,
    totals: day.totals,
  }
}

async function fetchNutritionDay(accessToken: string, date?: string): Promise<NutritionDay> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  const response = await request<ApiEnvelope<{
    date: string
    meals: SerializedMeal[]
    recentFoods?: SerializedNutritionFood[]
    targets: NutritionTargets
    totals: NutritionTotals
  }>>(`/api/meals${query}`, accessToken, {
    cache: "no-store",
  })

  return mapNutritionDay(response.data)
}

async function fetchDashboard(accessToken: string): Promise<TraineeDashboardData> {
  const response = await request<{
    dashboard: {
      dailyNutrition: SerializedDailyNutrition
      recentLogs: SerializedWorkoutLog[]
      schedule: Record<number, SerializedWorkout | null>
      todayWorkout: SerializedWorkout | null
      weekStats: TraineeDashboardData["weekStats"]
      workouts: SerializedWorkout[]
    }
  }>("/api/dashboard", accessToken)

  return {
    dailyNutrition: mapDailyNutrition(response.dashboard.dailyNutrition),
    recentLogs: response.dashboard.recentLogs.map(mapWorkoutLog),
    schedule: Object.fromEntries(
      Object.entries(response.dashboard.schedule).map(([day, workout]) => [Number(day), workout ? mapWorkout(workout) : null]),
    ) as Record<number, Workout | null>,
    todayWorkout: response.dashboard.todayWorkout ? mapWorkout(response.dashboard.todayWorkout) : null,
    weekStats: response.dashboard.weekStats,
    workouts: response.dashboard.workouts.map(mapWorkout),
  }
}

async function fetchFoods(
  accessToken: string,
  options?: { category?: string; query?: string },
): Promise<NutritionFood[]> {
  const searchParams = new URLSearchParams()

  if (options?.category && options.category !== "all") {
    searchParams.set("category", options.category)
  }

  if (options?.query?.trim()) {
    searchParams.set("query", options.query.trim())
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ""
  const response = await request<ApiEnvelope<{ foods: SerializedNutritionFood[] }>>(
    `/api/foods${query}`,
    accessToken,
    { cache: "no-store" },
  )

  return response.data.foods
}

async function createCustomFood(
  accessToken: string,
  input: {
    calories: number
    carbs?: number
    category: string
    fat?: number
    name: string
    protein?: number
    servingLabel: string
  },
): Promise<NutritionFood> {
  const response = await request<ApiEnvelope<{ food: SerializedNutritionFood }>>("/api/foods", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return response.data.food
}

async function addMealItem(
  accessToken: string,
  input: {
    amountUnit: "g" | "ml" | "serving"
    amountValue: number
    date: string
    foodId: string
    mealType: Meal["type"]
  },
): Promise<Meal> {
  const response = await request<ApiEnvelope<{ meal: SerializedMeal }>>("/api/meals/items", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapMeal(response.data.meal)
}

async function deleteMealItem(accessToken: string, itemId: string): Promise<Meal> {
  const response = await request<ApiEnvelope<{ meal: SerializedMeal }>>(`/api/meals/items/${itemId}`, accessToken, {
    method: "DELETE",
  })

  return mapMeal(response.data.meal)
}

async function fetchWeightEntries(accessToken: string, days = 30): Promise<BodyMetricEntry[]> {
  const query = Number.isFinite(days) ? `?days=${encodeURIComponent(String(days))}` : ""
  const response = await request<{ bodyMetrics: SerializedBodyMetricEntry[] }>(`/api/progress/weight${query}`, accessToken)
  return response.bodyMetrics.map(mapBodyMetricEntry)
}

async function createWeightEntry(
  accessToken: string,
  input: {
    note?: string
    recordedAt?: string
    weightKg: number
  },
) {
  const response = await request<{ bodyMetric: SerializedBodyMetricEntry }>("/api/progress/weight", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapBodyMetricEntry(response.bodyMetric)
}

async function fetchProgressAnalytics(accessToken: string): Promise<ProgressAnalytics> {
  const response = await request<{ analytics: SerializedProgressAnalytics }>("/api/progress/analytics", accessToken)
  return mapProgressAnalytics(response.analytics)
}

async function fetchProgressCalendar(
  accessToken: string,
  year: number,
  month: number,
  options?: { summaryOnly?: boolean },
): Promise<ProgressCalendar> {
  const searchParams = new URLSearchParams({
    month: String(month),
    year: String(year),
  })
  if (options?.summaryOnly) {
    searchParams.set("summaryOnly", "true")
  }

  return request<ProgressCalendar>(
    `/api/progress/calendar?${searchParams.toString()}`,
    accessToken,
    { cache: "no-store" },
  )
}

async function fetchProgressYearView(accessToken: string, year: number): Promise<ProgressYearView> {
  return request<ProgressYearView>(
    `/api/progress/year-view?year=${year}`,
    accessToken,
    { cache: "no-store" },
  )
}

async function fetchWorkoutLogDetail(accessToken: string, logId: string): Promise<WorkoutLog> {
  const response = await request<{ log: SerializedWorkoutLog }>(
    `/api/progress/workout-log/${logId}`,
    accessToken,
    { cache: "no-store" },
  )
  return mapWorkoutLog(response.log)
}

async function fetchWorkouts(accessToken: string): Promise<WorkoutCollection> {
  const response = await request<{
    historyLogs: SerializedWorkoutLog[]
    programs: Array<{ assignedAt: string; duration: number; id: string; name: string }>
    recentLogs: SerializedWorkoutLog[]
    schedule: Record<number, SerializedWorkout | null>
    scheduleEntries?: SerializedWorkoutScheduleEntry[]
    todayWorkout: SerializedWorkout | null
    weekLogs: SerializedWorkoutLog[]
    weekStats: {
      activeDaysThisWeek: number
      todayVolume: number
      workoutsThisWeek: number
    }
    workouts: SerializedWorkout[]
  }>("/api/workouts", accessToken)

  return {
    historyLogs: (response.historyLogs ?? []).map(mapWorkoutLog),
    programs: (response.programs ?? []).map((p) => ({ ...p, assignedAt: new Date(p.assignedAt) })),
    recentLogs: response.recentLogs.map(mapWorkoutLog),
    schedule: Object.fromEntries(
      Object.entries(response.schedule).map(([day, workout]) => [Number(day), workout ? mapWorkout(workout) : null]),
    ) as Record<number, Workout | null>,
    scheduleEntries: (response.scheduleEntries ?? []).map(mapWorkoutScheduleEntry),
    todayWorkout: response.todayWorkout ? mapWorkout(response.todayWorkout) : null,
    weekLogs: (response.weekLogs ?? []).map(mapWorkoutLog),
    weekStats: response.weekStats ?? { activeDaysThisWeek: 0, todayVolume: 0, workoutsThisWeek: 0 },
    workouts: response.workouts.map(mapWorkout),
  }
}

async function fetchWorkoutLogsForExport(
  accessToken: string,
  options: { from: string; to: string },
): Promise<WorkoutLog[]> {
  const params = new URLSearchParams({ from: options.from, to: options.to })
  const response = await request<{ data: SerializedWorkoutLog[] }>(
    `/api/workouts/logs?${params.toString()}`,
    accessToken,
    { cache: "no-store" },
  )
  return response.data.map(mapWorkoutLog)
}

async function fetchWorkoutDetail(accessToken: string, workoutId: string) {
  const response = await request<{ workout: SerializedWorkout }>(`/api/workouts/${workoutId}`, accessToken)
  return mapWorkout(response.workout)
}

async function createWorkout(accessToken: string, input: CreateWorkoutInput) {
  const response = await request<{ workout: SerializedWorkout }>("/api/workouts", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapWorkout(response.workout)
}

async function updateWorkout(accessToken: string, workoutId: string, input: CreateWorkoutInput) {
  const response = await request<{ workout: SerializedWorkout }>(`/api/workouts/${workoutId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH",
  })

  return mapWorkout(response.workout)
}

async function deleteWorkout(accessToken: string, workoutId: string) {
  await request<{ deleted: boolean; id: string }>(`/api/workouts/${workoutId}`, accessToken, {
    method: "DELETE",
  })
}

async function createWorkoutLog(accessToken: string, workoutId: string, input: WorkoutLogInput) {
  const response = await request<{ log: SerializedWorkoutLog }>(`/api/workouts/${workoutId}/logs`, accessToken, {
    body: JSON.stringify({
      ...input,
      exercises: input.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map(({ previousPerformance, ...set }) => set),
      })),
    }),
    method: "POST",
  })

  return mapWorkoutLog(response.log)
}

async function deleteWorkoutLog(accessToken: string, workoutId: string, logId: string) {
  await request<{ deleted: boolean; id: string }>(`/api/workouts/${workoutId}/logs/${logId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchExercises(
  accessToken: string,
  options?: { equipment?: string; muscleGroup?: string; search?: string },
): Promise<ExerciseVariationOption[]> {
  const response = await request<{ exercises: SerializedExerciseVariationOption[] }>(
    `/api/exercises${buildExerciseQuery(options)}`,
    accessToken,
    {
      cache: "no-store",
    },
  )

  if (response.exercises.length > 0) {
    return response.exercises
  }

  const libraryExercises = await fetchExerciseLibrary(accessToken, options)
  return flattenExerciseLibraryToVariationOptions(libraryExercises)
}

async function fetchExerciseLibrary(
  accessToken: string,
  options?: { equipment?: string; muscleGroup?: string; search?: string },
): Promise<ExerciseLibraryExercise[]> {
  const response = await request<{ exercises: SerializedExerciseLibraryExercise[] }>(
    `/api/exercises/library${buildExerciseQuery(options)}`,
    accessToken,
    {
      cache: "no-store",
    },
  )
  return response.exercises.map(mapExerciseLibraryExercise)
}

async function fetchCoachPrograms(accessToken: string): Promise<CoachProgram[]> {
  const response = await request<{ programs: SerializedCoachProgram[] }>("/api/coach/programs", accessToken)
  return response.programs.map(mapCoachProgram)
}

async function createCoachProgram(accessToken: string, input: CreateCoachProgramInput) {
  const response = await request<{ program: SerializedCoachProgram }>("/api/coach/programs", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapCoachProgram(response.program)
}

async function fetchCoachProgram(accessToken: string, programId: string): Promise<CoachProgram> {
  const response = await request<{ program: SerializedCoachProgram }>(`/api/coach/programs/${programId}`, accessToken)
  return mapCoachProgram(response.program)
}

async function updateCoachProgram(accessToken: string, programId: string, input: CreateCoachProgramInput) {
  const response = await request<{ program: SerializedCoachProgram }>(`/api/coach/programs/${programId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH",
  })

  return mapCoachProgram(response.program)
}

async function deleteCoachProgram(accessToken: string, programId: string) {
  await request<{ deleted: boolean; id: string }>(`/api/coach/programs/${programId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchCoachTrainees(accessToken: string, options?: { phone?: string }): Promise<CoachTrainee[]> {
  const searchParams = new URLSearchParams()

  if (options?.phone?.trim()) {
    searchParams.set("phone", options.phone.trim())
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ""
  const response = await request<{ trainees: SerializedCoachTrainee[] }>(`/api/coach/trainees${query}`, accessToken)
  return response.trainees.map(mapCoachTrainee)
}

async function fetchCoachTraineeDetail(accessToken: string, traineeId: string): Promise<CoachTraineeDetail> {
  const response = await request<{
    bodyMetrics: SerializedBodyMetricEntry[]
    checkIns: SerializedCoachCheckIn[]
    programs: SerializedCoachProgram[]
    progressSummary: SerializedCoachProgressSummary
    recentLogs: SerializedWorkoutLog[]
    trainee: SerializedCoachTrainee
  }>(`/api/coach/trainees/${traineeId}`, accessToken)

  return {
    bodyMetrics: response.bodyMetrics.map(mapBodyMetricEntry),
    checkIns: response.checkIns.map(mapCoachCheckIn),
    programs: response.programs.map(mapCoachProgram),
    progressSummary: mapCoachProgressSummary(response.progressSummary),
    recentLogs: response.recentLogs.map(mapWorkoutLog),
    trainee: mapCoachTrainee(response.trainee),
  }
}

async function fetchCoachDashboard(accessToken: string): Promise<CoachDashboardData> {
  const response = await request<{
    activityByDay: SerializedCoachDashboardActivityPoint[]
    atRiskTrainees: SerializedCoachTrainee[]
    pendingRequests: SerializedCoachRequest[]
    recentWorkoutLogs: SerializedCoachDashboardRecentWorkoutLog[]
    summary: SerializedCoachDashboardSummary
    trainees: SerializedCoachTrainee[]
  }>("/api/coach/dashboard", accessToken)

  return {
    activityByDay: (response.activityByDay ?? []).map(mapCoachDashboardActivityPoint),
    atRiskTrainees: (response.atRiskTrainees ?? []).map(mapCoachTrainee),
    pendingRequests: (response.pendingRequests ?? []).map((requestItem) => ({
      coachId: requestItem.coachId,
      createdAt: new Date(requestItem.createdAt),
      id: requestItem.id,
      status: requestItem.status,
      trainee: mapAssignedTrainee(requestItem.trainee),
      traineeId: requestItem.traineeId,
    })),
    recentWorkoutLogs: (response.recentWorkoutLogs ?? []).map(mapCoachDashboardRecentWorkoutLog),
    summary: mapCoachDashboardSummary(response.summary),
    trainees: (response.trainees ?? []).map(mapCoachTrainee),
  }
}

async function fetchDiscoverableCoaches(accessToken: string): Promise<DiscoverableCoach[]> {
  const response = await request<{ coaches: SerializedDiscoverableCoach[] }>("/api/coach/discover", accessToken)
  return response.coaches.map(mapDiscoverableCoach)
}

async function createCoachRequest(accessToken: string, coachId: string) {
  const response = await request<SerializedCoachRequestCreate>("/api/coach/requests", accessToken, {
    body: JSON.stringify({
      coachId,
    }),
    method: "POST",
  })

  return {
    coachId: response.request.coachId,
    createdAt: new Date(response.request.createdAt),
    id: response.request.id,
    status: response.request.requestStatus,
    traineeId: response.request.traineeId,
  }
}

async function updateCoachRequestStatus(
  accessToken: string,
  requestId: string,
  status: "approved" | "rejected",
) {
  const response = await request<{ request: SerializedCoachRequest }>(`/api/coach/requests/${requestId}`, accessToken, {
    body: JSON.stringify({
      status,
    }),
    method: "PATCH",
  })

  return {
    coachId: response.request.coachId,
    createdAt: new Date(response.request.createdAt),
    id: response.request.id,
    status: response.request.status,
    trainee: response.request.trainee,
    traineeId: response.request.traineeId,
  }
}

async function assignCoachProgram(accessToken: string, programId: string, traineeId: string) {
  return request<{ assigned: boolean; programId: string; traineeId: string }>(
    `/api/coach/programs/${programId}/assignments`,
    accessToken,
    {
      body: JSON.stringify({
        traineeId,
      }),
      method: "POST",
    },
  )
}

async function adjustCoachProgram(
  accessToken: string,
  programId: string,
  traineeId: string,
  input: CreateCoachProgramInput,
) {
  const response = await request<{ program: SerializedCoachProgram }>(
    `/api/coach/programs/${programId}/adjustments`,
    accessToken,
    {
      body: JSON.stringify({
        ...input,
        traineeId,
      }),
      method: "POST",
    },
  )

  return mapCoachProgram(response.program)
}

async function unassignCoachProgram(accessToken: string, programId: string, traineeId: string) {
  return request<{ deleted: boolean; programId: string; traineeId: string }>(
    `/api/coach/programs/${programId}/assignments/${traineeId}`,
    accessToken,
    {
      method: "DELETE",
    },
  )
}

async function createCoachBodyMetric(
  accessToken: string,
  traineeId: string,
  input: {
    armCm?: number
    bodyFatPct?: number
    chestCm?: number
    hipsCm?: number
    note?: string
    recordedAt?: string
    thighCm?: number
    waistCm?: number
    weightKg?: number
  },
) {
  const response = await request<{ bodyMetric: SerializedBodyMetricEntry }>(
    `/api/coach/trainees/${traineeId}/body-metrics`,
    accessToken,
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  )

  return mapBodyMetricEntry(response.bodyMetric)
}

async function createCoachCheckIn(
  accessToken: string,
  traineeId: string,
  input: {
    adherenceScore?: number
    checkInDate?: string
    energyScore?: number
    feedback: string
    moodScore?: number
    nextFocus?: string
    recoveryScore?: number
    summary?: string
  },
) {
  const response = await request<{ checkIn: SerializedCoachCheckIn }>(
    `/api/coach/trainees/${traineeId}/check-ins`,
    accessToken,
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  )

  return mapCoachCheckIn(response.checkIn)
}

async function fetchCoachWorkoutLogs(
  accessToken: string,
  traineeId: string,
  options?: { cursor?: string; from?: string; limit?: number; to?: string; weekStart?: string },
): Promise<CoachWorkoutLogPage> {
  const searchParams = new URLSearchParams()

  if (options?.cursor) {
    searchParams.set("cursor", options.cursor)
  }

  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    searchParams.set("limit", String(options.limit))
  }

  if (options?.weekStart) {
    searchParams.set("weekStart", options.weekStart)
  }

  if (options?.from) {
    searchParams.set("from", options.from)
  }

  if (options?.to) {
    searchParams.set("to", options.to)
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : ""
  const response = await request<{ logs: SerializedWorkoutLog[]; nextCursor?: string }>(
    `/api/coach/trainees/${traineeId}/workout-logs${query}`,
    accessToken,
    { next: { revalidate: 10 } },
  )

  return {
    logs: (response.logs ?? []).map(mapWorkoutLog),
    nextCursor: response.nextCursor,
  }
}

async function createCoachWorkoutLogComment(accessToken: string, workoutLogId: string, content: string) {
  const response = await request<{ comment: SerializedWorkoutLogComment }>(
    `/api/coach/workout-logs/${workoutLogId}/comments`,
    accessToken,
    {
      body: JSON.stringify({ content }),
      method: "POST",
    },
  )

  return {
    authorAvatar: response.comment.authorAvatar,
    authorId: response.comment.authorId,
    authorName: response.comment.authorName,
    content: response.comment.content,
    createdAt: new Date(response.comment.createdAt),
    id: response.comment.id,
    updatedAt: new Date(response.comment.updatedAt),
  }
}

async function updateCoachWorkoutLogComment(accessToken: string, commentId: string, content: string) {
  const response = await request<{ comment: SerializedWorkoutLogComment }>(
    `/api/coach/workout-log-comments/${commentId}`,
    accessToken,
    {
      body: JSON.stringify({ content }),
      method: "PATCH",
    },
  )

  return {
    authorAvatar: response.comment.authorAvatar,
    authorId: response.comment.authorId,
    authorName: response.comment.authorName,
    content: response.comment.content,
    createdAt: new Date(response.comment.createdAt),
    id: response.comment.id,
    updatedAt: new Date(response.comment.updatedAt),
  }
}

async function deleteCoachWorkoutLogComment(accessToken: string, commentId: string) {
  return request<{ deleted: boolean; id: string }>(`/api/coach/workout-log-comments/${commentId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchCoachExercises(accessToken: string, search?: string): Promise<CoachExercise[]> {
  const response = await request<{ exercises: SerializedCoachExercise[] }>(
    `/api/coach/exercises${buildSearchQuery(search)}`,
    accessToken,
    {
      cache: "no-store",
    },
  )

  return (response.exercises ?? []).map(mapCoachExercise)
}

async function createCoachExerciseRequest(accessToken: string, input: CoachExerciseInput) {
  const response = await request<{ exercise: SerializedCoachExercise }>("/api/coach/exercises", accessToken, {
    body: JSON.stringify(input),
    method: "POST",
  })

  return mapCoachExercise(response.exercise)
}

async function updateCoachExerciseRequest(accessToken: string, exerciseId: string, input: CoachExerciseInput) {
  const response = await request<{ exercise: SerializedCoachExercise }>(
    `/api/coach/exercises/${exerciseId}`,
    accessToken,
    {
      body: JSON.stringify(input),
      method: "PATCH",
    },
  )

  return mapCoachExercise(response.exercise)
}

async function deleteCoachExerciseRequest(accessToken: string, exerciseId: string) {
  return request<{ deleted: boolean; id: string }>(`/api/coach/exercises/${exerciseId}`, accessToken, {
    method: "DELETE",
  })
}

async function fetchCoachExerciseImportRequests(accessToken: string): Promise<CoachExerciseImportRequest[]> {
  const response = await request<{ requests: SerializedCoachExerciseImportRequest[] }>(
    "/api/coach/exercise-import-requests",
    accessToken,
    {
      cache: "no-store",
    },
  )

  return response.requests.map(mapCoachExerciseImportRequest)
}

async function submitCoachExerciseImportRequest(
  accessToken: string,
  input: {
    fileName?: string
    rows: CoachExerciseImportRow[]
  },
) {
  const response = await request<{ request: SerializedCoachExerciseImportRequest }>(
    "/api/coach/exercise-import-requests",
    accessToken,
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  )

  return mapCoachExerciseImportRequest(response.request)
}

async function fetchNotifications(accessToken: string, limit = 20): Promise<NotificationList> {
  let response: { notifications: SerializedNotification[]; unreadCount: number }

  try {
    response = await request<{ notifications: SerializedNotification[]; unreadCount: number }>(
      `/api/notifications?limit=${encodeURIComponent(String(limit))}`,
      accessToken,
      { next: { revalidate: 5 } },
    )
  } catch (error) {
    // Older backend deployments may not expose notifications yet.
    if (error instanceof ApiError && error.status === 404) {
      return {
        notifications: [],
        unreadCount: 0,
      }
    }

    throw error
  }

  return {
    notifications: (response.notifications ?? []).map(mapNotification),
    unreadCount: response.unreadCount ?? 0,
  }
}

async function markNotificationRead(accessToken: string, notificationId: string) {
  const response = await request<{ notification: SerializedNotification }>(
    `/api/notifications/${notificationId}/read`,
    accessToken,
    {
      method: "PATCH",
    },
  )

  return mapNotification(response.notification)
}

async function markAllNotificationsRead(accessToken: string) {
  return request<{ updatedCount: number }>("/api/notifications/read-all", accessToken, {
    method: "POST",
  })
}

export {
  adjustCoachProgram,
  assignCoachProgram,
  createCoachExerciseRequest,
  createCoachBodyMetric,
  createCoachCheckIn,
  createCoachRequest,
  createCoachProgram,
  createCoachWorkoutLogComment,
  createCustomFood,
  createWeightEntry,
  createWorkout,
  createWorkoutLog,
  addMealItem,
  deleteCoachExerciseRequest,
  deleteCoachWorkoutLogComment,
  deleteWorkout,
  deleteWorkoutLog,
  deleteMealItem,
  deleteCoachProgram,
  fetchFoods,
  fetchCoachExercises,
  fetchProgressAnalytics,
  fetchProgressCalendar,
  fetchProgressYearView,
  fetchWeightEntries,
  fetchWorkoutLogDetail,
  fetchDiscoverableCoaches,
  fetchCoachDashboard,
  fetchCoachExerciseImportRequests,
  fetchCoachProgram,
  fetchCoachPrograms,
  fetchCoachTraineeDetail,
  fetchCoachWorkoutLogs,
  fetchCoachTrainees,
  fetchExerciseLibrary,
  fetchExercises,
  fetchDashboard,
  fetchNutritionDay,
  fetchNotifications,
  submitCoachExerciseImportRequest,
  fetchWorkoutDetail,
  fetchWorkoutLogsForExport,
  fetchWorkouts,
  markAllNotificationsRead,
  markNotificationRead,
  unassignCoachProgram,
  updateCoachExerciseRequest,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateCoachWorkoutLogComment,
  updateWorkout,
}
