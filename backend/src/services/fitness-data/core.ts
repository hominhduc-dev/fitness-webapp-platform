import {
  $Enums,
  Prisma,
  type BodyMetricEntry,
  CoachRequestStatus,
  type CoachCheckIn,
  NotificationStatus,
  NotificationType,
  ProgramDifficulty,
  UserRole,
  WorkoutKind,
  type Exercise,
  type ExerciseSet,
  type Meal,
  type Notification,
  type User,
  type Variation,
} from "@prisma/client"

import { AuthServiceError, type SerializedProfile } from "../auth.service"
import { MEAL_WITH_FOOD_INCLUDE, serializeMealRecord } from "../meal-log.service"
import { prisma, retryTransaction } from "../../lib/prisma"

const WORKOUT_EXERCISE_INCLUDE = {
  sets: {
    orderBy: {
      setNumber: "asc",
    },
  },
  variation: {
    include: {
      exercise: true,
    },
  },
} satisfies Prisma.WorkoutExerciseInclude

const WORKOUT_INCLUDE = {
  exercises: {
    include: WORKOUT_EXERCISE_INCLUDE,
    orderBy: {
      order: "asc",
    },
  },
} satisfies Prisma.WorkoutInclude

const WORKOUT_WITH_PROGRAM_INCLUDE = {
  ...WORKOUT_INCLUDE,
  program: true,
} satisfies Prisma.WorkoutInclude

const WORKOUT_LOG_COMMENT_INCLUDE = {
  author: true,
} satisfies Prisma.WorkoutLogCommentInclude

const WORKOUT_LOG_INCLUDE = {
  comments: {
    include: WORKOUT_LOG_COMMENT_INCLUDE,
    orderBy: {
      createdAt: "asc",
    },
  },
  workout: {
    include: WORKOUT_INCLUDE,
  },
} satisfies Prisma.WorkoutLogInclude

const PROGRAM_INCLUDE = {
  assignments: {
    include: {
      user: true,
    },
  },
  workouts: {
    include: WORKOUT_INCLUDE,
    orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ProgramInclude

type WorkoutExerciseRecord = Prisma.WorkoutExerciseGetPayload<{
  include: typeof WORKOUT_EXERCISE_INCLUDE
}>

type WorkoutRecord = Prisma.WorkoutGetPayload<{
  include: typeof WORKOUT_INCLUDE
}>

type WorkoutWithProgramRecord = Prisma.WorkoutGetPayload<{
  include: typeof WORKOUT_WITH_PROGRAM_INCLUDE
}>

type WorkoutLogCommentRecord = Prisma.WorkoutLogCommentGetPayload<{
  include: typeof WORKOUT_LOG_COMMENT_INCLUDE
}>

type ProgramRecord = Prisma.ProgramGetPayload<{
  include: typeof PROGRAM_INCLUDE
}>

type WorkoutLogRecord = Prisma.WorkoutLogGetPayload<{
  include: typeof WORKOUT_LOG_INCLUDE
}>

type CoachExerciseRecord = Prisma.ExerciseGetPayload<{
  include: {
    createdBy: true
    variations: {
      include: {
        _count: {
          select: {
            workoutExercises: true
          }
        }
      }
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }
  }
}>

type NotificationRecord = Notification

type ProgressAnalyticsLogRecord = {
  exerciseSnapshot: Prisma.JsonValue | null
  startedAt: Date
  totalVolume: number | null
}

type PreviousSetPerformanceSource = "most_recent" | "same_weekday_last_week"

type PreviousExerciseSetPerformance = {
  completedAt: Date
  reps?: number
  source: PreviousSetPerformanceSource
  weight?: number
}

type WorkoutLogSnapshotSet = {
  actualReps?: number | null
  completed?: boolean
  setNumber?: number | null
  targetRepsMin?: number | null
  targetReps?: number | null
  weight?: number | null
}

type WorkoutLogSnapshotExercise = {
  exercise?: {
    id?: string | null
    muscleGroup?: string | null
    name?: string | null
  } | null
  variation?: {
    id?: string | null
    isDefault?: boolean | null
    name?: string | null
  } | null
  sets?: WorkoutLogSnapshotSet[] | null
}

type BodyMetricRecord = BodyMetricEntry & {
  coach: User | null
}

type CoachCheckInRecord = CoachCheckIn & {
  coach: User
}

type PersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    repsMin?: number
    variationId: string
    reps: number
    restTime?: number
    sets: number
    weight?: number
  }>
  kind?: string | null
  name: string
  notes?: string | null
  scheduledDay?: number
  scheduledDate?: string
}

type NormalizedPersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    repsMin?: number
    variationId: string
    reps: number
    restTime?: number
    sets: number
    weight?: number
  }>
  kind?: $Enums.WorkoutKind
  name: string
  notes?: string
  scheduledDay?: number
  scheduledDate?: Date
}

const DEFAULT_CALORIE_TARGET = 2500
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_IN_MS = 24 * 60 * 60 * 1000
const PROGRESS_SERIES_COLORS = ["#22C55E", "#2563EB", "#F43F5E"]
const PROGRESS_PIE_COLORS = ["#2563EB", "#22C55E", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4"]
const DEFAULT_EXERCISES = [
  { equipment: "Barbell", muscleGroup: "Chest", name: "Bench Press" },
  { equipment: "Barbell", muscleGroup: "Legs", name: "Back Squat" },
  { equipment: "Barbell", muscleGroup: "Back", name: "Deadlift" },
  { equipment: "Dumbbell", muscleGroup: "Shoulders", name: "Shoulder Press" },
  { equipment: "Cable", muscleGroup: "Back", name: "Lat Pulldown" },
  { equipment: "Machine", muscleGroup: "Legs", name: "Leg Press" },
  { equipment: "Dumbbell", muscleGroup: "Chest", name: "Incline Dumbbell Press" },
  { equipment: "Cable", muscleGroup: "Arms", name: "Tricep Pushdown" },
  { equipment: "Dumbbell", muscleGroup: "Arms", name: "Bicep Curl" },
  { equipment: "Bodyweight", muscleGroup: "Core", name: "Plank" },
]

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function assertCoach(profile: SerializedProfile) {
  if (profile.role !== UserRole.coach) {
    throw new AuthServiceError("Chỉ coach mới có quyền truy cập dữ liệu này.", 403)
  }
}

function assertTrainee(profile: SerializedProfile) {
  if (profile.role !== UserRole.trainee) {
    throw new AuthServiceError("Chỉ trainee mới có quyền truy cập dữ liệu này.", 403)
  }
}

function toDateRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(-1)

  return { end, start }
}

function toRecentWindow(days: number) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  return { end, start }
}

function serializeExerciseBase(exercise: Exercise) {
  return {
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
  }
}

function serializeMiniUser(user: Pick<User, "avatar" | "email" | "id" | "name">) {
  return {
    avatar: user.avatar,
    email: user.email,
    id: user.id,
    name: user.name,
  }
}

function serializeVariation(variation: Variation) {
  return {
    equipment: variation.equipment ?? undefined,
    id: variation.id,
    isDefault: variation.isDefault,
    metadata:
      variation.metadata && typeof variation.metadata === "object" && !Array.isArray(variation.metadata)
        ? (variation.metadata as Record<string, unknown>)
        : undefined,
    name: variation.name,
    sortOrder: variation.sortOrder,
  }
}

function getExerciseSourceForProfile(createdById: string | null | undefined, profile?: SerializedProfile) {
  const source = createdById ? "coach" : "system"

  return {
    canManage: Boolean(profile && createdById && profile.id === createdById),
    source,
  } as const
}

function canProfileAccessExercise(createdById: string | null | undefined, profile?: SerializedProfile) {
  if (!createdById) {
    return true
  }

  return profile?.role === UserRole.coach
}

function serializeVariationOption(
  variation: Variation & { exercise: Exercise & { createdById?: string | null } },
  profile?: SerializedProfile,
) {
  const visibility = getExerciseSourceForProfile(variation.exercise.createdById, profile)

  return {
    canManage: visibility.canManage,
    createdById: variation.exercise.createdById ?? undefined,
    equipment: variation.equipment ?? undefined,
    exerciseId: variation.exerciseId,
    exerciseName: variation.exercise.name,
    id: variation.id,
    isDefault: variation.isDefault,
    metadata:
      variation.metadata && typeof variation.metadata === "object" && !Array.isArray(variation.metadata)
        ? (variation.metadata as Record<string, unknown>)
        : undefined,
    muscleGroup: variation.exercise.muscleGroup,
    name: variation.isDefault ? variation.exercise.name : `${variation.exercise.name} (${variation.name})`,
    source: visibility.source,
    sortOrder: variation.sortOrder,
    variationName: variation.name,
  }
}

function serializePreviousSetPerformance(previousPerformance: PreviousExerciseSetPerformance) {
  return {
    completedAt: previousPerformance.completedAt,
    reps: previousPerformance.reps,
    source: previousPerformance.source,
    weight: previousPerformance.weight,
  }
}

function serializeExerciseSet(set: ExerciseSet, previousPerformanceBySetNumber?: Map<number, PreviousExerciseSetPerformance>) {
  const previousPerformance = previousPerformanceBySetNumber?.get(set.setNumber)

  return {
    actualReps: set.actualReps ?? undefined,
    completed: set.completed,
    id: set.id,
    notes: set.notes ?? undefined,
    previousPerformance: previousPerformance ? serializePreviousSetPerformance(previousPerformance) : undefined,
    rir: set.rir ?? undefined,
    setNumber: set.setNumber,
    targetRepsMin: set.targetRepsMin ?? undefined,
    targetReps: set.targetReps,
    weight: set.weight ?? undefined,
  }
}

function serializeWorkout(
  workout: WorkoutRecord,
  options?: {
    isPersonal?: boolean
    previousPerformanceByWorkoutExerciseId?: Map<string, Map<number, PreviousExerciseSetPerformance>>
  },
) {
  return {
    duration: workout.duration ?? undefined,
    exercises: workout.exercises
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((workoutExercise) => ({
        exercise: serializeExerciseBase(workoutExercise.variation.exercise),
        id: workoutExercise.id,
        notes: workoutExercise.notes ?? undefined,
        restTime: workoutExercise.restTime ?? undefined,
        sets: workoutExercise.sets
          .slice()
          .sort((left, right) => left.setNumber - right.setNumber)
          .map((set) => serializeExerciseSet(set, options?.previousPerformanceByWorkoutExerciseId?.get(workoutExercise.id))),
        variation: serializeVariation(workoutExercise.variation),
      })),
    id: workout.id,
    isPersonal: options?.isPersonal ?? false,
    kind: workout.kind ?? undefined,
    name: workout.name,
    notes: workout.notes ?? undefined,
    scheduledDay: workout.scheduledDay ?? undefined,
    scheduledDate: workout.scheduledDate ? formatUtcDateOnly(workout.scheduledDate) : undefined,
  }
}

function roundMealValue(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function serializeProgram(program: ProgramRecord) {
  return {
    assignedTo: program.assignments.map((assignment) => assignment.userId),
    assignedTrainees: program.assignments.map((assignment) => ({
      avatar: assignment.user.avatar,
      email: assignment.user.email,
      fitnessGoals: assignment.user.fitnessGoals,
      id: assignment.user.id,
      name: assignment.user.name,
    })),
    createdAt: program.createdAt,
    createdBy: program.createdById,
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts
      .slice()
      .sort((left, right) => (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7))
      .map((workout) => serializeWorkout(workout)),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function serializeCoachRequest(request: {
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: User
  traineeId: string
}) {
  return {
    coachId: request.coachId,
    createdAt: request.createdAt,
    id: request.id,
    status: request.status,
    trainee: {
      avatar: request.trainee.avatar,
      email: request.trainee.email,
      fitnessGoals: request.trainee.fitnessGoals,
      id: request.trainee.id,
      name: request.trainee.name,
    },
    traineeId: request.traineeId,
  }
}

function serializeBodyMetricEntry(entry: BodyMetricRecord) {
  return {
    armCm: entry.armCm ?? undefined,
    bodyFatPct: entry.bodyFatPct ?? undefined,
    chestCm: entry.chestCm ?? undefined,
    coachId: entry.coachId ?? undefined,
    coachName: entry.coach?.name ?? undefined,
    createdAt: entry.createdAt,
    hipsCm: entry.hipsCm ?? undefined,
    id: entry.id,
    note: entry.note ?? undefined,
    recordedAt: entry.recordedAt,
    thighCm: entry.thighCm ?? undefined,
    waistCm: entry.waistCm ?? undefined,
    weightKg: entry.weightKg ?? undefined,
  }
}

function serializeCoachCheckIn(entry: CoachCheckInRecord) {
  return {
    adherenceScore: entry.adherenceScore ?? undefined,
    checkInDate: entry.checkInDate,
    coachId: entry.coachId,
    coachName: entry.coach.name,
    createdAt: entry.createdAt,
    energyScore: entry.energyScore ?? undefined,
    feedback: entry.feedback,
    id: entry.id,
    moodScore: entry.moodScore ?? undefined,
    nextFocus: entry.nextFocus ?? undefined,
    recoveryScore: entry.recoveryScore ?? undefined,
    summary: entry.summary ?? undefined,
  }
}

function serializeWorkoutLogComment(comment: WorkoutLogCommentRecord) {
  return {
    authorAvatar: comment.author.avatar ?? undefined,
    authorId: comment.authorId,
    authorName: comment.author.name,
    content: comment.content,
    createdAt: comment.createdAt,
    id: comment.id,
    updatedAt: comment.updatedAt,
  }
}

function serializeWorkoutLog(log: WorkoutLogRecord) {
  const snapshotWorkout =
    log.workoutSnapshot && typeof log.workoutSnapshot === "object" && !Array.isArray(log.workoutSnapshot)
      ? (log.workoutSnapshot as {
          duration?: number
          id?: string
          name?: string
          notes?: string
          scheduledDate?: string
          scheduledDay?: number
        })
      : null

  const snapshotExercises =
    Array.isArray(log.exerciseSnapshot)
      ? (log.exerciseSnapshot as ReturnType<typeof serializeWorkout>["exercises"])
      : null

  return {
    comments: (log.comments ?? []).map((comment) => serializeWorkoutLogComment(comment as WorkoutLogCommentRecord)),
    completedAt: log.completedAt,
    exercises: snapshotExercises ?? (log.workout ? serializeWorkout(log.workout).exercises : []),
    id: log.id,
    notes: log.notes ?? undefined,
    startedAt: log.startedAt,
    totalVolume: log.totalVolume ?? undefined,
    workout: log.workout
      ? serializeWorkout(log.workout)
      : {
          duration: snapshotWorkout?.duration,
          exercises: snapshotExercises ?? [],
          id: snapshotWorkout?.id ?? log.workoutId ?? log.id,
          name: snapshotWorkout?.name ?? "Workout",
          notes: snapshotWorkout?.notes,
          scheduledDate: snapshotWorkout?.scheduledDate,
          scheduledDay: snapshotWorkout?.scheduledDay,
        },
  }
}

function serializeNotification(notification: NotificationRecord) {
  return {
    createdAt: notification.createdAt,
    id: notification.id,
    message: notification.message,
    metadata:
      notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
        ? (notification.metadata as Record<string, unknown>)
        : undefined,
    readAt: notification.readAt ?? undefined,
    relatedEntityId: notification.relatedEntityId ?? undefined,
    relatedEntityType: notification.relatedEntityType ?? undefined,
    scheduledFor: notification.scheduledFor,
    status: notification.status,
    title: notification.title,
    type: notification.type,
  }
}

function serializeCoachExercise(exercise: CoachExerciseRecord, profile: SerializedProfile) {
  const defaultVariation = exercise.variations.find((variation) => variation.isDefault) ?? exercise.variations[0]
  const usageCount = exercise.variations.reduce(
    (sum, variation) => sum + variation._count.workoutExercises,
    0,
  )
  const visibility = getExerciseSourceForProfile(exercise.createdById, profile)

  return {
    canManage: visibility.canManage,
    createdAt: exercise.createdAt,
    createdById: exercise.createdById ?? undefined,
    createdByName: exercise.createdBy?.name ?? undefined,
    equipment: defaultVariation?.equipment ?? undefined,
    id: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    source: visibility.source,
    updatedAt: exercise.updatedAt,
    usageCount,
    variationId: defaultVariation?.id,
    variationName: defaultVariation?.name ?? "Default",
  }
}

function buildWeeklyCaloriesChart(meals: Array<Pick<Meal, "calories" | "recordedAt">>, targetCalories = DEFAULT_CALORIE_TARGET) {
  const { start } = toRecentWindow(7)
  const totals = new Map<string, number>()

  meals.forEach((meal) => {
    const key = meal.recordedAt.toISOString().slice(0, 10)
    totals.set(key, (totals.get(key) ?? 0) + meal.calories)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    const key = date.toISOString().slice(0, 10)

    return {
      calories: totals.get(key) ?? 0,
      day: DAY_LABELS[date.getDay()],
      target: targetCalories,
    }
  })
}

function calculateWorkoutVolume(exercises: Array<{ sets?: Array<{ actualReps?: number; completed?: boolean; targetReps?: number; weight?: number }> }>) {
  return exercises.reduce((volumeTotal, exercise) => {
    const setVolume = (exercise.sets ?? []).reduce((setTotal, set) => {
      if (!set.completed || !set.weight) {
        return setTotal
      }

      const reps = set.actualReps ?? set.targetReps ?? 0
      return setTotal + set.weight * reps
    }, 0)

  return volumeTotal + setVolume
  }, 0)
}

function formatUtcDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toUtcDayStart(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function getUtcMonthBounds(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1))
  return { end, start }
}

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  start.setUTCDate(start.getUTCDate() + offset)
  return start
}

function formatMonthDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date)
}

function formatWeekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date)
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function normalizeRepTarget(reps: number, repsMin?: number | null, contextLabel?: string) {
  const normalizedReps = Number.isFinite(reps) ? Math.max(1, Math.round(reps)) : 1

  if (repsMin == null) {
    return {
      reps: normalizedReps,
    }
  }

  if (!Number.isFinite(repsMin)) {
    throw new AuthServiceError(
      `${contextLabel ? `${contextLabel}: ` : ""}Khoảng reps không hợp lệ. Giá trị bắt đầu phải là số nguyên dương.`,
      400,
    )
  }

  const normalizedRepsMin = Math.max(1, Math.round(repsMin))

  if (normalizedRepsMin >= normalizedReps) {
    throw new AuthServiceError(
      `${contextLabel ? `${contextLabel}: ` : ""}Khoảng reps không hợp lệ. Giá trị bắt đầu phải nhỏ hơn giá trị kết thúc.`,
      400,
    )
  }

  return {
    reps: normalizedReps,
    repsMin: normalizedRepsMin,
  }
}

function parseWorkoutLogSnapshotExercises(snapshot: Prisma.JsonValue | null) {
  if (!Array.isArray(snapshot)) {
    return [] as WorkoutLogSnapshotExercise[]
  }

  return snapshot
    .filter((item): item is WorkoutLogSnapshotExercise => typeof item === "object" && item !== null)
}

function getSnapshotExerciseId(exercise: WorkoutLogSnapshotExercise) {
  const exerciseId = exercise.exercise?.id?.trim()
  return exerciseId || undefined
}

function getSnapshotExerciseName(exercise: WorkoutLogSnapshotExercise) {
  const baseName = exercise.exercise?.name?.trim()

  if (!baseName) {
    return undefined
  }

  const variationName = exercise.variation?.name?.trim()
  const isDefaultVariation =
    exercise.variation?.isDefault === true || !variationName || variationName.toLowerCase() === "default"

  if (isDefaultVariation) {
    return baseName
  }

  return `${baseName} (${variationName})`
}

function getSnapshotVariationId(exercise: WorkoutLogSnapshotExercise) {
  const variationId = exercise.variation?.id?.trim()
  return variationId || undefined
}

function getSnapshotMuscleGroup(exercise: WorkoutLogSnapshotExercise) {
  const muscleGroup = exercise.exercise?.muscleGroup?.trim()
  return muscleGroup || undefined
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function parseScheduledDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return undefined
  }

  const parsedDate = new Date(`${trimmedValue}T00:00:00.000Z`)

  if (Number.isNaN(parsedDate.getTime()) || formatUtcDateOnly(parsedDate) !== trimmedValue) {
    return undefined
  }

  return parsedDate
}

function parseLocalDateInput(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return undefined
  }

  const [yearText, monthText, dayText] = trimmedValue.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsedDate = new Date(year, month - 1, day, 0, 0, 0, 0)

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }

  return parsedDate
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getSnapshotMaxWeight(exercise: WorkoutLogSnapshotExercise) {
  let maxWeight: number | undefined

  for (const set of exercise.sets ?? []) {
    if (set?.completed === false) {
      continue
    }

    const weight = toFiniteNumber(set?.weight)

    if (weight == null || weight <= 0) {
      continue
    }

    maxWeight = maxWeight == null ? weight : Math.max(maxWeight, weight)
  }

  return maxWeight
}

function matchesWorkoutHistoryExercise(snapshotExercise: WorkoutLogSnapshotExercise, workoutExercise: WorkoutExerciseRecord) {
  const snapshotVariationId = getSnapshotVariationId(snapshotExercise)

  if (snapshotVariationId) {
    return snapshotVariationId === workoutExercise.variation.id
  }

  const snapshotExerciseId = getSnapshotExerciseId(snapshotExercise)

  return workoutExercise.variation.isDefault && snapshotExerciseId === workoutExercise.variation.exercise.id
}

function buildPreviousSetPerformanceMap(
  snapshotExercise: WorkoutLogSnapshotExercise,
  log: { completedAt: Date | null; startedAt: Date },
  source: PreviousSetPerformanceSource,
) {
  const previousPerformanceBySetNumber = new Map<number, PreviousExerciseSetPerformance>()

  ;(snapshotExercise.sets ?? []).forEach((snapshotSet, index) => {
    if (!snapshotSet || snapshotSet.completed === false) {
      return
    }

    const parsedSetNumber = toFiniteNumber(snapshotSet.setNumber)
    const setNumber = parsedSetNumber != null ? Math.max(1, Math.round(parsedSetNumber)) : index + 1
    const reps = toFiniteNumber(snapshotSet.actualReps) ?? toFiniteNumber(snapshotSet.targetReps)
    const weight = toFiniteNumber(snapshotSet.weight)

    if (reps == null && weight == null) {
      return
    }

    previousPerformanceBySetNumber.set(setNumber, {
      completedAt: log.completedAt ?? log.startedAt,
      reps,
      source,
      weight,
    })
  })

  return previousPerformanceBySetNumber
}

async function buildPreviousSetPerformanceByWorkoutExercise(
  profileId: string,
  workoutExercises: WorkoutExerciseRecord[],
  referenceDate = new Date(),
) {
  if (workoutExercises.length === 0) {
    return new Map<string, Map<number, PreviousExerciseSetPerformance>>()
  }

  const db = ensurePrisma()
  const previousWeekdayStart = startOfUtcDay(addUtcDays(referenceDate, -7))
  const previousWeekdayEnd = addUtcDays(previousWeekdayStart, 1)
  const fallbackByWorkoutExerciseId = new Map<string, Map<number, PreviousExerciseSetPerformance>>()
  const preferredByWorkoutExerciseId = new Map<string, Map<number, PreviousExerciseSetPerformance>>()
  let skip = 0

  while (true) {
    const logs = await db.workoutLog.findMany({
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
      select: {
        completedAt: true,
        exerciseSnapshot: true,
        startedAt: true,
      },
      skip,
      take: 50,
      where: {
        startedAt: {
          lt: referenceDate,
        },
        userId: profileId,
      },
    })

    if (logs.length === 0) {
      break
    }

    for (const log of logs) {
      const snapshotExercises = parseWorkoutLogSnapshotExercises(log.exerciseSnapshot)
      const isPreviousWeekdayLog = log.startedAt >= previousWeekdayStart && log.startedAt < previousWeekdayEnd

      for (const workoutExercise of workoutExercises) {
        const workoutExerciseId = workoutExercise.id

        if (preferredByWorkoutExerciseId.has(workoutExerciseId) && fallbackByWorkoutExerciseId.has(workoutExerciseId)) {
          continue
        }

        const matchingSnapshotExercise = snapshotExercises.find((snapshotExercise) =>
          matchesWorkoutHistoryExercise(snapshotExercise, workoutExercise),
        )

        if (!matchingSnapshotExercise) {
          continue
        }

        if (!fallbackByWorkoutExerciseId.has(workoutExerciseId)) {
          const fallbackPerformance = buildPreviousSetPerformanceMap(matchingSnapshotExercise, log, "most_recent")

          if (fallbackPerformance.size > 0) {
            fallbackByWorkoutExerciseId.set(workoutExerciseId, fallbackPerformance)
          }
        }

        if (isPreviousWeekdayLog && !preferredByWorkoutExerciseId.has(workoutExerciseId)) {
          const preferredPerformance = buildPreviousSetPerformanceMap(
            matchingSnapshotExercise,
            log,
            "same_weekday_last_week",
          )

          if (preferredPerformance.size > 0) {
            preferredByWorkoutExerciseId.set(workoutExerciseId, preferredPerformance)
          }
        }
      }
    }

    const allWorkoutExercisesResolved = workoutExercises.every(
      (workoutExercise) =>
        preferredByWorkoutExerciseId.has(workoutExercise.id) || fallbackByWorkoutExerciseId.has(workoutExercise.id),
    )
    const oldestLoadedLog = logs[logs.length - 1]

    if (allWorkoutExercisesResolved && oldestLoadedLog.startedAt < previousWeekdayStart) {
      break
    }

    skip += logs.length
  }

  return workoutExercises.reduce<Map<string, Map<number, PreviousExerciseSetPerformance>>>((accumulator, workoutExercise) => {
    const preferredPerformance = preferredByWorkoutExerciseId.get(workoutExercise.id)
    const fallbackPerformance = fallbackByWorkoutExerciseId.get(workoutExercise.id)

    if (preferredPerformance || fallbackPerformance) {
      const mergedPerformance = new Map<number, PreviousExerciseSetPerformance>()

      fallbackPerformance?.forEach((performance, setNumber) => {
        mergedPerformance.set(setNumber, performance)
      })

      preferredPerformance?.forEach((performance, setNumber) => {
        mergedPerformance.set(setNumber, performance)
      })

      accumulator.set(workoutExercise.id, mergedPerformance)
    }

    return accumulator
  }, new Map<string, Map<number, PreviousExerciseSetPerformance>>())
}

function calculateWorkoutStreaks(logs: ProgressAnalyticsLogRecord[]) {
  const workoutDays = Array.from(new Set(logs.map((log) => toUtcDayStart(log.startedAt)))).sort((left, right) => left - right)

  if (workoutDays.length === 0) {
    return {
      bestStreakDays: 0,
      currentStreakDays: 0,
    }
  }

  let bestStreakDays = 1
  let runningStreak = 1

  for (let index = 1; index < workoutDays.length; index += 1) {
    if (workoutDays[index] - workoutDays[index - 1] === DAY_IN_MS) {
      runningStreak += 1
    } else {
      runningStreak = 1
    }

    bestStreakDays = Math.max(bestStreakDays, runningStreak)
  }

  let currentStreakDays = 0
  const latestWorkoutDay = workoutDays[workoutDays.length - 1]
  const today = toUtcDayStart(new Date())

  if (today - latestWorkoutDay <= DAY_IN_MS) {
    currentStreakDays = 1

    for (let index = workoutDays.length - 1; index > 0; index -= 1) {
      if (workoutDays[index] - workoutDays[index - 1] !== DAY_IN_MS) {
        break
      }

      currentStreakDays += 1
    }
  }

  return {
    bestStreakDays,
    currentStreakDays,
  }
}

function buildWeeklyVolume(logs: ProgressAnalyticsLogRecord[]) {
  const today = toUtcDayStart(new Date())
  const startDay = today - 6 * DAY_IN_MS
  const totalsByDay = new Map<number, number>()

  logs.forEach((log) => {
    const dayStart = toUtcDayStart(log.startedAt)

    if (dayStart < startDay || dayStart > today) {
      return
    }

    totalsByDay.set(dayStart, (totalsByDay.get(dayStart) ?? 0) + (log.totalVolume ?? 0))
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const dayStart = startDay + index * DAY_IN_MS

    return {
      day: formatWeekdayLabel(new Date(dayStart)),
      volume: Math.round((totalsByDay.get(dayStart) ?? 0) * 10) / 10,
    }
  })
}

function buildMuscleGroupDistribution(logs: ProgressAnalyticsLogRecord[]) {
  const muscleGroupCounts = new Map<string, number>()

  logs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const muscleGroup = getSnapshotMuscleGroup(exercise)

      if (!muscleGroup) {
        return
      }

      muscleGroupCounts.set(muscleGroup, (muscleGroupCounts.get(muscleGroup) ?? 0) + 1)
    })
  })

  const totalExercises = Array.from(muscleGroupCounts.values()).reduce((sum, count) => sum + count, 0)

  if (totalExercises === 0) {
    return [] as Array<{ fill: string; name: string; value: number }>
  }

  return Array.from(muscleGroupCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count], index) => ({
      fill: PROGRESS_PIE_COLORS[index % PROGRESS_PIE_COLORS.length],
      name,
      value: Math.round((count / totalExercises) * 100),
    }))
}

function buildPersonalRecords(logs: ProgressAnalyticsLogRecord[]) {
  const recordByExercise = new Map<string, { date: Date; weight: number }>()

  logs.forEach((log) => {
    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const weight = getSnapshotMaxWeight(exercise)

      if (!exerciseName || weight == null) {
        return
      }

      const existingRecord = recordByExercise.get(exerciseName)

      if (
        !existingRecord ||
        weight > existingRecord.weight ||
        (weight === existingRecord.weight && log.startedAt.getTime() > existingRecord.date.getTime())
      ) {
        recordByExercise.set(exerciseName, {
          date: log.startedAt,
          weight,
        })
      }
    })
  })

  return Array.from(recordByExercise.entries())
    .map(([exercise, record]) => ({
      date: record.date,
      exercise,
      weight: record.weight,
    }))
    .sort((left, right) => right.weight - left.weight || right.date.getTime() - left.date.getTime())
    .slice(0, 4)
}

function buildStrengthProgression(logs: ProgressAnalyticsLogRecord[]) {
  const currentWeekStart = startOfUtcWeek(new Date())
  const weekStarts = Array.from({ length: 6 }, (_value, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - (5 - index) * 7)
    return weekStart
  })

  const firstWeekStart = weekStarts[0]?.getTime() ?? 0
  const weeklyExerciseMax = new Map<string, Map<string, number>>()

  logs.forEach((log) => {
    const weekStart = startOfUtcWeek(log.startedAt)

    if (weekStart.getTime() < firstWeekStart) {
      return
    }

    const weekKey = weekStart.toISOString().slice(0, 10)
    const weekBucket = weeklyExerciseMax.get(weekKey) ?? new Map<string, number>()

    parseWorkoutLogSnapshotExercises(log.exerciseSnapshot).forEach((exercise) => {
      const exerciseName = getSnapshotExerciseName(exercise)
      const weight = getSnapshotMaxWeight(exercise)

      if (!exerciseName || weight == null) {
        return
      }

      weekBucket.set(exerciseName, Math.max(weekBucket.get(exerciseName) ?? 0, weight))
    })

    weeklyExerciseMax.set(weekKey, weekBucket)
  })

  const exerciseCandidates = new Map<string, { maxWeight: number; occurrences: number }>()

  weeklyExerciseMax.forEach((weekBucket) => {
    weekBucket.forEach((weight, exerciseName) => {
      const current = exerciseCandidates.get(exerciseName)

      if (!current) {
        exerciseCandidates.set(exerciseName, {
          maxWeight: weight,
          occurrences: 1,
        })
        return
      }

      exerciseCandidates.set(exerciseName, {
        maxWeight: Math.max(current.maxWeight, weight),
        occurrences: current.occurrences + 1,
      })
    })
  })

  const series = Array.from(exerciseCandidates.entries())
    .sort((left, right) => {
      const occurrenceDelta = right[1].occurrences - left[1].occurrences

      if (occurrenceDelta !== 0) {
        return occurrenceDelta
      }

      return right[1].maxWeight - left[1].maxWeight
    })
    .slice(0, PROGRESS_SERIES_COLORS.length)
    .map(([exerciseName], index) => ({
      color: PROGRESS_SERIES_COLORS[index],
      exerciseName,
      key: `series${index + 1}`,
    }))

  const points = weekStarts.map((weekStart) => {
    const weekKey = weekStart.toISOString().slice(0, 10)
    const weekBucket = weeklyExerciseMax.get(weekKey) ?? new Map<string, number>()

    return {
      label: formatMonthDayLabel(weekStart),
      values: Object.fromEntries(series.map((item) => [item.key, weekBucket.get(item.exerciseName) ?? null])),
    }
  })

  return {
    points,
    series,
  }
}

async function assertCoachOwnsTrainee(coachId: string, traineeId: string) {
  const db = ensurePrisma()
  const trainee = await db.user.findFirst({
    where: {
      coachId,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new AuthServiceError("Không tìm thấy trainee thuộc coach này.", 404)
  }

  return trainee
}

async function assertCoachOwnsProgram(coachId: string, programId: string) {
  const db = ensurePrisma()
  const program = await db.program.findFirst({
    include: PROGRAM_INCLUDE,
    where: {
      createdById: coachId,
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  return program as ProgramRecord
}

async function assertCoachOwnsWorkoutLog(coachId: string, logId: string) {
  const db = ensurePrisma()
  const workoutLog = await db.workoutLog.findFirst({
    include: WORKOUT_LOG_INCLUDE,
    where: {
      id: logId,
      user: {
        coachId,
      },
    },
  })

  if (!workoutLog) {
    throw new AuthServiceError("Không tìm thấy workout log thuộc coach này.", 404)
  }

  return workoutLog as WorkoutLogRecord
}

async function assertCoachOwnsWorkoutLogComment(coachId: string, commentId: string) {
  const db = ensurePrisma()
  const comment = await db.workoutLogComment.findFirst({
    include: WORKOUT_LOG_COMMENT_INCLUDE,
    where: {
      id: commentId,
      workoutLog: {
        user: {
          coachId,
        },
      },
    },
  })

  if (!comment) {
    throw new AuthServiceError("Không tìm thấy feedback cho workout log này.", 404)
  }

  return comment as WorkoutLogCommentRecord
}

function sanitizeOptionalMeasurement(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return undefined
  }

  return Number(value)
}

function sanitizeScore(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return undefined
  }

  return Math.max(1, Math.min(10, Math.round(value)))
}

function normalizePhoneNumber(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

async function ensureDefaultExercises() {
  const db = ensurePrisma()
  const systemExercises = await db.exercise.findMany({
    include: {
      variations: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    where: {
      createdById: null,
    },
  })

  const exerciseKey = (exercise: { muscleGroup: string; name: string }) =>
    `${exercise.muscleGroup.trim().toLowerCase()}::${exercise.name.trim().toLowerCase()}`

  const systemExerciseByKey = new Map(systemExercises.map((exercise) => [exerciseKey(exercise), exercise]))
  const operations: Prisma.PrismaPromise<unknown>[] = []

  for (const defaultExercise of DEFAULT_EXERCISES) {
    const existingExercise = systemExerciseByKey.get(exerciseKey(defaultExercise))

    if (!existingExercise) {
      operations.push(
        db.exercise.create({
          data: {
            muscleGroup: defaultExercise.muscleGroup,
            name: defaultExercise.name,
            variations: {
              create: {
                equipment: defaultExercise.equipment,
                isDefault: true,
                name: "Default",
                sortOrder: 0,
              },
            },
          },
        }),
      )
      continue
    }

    const defaultVariation = existingExercise.variations.find((variation) => variation.isDefault)

    if (!defaultVariation) {
      operations.push(
        db.variation.create({
          data: {
            equipment: defaultExercise.equipment,
            exerciseId: existingExercise.id,
            isDefault: true,
            name: "Default",
            sortOrder: 0,
          },
        }),
      )
    }
  }

  if (operations.length > 0) {
    await db.$transaction(operations)
  }

  return db.variation.findMany({
    include: {
      exercise: true,
    },
    orderBy: [{ exercise: { muscleGroup: "asc" } }, { exercise: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  })
}

async function listExercises(
  profile: SerializedProfile,
  options?: { equipment?: string; muscleGroup?: string; search?: string },
) {
  const variations = await ensureDefaultExercises()
  const search = options?.search?.trim().toLowerCase()
  const muscleGroup = options?.muscleGroup?.trim().toLowerCase()
  const equipment = options?.equipment?.trim().toLowerCase()

  return variations
    .filter((variation) => {
      const isVisible = canProfileAccessExercise(variation.exercise.createdById, profile)

      if (!isVisible) {
        return false
      }

      const matchesSearch =
        !search ||
        [
          variation.exercise.name,
          variation.exercise.muscleGroup,
          variation.equipment ?? "",
          variation.name,
          variation.isDefault ? "" : `${variation.exercise.name} (${variation.name})`,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)

      const matchesGroup = !muscleGroup || variation.exercise.muscleGroup.toLowerCase() === muscleGroup
      const matchesEquipment = !equipment || (variation.equipment ?? "").toLowerCase() === equipment

      return matchesSearch && matchesGroup && matchesEquipment
    })
    .map((variation) => serializeVariationOption(variation, profile))
}

async function listExerciseLibrary(
  profile: SerializedProfile,
  options?: { equipment?: string; muscleGroup?: string; search?: string },
) {
  const db = ensurePrisma()
  await ensureDefaultExercises()
  const search = options?.search?.trim().toLowerCase()
  const muscleGroup = options?.muscleGroup?.trim().toLowerCase()
  const equipment = options?.equipment?.trim().toLowerCase()

  const exercises = await db.exercise.findMany({
    include: {
      createdBy: true,
      variations: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })

  return exercises
    .filter((exercise) => canProfileAccessExercise(exercise.createdById, profile))
    .map((exercise) => ({
      canManage: exercise.createdById === profile.id,
      createdById: exercise.createdById ?? undefined,
      createdByName: exercise.createdBy?.name ?? undefined,
      id: exercise.id,
      muscleGroup: exercise.muscleGroup,
      name: exercise.name,
      source: exercise.createdById ? "coach" : "system",
      variations: exercise.variations.filter((variation) => {
        const matchesSearch =
          !search ||
          [exercise.name, exercise.muscleGroup, variation.name, variation.equipment ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(search)
        const matchesEquipment = !equipment || (variation.equipment ?? "").toLowerCase() === equipment
        return matchesSearch && matchesEquipment
      }),
    }))
    .filter((exercise) => {
      const matchesGroup = !muscleGroup || exercise.muscleGroup.toLowerCase() === muscleGroup
      return matchesGroup && exercise.variations.length > 0
    })
    .map((exercise) => ({
      ...exercise,
      variations: exercise.variations.map(serializeVariation),
    }))
}

async function listCoachExercises(profile: SerializedProfile, options?: { search?: string }) {
  const db = ensurePrisma()
  assertCoach(profile)
  await ensureDefaultExercises()
  const search = options?.search?.trim().toLowerCase()

  const exercises = await db.exercise.findMany({
    include: {
      createdBy: true,
      variations: {
        include: {
          _count: {
            select: {
              workoutExercises: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ createdById: "asc" }, { muscleGroup: "asc" }, { name: "asc" }],
    where: {
      OR: [{ createdById: null }, { createdById: profile.id }],
    },
  })

  return exercises
    .filter((exercise) => {
      if (!search) {
        return true
      }

      const searchable = [
        exercise.name,
        exercise.muscleGroup,
        exercise.createdBy?.name ?? "",
        ...exercise.variations.flatMap((variation) => [variation.name, variation.equipment ?? ""]),
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(search)
    })
    .map((exercise) => serializeCoachExercise(exercise as CoachExerciseRecord, profile))
}

async function createCoachExercise(
  profile: SerializedProfile,
  input: {
    equipment?: string | null
    muscleGroup: string
    name: string
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const name = input.name.trim()
  const muscleGroup = input.muscleGroup.trim()
  const equipment = input.equipment?.trim() || undefined

  if (!name || !muscleGroup) {
    throw new AuthServiceError("Tên bài tập và nhóm cơ không được để trống.", 400)
  }

  const existingExercise = await db.exercise.findFirst({
    where: {
      createdById: profile.id,
      muscleGroup: {
        equals: muscleGroup,
        mode: "insensitive",
      },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  })

  if (existingExercise) {
    throw new AuthServiceError("Bài tập này đã tồn tại trong thư viện cá nhân.", 400)
  }

  const exercise = await db.exercise.create({
    data: {
      createdById: profile.id,
      muscleGroup,
      name,
      variations: {
        create: {
          equipment,
          isDefault: true,
          name: "Default",
          sortOrder: 0,
        },
      },
    },
    include: {
      createdBy: true,
      variations: {
        include: {
          _count: {
            select: {
              workoutExercises: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  })

  return serializeCoachExercise(exercise as CoachExerciseRecord, profile)
}

async function updateCoachExercise(
  profile: SerializedProfile,
  exerciseId: string,
  input: {
    equipment?: string | null
    muscleGroup: string
    name: string
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const name = input.name.trim()
  const muscleGroup = input.muscleGroup.trim()
  const equipment = input.equipment?.trim() || undefined

  if (!name || !muscleGroup) {
    throw new AuthServiceError("Tên bài tập và nhóm cơ không được để trống.", 400)
  }

  const existingExercise = await db.exercise.findFirst({
    include: {
      variations: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    where: {
      createdById: profile.id,
      id: exerciseId,
    },
  })

  if (!existingExercise) {
    throw new AuthServiceError("Không tìm thấy bài tập cá nhân.", 404)
  }

  const duplicateExercise = await db.exercise.findFirst({
    select: {
      id: true,
    },
    where: {
      createdById: profile.id,
      id: {
        not: exerciseId,
      },
      muscleGroup: {
        equals: muscleGroup,
        mode: "insensitive",
      },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  })

  if (duplicateExercise) {
    throw new AuthServiceError("Đã có bài tập cá nhân khác trùng tên và nhóm cơ.", 400)
  }

  const defaultVariation = existingExercise.variations.find((variation) => variation.isDefault) ?? existingExercise.variations[0]

  const exercise = await db.$transaction(async (transaction) => {
    await transaction.exercise.update({
      data: {
        muscleGroup,
        name,
      },
      where: {
        id: exerciseId,
      },
    })

    if (defaultVariation) {
      await transaction.variation.update({
        data: {
          equipment,
        },
        where: {
          id: defaultVariation.id,
        },
      })
    }

    return transaction.exercise.findUniqueOrThrow({
      include: {
        createdBy: true,
        variations: {
          include: {
            _count: {
              select: {
                workoutExercises: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      where: {
        id: exerciseId,
      },
    })
  })

  return serializeCoachExercise(exercise as CoachExerciseRecord, profile)
}

async function deleteCoachExercise(profile: SerializedProfile, exerciseId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const exercise = await db.exercise.findFirst({
    include: {
      variations: {
        include: {
          _count: {
            select: {
              workoutExercises: true,
            },
          },
        },
      },
    },
    where: {
      createdById: profile.id,
      id: exerciseId,
    },
  })

  if (!exercise) {
    throw new AuthServiceError("Không tìm thấy bài tập cá nhân.", 404)
  }

  const usageCount = exercise.variations.reduce((sum, variation) => sum + variation._count.workoutExercises, 0)

  if (usageCount > 0) {
    throw new AuthServiceError("Không thể xóa bài tập đang được dùng trong workout.", 400)
  }

  await db.exercise.delete({
    where: {
      id: exerciseId,
    },
  })

  return {
    deleted: true,
    id: exerciseId,
  }
}

async function listMealsForUser(profile: SerializedProfile, date = new Date()) {
  const db = ensurePrisma()
  const { end, start } = toDateRange(date)
  const recentWindow = toRecentWindow(7)
  const targetCalories = profile.dailyCalorieGoal ?? DEFAULT_CALORIE_TARGET

  const [meals, weeklyMeals] = await Promise.all([
    db.meal.findMany({
      include: MEAL_WITH_FOOD_INCLUDE,
      orderBy: {
        recordedAt: "asc",
      },
      where: {
        recordedAt: {
          gte: start,
          lte: end,
        },
        userId: profile.id,
      },
    }),
    db.meal.findMany({
      orderBy: {
        recordedAt: "asc",
      },
      select: {
        calories: true,
        recordedAt: true,
      },
      where: {
        recordedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        userId: profile.id,
      },
    }),
  ])

  const serializedMeals = meals.map(serializeMealRecord)
  const totalCalories = serializedMeals.reduce((total, meal) => total + meal.calories, 0)

  return {
    dailyNutrition: {
      date: start,
      meals: serializedMeals,
      targetCalories,
      totalCalories,
    },
    meals: serializedMeals,
    weeklyCalories: buildWeeklyCaloriesChart(weeklyMeals, targetCalories),
  }
}

async function listMealHistoryForUser(
  profile: SerializedProfile,
  options?: { cursor?: string; limit?: number },
) {
  const db = ensurePrisma()
  const take = Math.min(Math.max(options?.limit ?? 12, 1), 50)
  const meals = await db.meal.findMany({
    cursor: options?.cursor
      ? {
          id: options.cursor,
        }
      : undefined,
    include: MEAL_WITH_FOOD_INCLUDE,
    orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    skip: options?.cursor ? 1 : 0,
    take: take + 1,
    where: {
      userId: profile.id,
    },
  })

  const hasMore = meals.length > take
  const visibleMeals = hasMore ? meals.slice(0, take) : meals

  return {
    meals: visibleMeals.map(serializeMealRecord),
    nextCursor: hasMore ? visibleMeals[visibleMeals.length - 1]?.id : undefined,
  }
}

async function createMealForUser(
  profile: SerializedProfile,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string | null
    type: Meal["type"]
  },
) {
  const db = ensurePrisma()

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên bữa ăn không được để trống.")
  }

  const meal = await db.meal.create({
    data: {
      calories: Math.max(0, roundMealValue(input.calories)),
      carbs: input.carbs != null ? roundMealValue(input.carbs) : undefined,
      fat: input.fat != null ? roundMealValue(input.fat) : undefined,
      foodNameSnapshot: input.name.trim(),
      name: input.name.trim(),
      protein: input.protein != null ? roundMealValue(input.protein) : undefined,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      type: input.type,
      userId: profile.id,
    },
    include: MEAL_WITH_FOOD_INCLUDE,
  })

  return serializeMealRecord(meal)
}

async function updateMealForUser(
  profile: SerializedProfile,
  mealId: string,
  input: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    recordedAt?: string | null
    type: Meal["type"]
  },
) {
  const db = ensurePrisma()
  const meal = await db.meal.findFirst({
    where: {
      id: mealId,
      userId: profile.id,
    },
  })

  if (!meal) {
    throw new AuthServiceError("Không tìm thấy bữa ăn.", 404)
  }

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên bữa ăn không được để trống.")
  }

  const updatedMeal = await db.meal.update({
    data: {
      calories: Math.max(0, roundMealValue(input.calories)),
      carbs: input.carbs != null ? roundMealValue(input.carbs) : undefined,
      fat: input.fat != null ? roundMealValue(input.fat) : undefined,
      foodNameSnapshot: input.name.trim(),
      name: input.name.trim(),
      protein: input.protein != null ? roundMealValue(input.protein) : undefined,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : meal.recordedAt,
      type: input.type,
    },
    include: MEAL_WITH_FOOD_INCLUDE,
    where: {
      id: mealId,
    },
  })

  return serializeMealRecord(updatedMeal)
}

async function deleteMealForUser(profile: SerializedProfile, mealId: string) {
  const db = ensurePrisma()
  const meal = await db.meal.findFirst({
    where: {
      id: mealId,
      userId: profile.id,
    },
  })

  if (!meal) {
    throw new AuthServiceError("Không tìm thấy bữa ăn.", 404)
  }

  await db.meal.delete({
    where: {
      id: mealId,
    },
  })

  return {
    deleted: true,
    id: mealId,
  }
}

async function listWorkoutsForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)
  const assignments = await db.programAssignment.findMany({
    include: {
      program: {
        include: {
          workouts: {
            include: WORKOUT_INCLUDE,
            orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
    where: {
      userId: profile.id,
    },
  })

  const workoutMap = new Map<string, WorkoutRecord>()
  const personalWorkoutIds = new Set<string>()

  assignments.forEach((assignment) => {
    const isPersonalProgram = assignment.program.createdById === profile.id

    ;(assignment.program.workouts as WorkoutRecord[]).forEach((workout) => {
      workoutMap.set(workout.id, workout)

      if (isPersonalProgram) {
        personalWorkoutIds.add(workout.id)
      }
    })
  })

  const serializedWorkouts = Array.from(workoutMap.values())
    .sort((left, right) => {
      if (left.scheduledDate && right.scheduledDate) {
        return left.scheduledDate.getTime() - right.scheduledDate.getTime()
      }

      if (left.scheduledDate) {
        return -1
      }

      if (right.scheduledDate) {
        return 1
      }

      return (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7)
    })
    .map((workout) => serializeWorkout(workout, { isPersonal: personalWorkoutIds.has(workout.id) }))

  const recurringWorkouts = serializedWorkouts.filter((workout) => !workout.scheduledDate)

  const weekStart = startOfUtcWeek(new Date())
  const todayStart = startOfUtcDay(new Date())

  const [recentLogs, historyLogs, weekLogs] = await Promise.all([
    db.workoutLog.findMany({
      include: WORKOUT_LOG_INCLUDE,
      orderBy: {
        startedAt: "desc",
      },
      take: 5,
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.findMany({
      include: WORKOUT_LOG_INCLUDE,
      orderBy: {
        startedAt: "desc",
      },
      take: 20,
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.findMany({
      include: WORKOUT_LOG_INCLUDE,
      orderBy: {
        startedAt: "desc",
      },
      where: {
        startedAt: { gte: weekStart },
        userId: profile.id,
      },
    }),
  ])

  const schedule = DAY_LABELS.reduce<Record<number, ReturnType<typeof serializeWorkout> | null>>((accumulator, _label, index) => {
    const workout = recurringWorkouts.find((item) => item.scheduledDay === index)
    accumulator[index] = workout ?? null
    return accumulator
  }, {})

  const todayDateKey = formatUtcDateOnly(todayStart)
  const todayOneOffWorkout = serializedWorkouts.find((workout) => workout.scheduledDate === todayDateKey) ?? null

  const activeDaysSet = new Set(weekLogs.map((log) => log.startedAt.getUTCDay()))
  const todayVolume = weekLogs
    .filter((log) => log.startedAt >= todayStart)
    .reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)

  return {
    historyLogs: historyLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    recentLogs: recentLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    schedule,
    todayWorkout: todayOneOffWorkout ?? schedule[new Date().getDay()] ?? null,
    weekLogs: weekLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    weekStats: {
      activeDaysThisWeek: activeDaysSet.size,
      todayVolume,
      workoutsThisWeek: weekLogs.length,
    },
    workouts: serializedWorkouts,
  }
}

async function getDashboardForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const now = new Date()
  const weekStart = startOfUtcWeek(now)
  const todayStart = startOfUtcDay(now)
  const todayEnd = new Date(todayStart)
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)
  todayEnd.setMilliseconds(-1)

  const [assignments, recentLogs, weekLogs, meals] = await Promise.all([
    db.programAssignment.findMany({
      include: {
        program: {
          include: {
            workouts: {
              include: WORKOUT_INCLUDE,
              orderBy: [{ scheduledDay: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.findMany({
      include: WORKOUT_LOG_INCLUDE,
      orderBy: {
        startedAt: "desc",
      },
      take: 5,
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.findMany({
      orderBy: {
        startedAt: "desc",
      },
      select: {
        startedAt: true,
        totalVolume: true,
      },
      where: {
        startedAt: { gte: weekStart },
        userId: profile.id,
      },
    }),
    db.meal.findMany({
      include: MEAL_WITH_FOOD_INCLUDE,
      orderBy: {
        recordedAt: "asc",
      },
      where: {
        recordedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        userId: profile.id,
      },
    }),
  ])

  const workoutMap = new Map<string, WorkoutRecord>()
  const personalWorkoutIds = new Set<string>()

  assignments.forEach((assignment) => {
    const isPersonalProgram = assignment.program.createdById === profile.id

    ;(assignment.program.workouts as WorkoutRecord[]).forEach((workout) => {
      workoutMap.set(workout.id, workout)

      if (isPersonalProgram) {
        personalWorkoutIds.add(workout.id)
      }
    })
  })

  const serializedWorkouts = Array.from(workoutMap.values())
    .sort((left, right) => {
      if (left.scheduledDate && right.scheduledDate) {
        return left.scheduledDate.getTime() - right.scheduledDate.getTime()
      }

      if (left.scheduledDate) {
        return -1
      }

      if (right.scheduledDate) {
        return 1
      }

      return (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7)
    })
    .map((workout) => serializeWorkout(workout, { isPersonal: personalWorkoutIds.has(workout.id) }))

  const recurringWorkouts = serializedWorkouts.filter((workout) => !workout.scheduledDate)
  const schedule = DAY_LABELS.reduce<Record<number, ReturnType<typeof serializeWorkout> | null>>((accumulator, _label, index) => {
    const workout = recurringWorkouts.find((item) => item.scheduledDay === index)
    accumulator[index] = workout ?? null
    return accumulator
  }, {})

  const todayDateKey = formatUtcDateOnly(todayStart)
  const todayOneOffWorkout = serializedWorkouts.find((workout) => workout.scheduledDate === todayDateKey) ?? null
  const serializedMeals = meals.map(serializeMealRecord)
  const activeDaysSet = new Set(weekLogs.map((log) => log.startedAt.getUTCDay()))
  const todayVolume = weekLogs
    .filter((log) => log.startedAt >= todayStart)
    .reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)

  return {
    dailyNutrition: {
      date: todayStart,
      meals: serializedMeals,
      targetCalories: profile.dailyCalorieGoal ?? DEFAULT_CALORIE_TARGET,
      totalCalories: serializedMeals.reduce((total, meal) => total + meal.calories, 0),
    },
    recentLogs: recentLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    schedule,
    todayWorkout: todayOneOffWorkout ?? schedule[now.getDay()] ?? null,
    weekStats: {
      activeDaysThisWeek: activeDaysSet.size,
      todayVolume,
      workoutsThisWeek: weekLogs.length,
    },
    workouts: serializedWorkouts,
  }
}

async function deleteWorkoutLogForTrainee(profile: SerializedProfile, _workoutId: string, logId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const log = await db.workoutLog.findFirst({
    where: {
      id: logId,
      userId: profile.id,
    },
  })

  if (!log) {
    throw new AuthServiceError("Không tìm thấy log workout.", 404)
  }

  await db.$transaction([
    db.notification.deleteMany({
      where: {
        relatedEntityId: logId,
        relatedEntityType: "workout_log",
      },
    }),
    db.workoutLog.delete({
      where: { id: logId },
    }),
  ])

  return { deleted: true, id: logId }
}

async function getWorkoutDetailForTrainee(profile: SerializedProfile, workoutId: string) {
  const db = ensurePrisma()
  const workout = await db.workout.findFirst({
    include: WORKOUT_WITH_PROGRAM_INCLUDE,
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  const previousPerformanceByWorkoutExerciseId = await buildPreviousSetPerformanceByWorkoutExercise(
    profile.id,
    workout.exercises as WorkoutExerciseRecord[],
  )

  return serializeWorkout(workout as WorkoutWithProgramRecord, {
    isPersonal: workout.program?.createdById === profile.id,
    previousPerformanceByWorkoutExerciseId,
  })
}

async function createWorkoutLogForTrainee(
  profile: SerializedProfile,
  workoutId: string,
  input: {
    completedAt?: string | null
    exercises: ReturnType<typeof serializeWorkout>["exercises"]
    notes?: string | null
    startedAt?: string | null
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)
  const workout = await db.workout.findFirst({
    include: WORKOUT_INCLUDE,
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  const serializedWorkout = serializeWorkout(workout as WorkoutRecord)
  const totalVolume = calculateWorkoutVolume(input.exercises)

  const log = await retryTransaction(() => db.$transaction(async (transaction) => {
    const createdLog = await transaction.workoutLog.create({
      data: {
        completedAt: input.completedAt ? new Date(input.completedAt) : new Date(),
        exerciseSnapshot: input.exercises as Prisma.InputJsonValue,
        notes: input.notes?.trim() || undefined,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        totalVolume,
        userId: profile.id,
        workoutId: workout.id,
        workoutSnapshot: {
          duration: serializedWorkout.duration,
          id: serializedWorkout.id,
          name: serializedWorkout.name,
          notes: serializedWorkout.notes,
          scheduledDate: serializedWorkout.scheduledDate,
          scheduledDay: serializedWorkout.scheduledDay,
        } as Prisma.InputJsonObject,
      },
      include: WORKOUT_LOG_INCLUDE,
    })

    if (profile.coachId) {
      await transaction.notification.create({
        data: {
          channel: "in_app",
          message: `${profile.name} completed ${serializedWorkout.name}.`,
          metadata: {
            traineeId: profile.id,
            traineeName: profile.name,
            workoutId: workout.id,
            workoutLogId: createdLog.id,
            workoutName: serializedWorkout.name,
          },
          relatedEntityId: createdLog.id,
          relatedEntityType: "workout_log",
          scheduledFor: new Date(),
          sentAt: new Date(),
          status: NotificationStatus.sent,
          title: `${profile.name} logged a workout`,
          type: NotificationType.workout_logged,
          userId: profile.coachId,
        },
      })
    }

    return createdLog
  }))

  return serializeWorkoutLog(log as WorkoutLogRecord)
}

async function normalizePersonalWorkoutInput(input: PersonalWorkoutInput): Promise<NormalizedPersonalWorkoutInput> {
  const db = ensurePrisma()
  const workoutName = input.name.trim()

  if (!workoutName) {
    throw new AuthServiceError("Tên buổi tập không được để trống.")
  }

  if (input.exercises.length === 0) {
    throw new AuthServiceError("Buổi tập cần ít nhất một bài tập.", 400)
  }

  if (input.scheduledDay != null && (input.scheduledDay < 0 || input.scheduledDay > 6)) {
    throw new AuthServiceError("Ngày tập không hợp lệ.", 400)
  }

  if (input.scheduledDay != null && input.scheduledDate) {
    throw new AuthServiceError("Chỉ được chọn một kiểu lịch: theo thứ hoặc theo ngày cụ thể.", 400)
  }

  const scheduledDate = input.scheduledDate ? parseScheduledDateInput(input.scheduledDate) : undefined

  if (input.scheduledDate && !scheduledDate) {
    throw new AuthServiceError("Ngày cụ thể không hợp lệ.", 400)
  }

  if (input.exercises.some((exercise) => !exercise.variationId)) {
    throw new AuthServiceError("Mỗi dòng bài tập cần có variation hợp lệ.", 400)
  }

  const variationIds = Array.from(new Set(input.exercises.map((exercise) => exercise.variationId)))
  const validVariationCount = await db.variation.count({
    where: {
      id: {
        in: variationIds,
      },
    },
  })

  if (validVariationCount !== variationIds.length) {
    throw new AuthServiceError("Có biến thể bài tập không tồn tại trong thư viện.", 400)
  }

  const validKinds = Object.values(WorkoutKind) as string[]
  const kind =
    input.kind && validKinds.includes(input.kind)
      ? (input.kind as $Enums.WorkoutKind)
      : undefined

  return {
    duration: input.duration ? Math.max(1, Math.round(input.duration)) : undefined,
    exercises: input.exercises.map((exercise, exerciseIndex) => {
      const repTarget = normalizeRepTarget(exercise.reps, exercise.repsMin, `Bài tập ${exerciseIndex + 1}`)

      return {
        reps: repTarget.reps,
        repsMin: repTarget.repsMin,
        variationId: exercise.variationId,
        restTime: exercise.restTime ? Math.max(0, Math.round(exercise.restTime)) : undefined,
        sets: Math.max(1, Math.round(exercise.sets)),
        weight:
          exercise.weight != null && Number.isFinite(exercise.weight)
            ? Math.max(0, exercise.weight)
            : undefined,
      }
    }),
    kind,
    name: workoutName,
    notes: input.notes?.trim() || undefined,
    scheduledDate,
    scheduledDay: scheduledDate ? undefined : typeof input.scheduledDay === "number" ? input.scheduledDay : undefined,
  }
}

function buildPersonalWorkoutExerciseCreateData(exercises: NormalizedPersonalWorkoutInput["exercises"]) {
  return exercises.map((exercise, exerciseIndex) => ({
    order: exerciseIndex + 1,
    restTime: exercise.restTime,
    sets: {
      create: Array.from({ length: exercise.sets }, (_value, setIndex) => ({
        setNumber: setIndex + 1,
        targetRepsMin: exercise.repsMin,
        targetReps: exercise.reps,
        weight: exercise.weight,
      })),
    },
    variationId: exercise.variationId,
  }))
}

async function createPersonalWorkoutForTrainee(
  profile: SerializedProfile,
  input: PersonalWorkoutInput,
) {
  const db = ensurePrisma()
  assertTrainee(profile)
  const normalizedInput = await normalizePersonalWorkoutInput(input)

  const program = await db.program.create({
    data: {
      assignments: {
        create: {
          userId: profile.id,
        },
      },
      createdById: profile.id,
      description: "Personal workout created by trainee.",
      difficulty: ProgramDifficulty.beginner,
      duration: 1,
      name: normalizedInput.name,
        workouts: {
          create: {
            duration: normalizedInput.duration,
            exercises: {
              create: buildPersonalWorkoutExerciseCreateData(normalizedInput.exercises),
            },
            kind: normalizedInput.kind,
            name: normalizedInput.name,
            notes: normalizedInput.notes,
            scheduledDate: normalizedInput.scheduledDate,
            scheduledDay: normalizedInput.scheduledDay,
          },
        },
      workoutsPerWeek: 1,
    },
    include: {
      workouts: {
        include: WORKOUT_INCLUDE,
      },
    },
  })

  const workout = program.workouts[0]

  if (!workout) {
    throw new AuthServiceError("Không thể tạo buổi tập.", 500)
  }

  return serializeWorkout(workout as WorkoutRecord, {
    isPersonal: true,
  })
}

async function updatePersonalWorkoutForTrainee(
  profile: SerializedProfile,
  workoutId: string,
  input: PersonalWorkoutInput,
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const normalizedInput = await normalizePersonalWorkoutInput(input)
  const existingWorkout = await db.workout.findFirst({
    select: {
      id: true,
      programId: true,
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
        createdById: profile.id,
      },
    },
  })

  if (!existingWorkout) {
    throw new AuthServiceError("Không tìm thấy lịch tập cá nhân.", 404)
  }

  const updatedWorkout = await db.$transaction(async (tx) => {
    await tx.workoutExercise.deleteMany({
      where: {
        workoutId: existingWorkout.id,
      },
    })

    const workout = await tx.workout.update({
      data: {
        duration: normalizedInput.duration ?? null,
        exercises: {
          create: buildPersonalWorkoutExerciseCreateData(normalizedInput.exercises),
        },
        kind: normalizedInput.kind ?? null,
        name: normalizedInput.name,
        notes: normalizedInput.notes ?? null,
        scheduledDate: normalizedInput.scheduledDate ?? null,
        scheduledDay: normalizedInput.scheduledDate ? null : normalizedInput.scheduledDay ?? null,
      },
      include: {
        ...WORKOUT_INCLUDE,
      },
      where: {
        id: existingWorkout.id,
      },
    })

    if (existingWorkout.programId) {
      await tx.program.update({
        data: {
          name: normalizedInput.name,
        },
        where: {
          id: existingWorkout.programId,
        },
      })
    }

    return workout
  })

  return serializeWorkout(updatedWorkout as WorkoutRecord, {
    isPersonal: true,
  })
}

async function deletePersonalWorkoutForTrainee(profile: SerializedProfile, workoutId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const workout = await db.workout.findFirst({
    select: {
      id: true,
      programId: true,
    },
    where: {
      id: workoutId,
      program: {
        assignments: {
          some: {
            userId: profile.id,
          },
        },
        createdById: profile.id,
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy lịch tập cá nhân.", 404)
  }

  await db.$transaction(async (tx) => {
    await tx.workout.delete({
      where: {
        id: workout.id,
      },
    })

    if (workout.programId) {
      const remainingWorkoutCount = await tx.workout.count({
        where: {
          programId: workout.programId,
        },
      })

      if (remainingWorkoutCount === 0) {
        await tx.program.delete({
          where: {
            id: workout.programId,
          },
        })
      }
    }
  })

  return {
    deleted: true,
    id: workout.id,
  }
}

async function listAvailableCoachesForTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const [coaches, requests] = await Promise.all([
    db.user.findMany({
      include: {
        _count: {
          select: {
            trainees: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        role: UserRole.coach,
      },
    }),
    db.coachRequest.findMany({
      where: {
        traineeId: profile.id,
      },
    }),
  ])

  const requestByCoach = new Map(requests.map((request) => [request.coachId, request]))

  return coaches.map((coach) => {
    const request = requestByCoach.get(coach.id)
    const requestStatus = profile.coachId === coach.id ? "connected" : request?.status ?? "none"

    return {
      activeTrainees: coach._count.trainees,
      avatar: coach.avatar,
      createdAt: coach.createdAt,
      email: coach.email,
      fitnessGoals: coach.fitnessGoals,
      id: coach.id,
      name: coach.name,
      requestId: request?.id,
      requestStatus,
    }
  })
}

async function createCoachRequestForTrainee(profile: SerializedProfile, coachId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  if (profile.coachId) {
    throw new AuthServiceError("Bạn đã được gán coach. Hãy ngắt kết nối trước khi gửi request mới.", 400)
  }

  const coach = await db.user.findFirst({
    where: {
      id: coachId,
      role: UserRole.coach,
    },
  })

  if (!coach) {
    throw new AuthServiceError("Không tìm thấy coach.", 404)
  }

  const existingRequest = await db.coachRequest.findUnique({
    where: {
      traineeId_coachId: {
        coachId,
        traineeId: profile.id,
      },
    },
  })

  if (existingRequest?.status === CoachRequestStatus.pending) {
    return {
      request: {
        coachId: existingRequest.coachId,
        createdAt: existingRequest.createdAt,
        id: existingRequest.id,
        requestStatus: existingRequest.status,
        traineeId: existingRequest.traineeId,
      },
    }
  }

  if (existingRequest?.status === CoachRequestStatus.approved) {
    throw new AuthServiceError("Coach request này đã được phê duyệt.", 400)
  }

  const request =
    existingRequest != null
      ? await db.coachRequest.update({
          data: {
            status: CoachRequestStatus.pending,
          },
          where: {
            id: existingRequest.id,
          },
        })
      : await db.coachRequest.create({
          data: {
            coachId,
            traineeId: profile.id,
          },
        })

  return {
    request: {
      coachId: request.coachId,
      createdAt: request.createdAt,
      id: request.id,
      requestStatus: request.status,
      traineeId: request.traineeId,
    },
  }
}

async function listCoachPrograms(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: PROGRAM_INCLUDE,
    orderBy: {
      createdAt: "desc",
    },
    where: {
      createdById: profile.id,
    },
  })

  return programs.map((program) => serializeProgram(program as ProgramRecord))
}

async function getCoachProgramDetail(profile: SerializedProfile, programId: string) {
  assertCoach(profile)
  const db = ensurePrisma()
  const program = await db.program.findFirst({
    include: PROGRAM_INCLUDE,
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  return serializeProgram(program as ProgramRecord)
}

function countProgramWorkoutsPerWeek(workouts: Array<{ scheduledDay?: number }>) {
  const scheduledDays = new Set(
    workouts
      .map((workout) => workout.scheduledDay)
      .filter((scheduledDay): scheduledDay is number => typeof scheduledDay === "number"),
  )

  return scheduledDays.size > 0 ? scheduledDays.size : workouts.length
}

async function createCoachProgram(
  profile: SerializedProfile,
  input: {
    assignToUserIds?: string[]
    description?: string | null
    difficulty: ProgramDifficulty
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
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.")
  }

  const assignToUserIds = Array.from(new Set((input.assignToUserIds ?? []).filter(Boolean)))

  if (assignToUserIds.length > 0) {
    const validTrainees = await db.user.count({
      where: {
        coachId: profile.id,
        id: {
          in: assignToUserIds,
        },
        role: UserRole.trainee,
      },
    })

    if (validTrainees !== assignToUserIds.length) {
      throw new AuthServiceError("Chỉ có thể gán chương trình cho trainee thuộc coach này.", 400)
    }
  }

  const variationIds = Array.from(
    new Set(input.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.variationId)).filter(Boolean)),
  )

  if (variationIds.length === 0) {
    throw new AuthServiceError("Mỗi buổi tập cần ít nhất một variation hợp lệ.", 400)
  }

  const validVariationCount = await db.variation.count({
    where: {
      id: {
        in: variationIds,
      },
    },
  })

  if (validVariationCount !== variationIds.length) {
    throw new AuthServiceError("Có variation không hợp lệ trong hệ thống.", 400)
  }

  const program = await db.program.create({
    data: {
      assignments:
        assignToUserIds.length > 0
          ? {
              create: assignToUserIds.map((userId) => ({
                userId,
              })),
            }
          : undefined,
      createdById: profile.id,
      description: input.description?.trim() || undefined,
      difficulty: input.difficulty,
      duration: Math.max(1, Math.round(input.duration)),
      name: input.name.trim(),
      workouts: {
        create: input.workouts.map((workout, workoutIndex) => ({
          duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
          exercises: {
            create: workout.exercises.map((exercise, exerciseIndex) => {
              const repTarget = normalizeRepTarget(
                exercise.reps,
                exercise.repsMin,
                `${workout.name.trim() || `Buổi ${workoutIndex + 1}`} / bài tập ${exerciseIndex + 1}`,
              )

              return {
                order: exerciseIndex + 1,
                sets: {
                  create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                    setNumber: setIndex + 1,
                    targetReps: repTarget.reps,
                    targetRepsMin: repTarget.repsMin,
                    weight:
                      exercise.weight != null && Number.isFinite(exercise.weight)
                        ? Math.max(0, exercise.weight)
                        : undefined,
                  })),
                },
                variationId: exercise.variationId,
              }
            }),
          },
          name: workout.name.trim() || `Day ${workoutIndex + 1}`,
          scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
        })),
      },
      workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
    },
    include: PROGRAM_INCLUDE,
  })

  return serializeProgram(program as ProgramRecord)
}

async function updateCoachProgram(
  profile: SerializedProfile,
  programId: string,
  input: {
    assignToUserIds?: string[]
    description?: string | null
    difficulty: ProgramDifficulty
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
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    select: {
      id: true,
    },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.")
  }

  const assignToUserIds = Array.from(new Set((input.assignToUserIds ?? []).filter(Boolean)))

  if (assignToUserIds.length > 0) {
    const validTrainees = await db.user.count({
      where: {
        coachId: profile.id,
        id: {
          in: assignToUserIds,
        },
        role: UserRole.trainee,
      },
    })

    if (validTrainees !== assignToUserIds.length) {
      throw new AuthServiceError("Chỉ có thể gán chương trình cho trainee thuộc coach này.", 400)
    }
  }

  const variationIds = Array.from(
    new Set(input.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.variationId)).filter(Boolean)),
  )

  if (variationIds.length === 0) {
    throw new AuthServiceError("Mỗi buổi tập cần ít nhất một variation hợp lệ.", 400)
  }

  const validVariationCount = await db.variation.count({
    where: {
      id: {
        in: variationIds,
      },
    },
  })

  if (validVariationCount !== variationIds.length) {
    throw new AuthServiceError("Có variation không hợp lệ trong hệ thống.", 400)
  }

  const program = await db.$transaction(async (tx) => {
    await tx.programAssignment.deleteMany({
      where: {
        programId: existingProgram.id,
      },
    })

    if (assignToUserIds.length > 0) {
      await tx.programAssignment.createMany({
        data: assignToUserIds.map((userId) => ({
          programId: existingProgram.id,
          userId,
        })),
      })
    }

    return tx.program.update({
      data: {
        description: input.description?.trim() || undefined,
        difficulty: input.difficulty,
        duration: Math.max(1, Math.round(input.duration)),
        name: input.name.trim(),
        workouts: {
          create: input.workouts.map((workout, workoutIndex) => ({
            duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
            exercises: {
              create: workout.exercises.map((exercise, exerciseIndex) => {
                const repTarget = normalizeRepTarget(
                  exercise.reps,
                  exercise.repsMin,
                  `${workout.name.trim() || `Buổi ${workoutIndex + 1}`} / bài tập ${exerciseIndex + 1}`,
                )

                return {
                  order: exerciseIndex + 1,
                  sets: {
                    create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                      setNumber: setIndex + 1,
                      targetReps: repTarget.reps,
                      targetRepsMin: repTarget.repsMin,
                      weight:
                        exercise.weight != null && Number.isFinite(exercise.weight)
                          ? Math.max(0, exercise.weight)
                          : undefined,
                    })),
                  },
                  variationId: exercise.variationId,
                }
              }),
            },
            name: workout.name.trim() || `Day ${workoutIndex + 1}`,
            scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
          })),
          deleteMany: {},
        },
        workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
      },
      include: PROGRAM_INCLUDE,
      where: {
        id: existingProgram.id,
      },
    })
  })

  return serializeProgram(program as ProgramRecord)
}

async function adjustCoachProgramForTrainee(
  profile: SerializedProfile,
  programId: string,
  traineeId: string,
  input: {
    description?: string | null
    difficulty: ProgramDifficulty
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
    }>
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (!input.name.trim()) {
    throw new AuthServiceError("Tên chương trình không được để trống.")
  }

  if (input.workouts.length === 0) {
    throw new AuthServiceError("Chương trình cần ít nhất một buổi tập.", 400)
  }

  const [existingProgram, trainee] = await Promise.all([
    assertCoachOwnsProgram(profile.id, programId),
    assertCoachOwnsTrainee(profile.id, traineeId),
  ])

  const existingAssignment = await db.programAssignment.findUnique({
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  if (!existingAssignment) {
    throw new AuthServiceError("Trainee này chưa được gán chương trình gốc để điều chỉnh.", 400)
  }

  const variationIds = Array.from(
    new Set(input.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.variationId)).filter(Boolean)),
  )

  if (variationIds.length === 0) {
    throw new AuthServiceError("Mỗi buổi tập cần ít nhất một variation hợp lệ.", 400)
  }

  const validVariationCount = await db.variation.count({
    where: {
      id: {
        in: variationIds,
      },
    },
  })

  if (validVariationCount !== variationIds.length) {
    throw new AuthServiceError("Có variation không hợp lệ trong hệ thống.", 400)
  }

  const adjustedProgram = await db.$transaction(async (transaction) => {
    const createdProgram = await transaction.program.create({
      data: {
        assignments: {
          create: {
            userId: traineeId,
          },
        },
        createdById: profile.id,
        description: input.description?.trim() || undefined,
        difficulty: input.difficulty,
        duration: Math.max(1, Math.round(input.duration)),
        name: input.name.trim(),
        workouts: {
          create: input.workouts.map((workout, workoutIndex) => ({
            duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
            exercises: {
              create: workout.exercises.map((exercise, exerciseIndex) => {
                const repTarget = normalizeRepTarget(
                  exercise.reps,
                  exercise.repsMin,
                  `${workout.name.trim() || `Buổi ${workoutIndex + 1}`} / bài tập ${exerciseIndex + 1}`,
                )

                return {
                  order: exerciseIndex + 1,
                  sets: {
                    create: Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
                      setNumber: setIndex + 1,
                      targetReps: repTarget.reps,
                      targetRepsMin: repTarget.repsMin,
                      weight:
                        exercise.weight != null && Number.isFinite(exercise.weight)
                          ? Math.max(0, exercise.weight)
                          : undefined,
                    })),
                  },
                  variationId: exercise.variationId,
                }
              }),
            },
            name: workout.name.trim() || `Day ${workoutIndex + 1}`,
            scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
          })),
        },
        workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
      },
      include: PROGRAM_INCLUDE,
    })

    await transaction.programAssignment.delete({
      where: {
        programId_userId: {
          programId: existingProgram.id,
          userId: traineeId,
        },
      },
    })

    await transaction.notification.create({
      data: {
        channel: "in_app",
        message: `Coach updated your plan from ${existingProgram.name}.`,
        metadata: {
          previousProgramId: existingProgram.id,
          previousProgramName: existingProgram.name,
          traineeId: trainee.id,
          trainerId: profile.id,
        },
        relatedEntityId: createdProgram.id,
        relatedEntityType: "program",
        scheduledFor: new Date(),
        sentAt: new Date(),
        status: NotificationStatus.sent,
        title: "Your training plan was updated",
        type: NotificationType.program_assigned,
        userId: trainee.id,
      },
    })

    return createdProgram
  })

  return serializeProgram(adjustedProgram as ProgramRecord)
}

async function deleteCoachProgram(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    select: {
      id: true,
    },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  await db.program.delete({
    where: {
      id: existingProgram.id,
    },
  })

  return {
    deleted: true,
    id: existingProgram.id,
  }
}

async function assignCoachProgramToTrainee(profile: SerializedProfile, programId: string, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  await Promise.all([assertCoachOwnsProgram(profile.id, programId), assertCoachOwnsTrainee(profile.id, traineeId)])

  const assignment = await db.programAssignment.upsert({
    create: {
      programId,
      userId: traineeId,
    },
    update: {},
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  return {
    assigned: true,
    programId: assignment.programId,
    traineeId: assignment.userId,
  }
}

async function unassignCoachProgramFromTrainee(profile: SerializedProfile, programId: string, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  await Promise.all([assertCoachOwnsProgram(profile.id, programId), assertCoachOwnsTrainee(profile.id, traineeId)])

  const existingAssignment = await db.programAssignment.findUnique({
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  if (!existingAssignment) {
    throw new AuthServiceError("Trainee này chưa được gán vào chương trình.", 404)
  }

  await db.programAssignment.delete({
    where: {
      programId_userId: {
        programId,
        userId: traineeId,
      },
    },
  })

  return {
    deleted: true,
    programId,
    traineeId,
  }
}

async function createBodyMetricForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  input: {
    armCm?: number | null
    bodyFatPct?: number | null
    chestCm?: number | null
    hipsCm?: number | null
    note?: string | null
    recordedAt?: string | null
    thighCm?: number | null
    waistCm?: number | null
    weightKg?: number | null
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  await assertCoachOwnsTrainee(profile.id, traineeId)

  const metricPayload = {
    armCm: sanitizeOptionalMeasurement(input.armCm),
    bodyFatPct: sanitizeOptionalMeasurement(input.bodyFatPct),
    chestCm: sanitizeOptionalMeasurement(input.chestCm),
    hipsCm: sanitizeOptionalMeasurement(input.hipsCm),
    thighCm: sanitizeOptionalMeasurement(input.thighCm),
    waistCm: sanitizeOptionalMeasurement(input.waistCm),
    weightKg: sanitizeOptionalMeasurement(input.weightKg),
  }

  const hasMetricValue = Object.values(metricPayload).some((value) => value != null)
  const note = input.note?.trim() || undefined

  if (!hasMetricValue && !note) {
    throw new AuthServiceError("Vui lòng nhập ít nhất một chỉ số hoặc ghi chú.", 400)
  }

  const entry = await db.bodyMetricEntry.create({
    data: {
      ...metricPayload,
      coachId: profile.id,
      note,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      traineeId,
    },
    include: {
      coach: true,
    },
  })

  return serializeBodyMetricEntry(entry as BodyMetricRecord)
}

async function listBodyMetricsForCurrentTrainee(
  profile: SerializedProfile,
  options?: {
    days?: number
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const requestedDays = options?.days ?? 30
  const normalizedDays = requestedDays === 90 || requestedDays === 365 ? requestedDays : 30
  const window = toRecentWindow(normalizedDays)

  const entries = await db.bodyMetricEntry.findMany({
    include: {
      coach: true,
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    where: {
      recordedAt: {
        gte: window.start,
        lte: window.end,
      },
      traineeId: profile.id,
      weightKg: {
        not: null,
      },
    },
  })

  return entries.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord))
}

async function createBodyMetricForCurrentTrainee(
  profile: SerializedProfile,
  input: {
    note?: string | null
    recordedAt?: string | null
    weightKg?: number | null
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const weightKg = sanitizeOptionalMeasurement(input.weightKg)
  const note = input.note?.trim() || undefined

  if (weightKg == null && !note) {
    throw new AuthServiceError("Vui lòng nhập cân nặng hoặc ghi chú.", 400)
  }

  const entry = await db.bodyMetricEntry.create({
    data: {
      note,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      traineeId: profile.id,
      weightKg,
    },
    include: {
      coach: true,
    },
  })

  return serializeBodyMetricEntry(entry as BodyMetricRecord)
}

async function getProgressAnalyticsForCurrentTrainee(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const workoutLogs = await db.workoutLog.findMany({
    orderBy: {
      startedAt: "asc",
    },
    select: {
      exerciseSnapshot: true,
      startedAt: true,
      totalVolume: true,
    },
    where: {
      userId: profile.id,
    },
  })

  const currentMonth = getUtcMonthBounds()
  const workoutsThisMonth = workoutLogs.filter(
    (log) => log.startedAt >= currentMonth.start && log.startedAt < currentMonth.end,
  )
  const totalVolumeThisMonth = workoutsThisMonth.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const { bestStreakDays, currentStreakDays } = calculateWorkoutStreaks(workoutLogs as ProgressAnalyticsLogRecord[])

  return {
    muscleGroupDistribution: buildMuscleGroupDistribution(workoutLogs as ProgressAnalyticsLogRecord[]),
    personalRecords: buildPersonalRecords(workoutLogs as ProgressAnalyticsLogRecord[]),
    strengthProgression: buildStrengthProgression(workoutLogs as ProgressAnalyticsLogRecord[]),
    summary: {
      bestStreakDays,
      currentStreakDays,
      totalVolumeThisMonth: Math.round(totalVolumeThisMonth * 10) / 10,
      workoutsThisMonth: workoutsThisMonth.length,
    },
    weeklyVolume: buildWeeklyVolume(workoutLogs as ProgressAnalyticsLogRecord[]),
  }
}

async function getCalendarForTrainee(
  profile: SerializedProfile,
  year: number,
  month: number,
  options?: { summaryOnly?: boolean },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const logs = await db.workoutLog.findMany({
    orderBy: { startedAt: "asc" },
    select: options?.summaryOnly
      ? {
          completedAt: true,
          startedAt: true,
          totalVolume: true,
        }
      : {
          completedAt: true,
          id: true,
          startedAt: true,
          totalVolume: true,
          workout: { select: { id: true, kind: true, name: true } },
        },
    where: {
      startedAt: { gte: start, lt: end },
      userId: profile.id,
    },
  })

  const totalWorkouts = logs.length
  const totalVolume = logs.reduce((s, l) => s + (l.totalVolume ?? 0), 0)
  const completedLogs = logs.filter((l) => l.completedAt)
  const totalDurationMs = completedLogs.reduce((s, l) => {
    if (!l.completedAt) return s
    return s + (l.completedAt.getTime() - l.startedAt.getTime())
  }, 0)
  const avgDurationMins =
    completedLogs.length > 0 ? Math.round(totalDurationMs / completedLogs.length / 60_000) : 0

  if (options?.summaryOnly) {
    return {
      days: [],
      summary: {
        avgDurationMins,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalWorkouts,
      },
    }
  }

  const detailedLogs = logs as Array<{
    completedAt: Date | null
    id: string
    startedAt: Date
    totalVolume: number | null
    workout: { id: string; kind: string | null; name: string } | null
  }>
  const dayMap = new Map<string, typeof detailedLogs>()
  for (const log of detailedLogs) {
    const dateKey = formatUtcDateOnly(log.startedAt)
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, [])
    dayMap.get(dateKey)!.push(log)
  }

  return {
    days: Array.from(dayMap.entries()).map(([date, dayLogs]) => ({
      date,
      logs: dayLogs.map((log) => ({
        completedAt: log.completedAt ? log.completedAt.toISOString() : null,
        id: log.id,
        startedAt: log.startedAt.toISOString(),
        totalVolume: log.totalVolume ?? 0,
        workoutId: log.workout?.id ?? "",
        workoutKind: log.workout?.kind ?? null,
        workoutName: log.workout?.name ?? "Workout",
      })),
    })),
    summary: {
      avgDurationMins,
      totalVolume: Math.round(totalVolume * 10) / 10,
      totalWorkouts,
    },
  }
}

async function getYearViewForTrainee(profile: SerializedProfile, year: number) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  const logs = await db.workoutLog.findMany({
    orderBy: { startedAt: "asc" },
    select: { startedAt: true, totalVolume: true },
    where: {
      startedAt: { gte: start, lt: end },
      userId: profile.id,
    },
  })

  const dayMap = new Map<string, { count: number; volume: number }>()
  for (const log of logs) {
    const dateKey = formatUtcDateOnly(log.startedAt)
    const existing = dayMap.get(dateKey) ?? { count: 0, volume: 0 }
    dayMap.set(dateKey, {
      count: existing.count + 1,
      volume: existing.volume + (log.totalVolume ?? 0),
    })
  }

  const days = Array.from(dayMap.entries()).map(([date, data]) => ({
    count: data.count,
    date,
    volume: Math.round(data.volume * 10) / 10,
  }))

  return { days, year }
}

async function getWorkoutLogDetailForTrainee(profile: SerializedProfile, logId: string) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const log = await db.workoutLog.findUnique({
    include: WORKOUT_LOG_INCLUDE,
    where: { id: logId, userId: profile.id },
  })

  if (!log) {
    throw new AuthServiceError("Workout log không tồn tại.", 404)
  }

  return serializeWorkoutLog(log as WorkoutLogRecord)
}

async function resetCurrentTraineeData(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const [meals, workoutLogs, bodyMetrics, coachCheckIns, personalPrograms] = await db.$transaction([
    db.meal.deleteMany({
      where: {
        userId: profile.id,
      },
    }),
    db.workoutLog.deleteMany({
      where: {
        userId: profile.id,
      },
    }),
    db.bodyMetricEntry.deleteMany({
      where: {
        traineeId: profile.id,
      },
    }),
    db.coachCheckIn.deleteMany({
      where: {
        traineeId: profile.id,
      },
    }),
    db.program.deleteMany({
      where: {
        createdById: profile.id,
      },
    }),
  ])

  return {
    message: "Đã reset dữ liệu tracking của trainee.",
    resetCounts: {
      bodyMetrics: bodyMetrics.count,
      coachCheckIns: coachCheckIns.count,
      meals: meals.count,
      personalPrograms: personalPrograms.count,
      workoutLogs: workoutLogs.count,
    },
  }
}

async function createCoachCheckInForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  input: {
    adherenceScore?: number | null
    checkInDate?: string | null
    energyScore?: number | null
    feedback: string
    moodScore?: number | null
    nextFocus?: string | null
    recoveryScore?: number | null
    summary?: string | null
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  await assertCoachOwnsTrainee(profile.id, traineeId)

  const feedback = input.feedback.trim()

  if (!feedback) {
    throw new AuthServiceError("Feedback không được để trống.", 400)
  }

  const checkIn = await db.coachCheckIn.create({
    data: {
      adherenceScore: sanitizeScore(input.adherenceScore),
      checkInDate: input.checkInDate ? new Date(input.checkInDate) : new Date(),
      coachId: profile.id,
      energyScore: sanitizeScore(input.energyScore),
      feedback,
      moodScore: sanitizeScore(input.moodScore),
      nextFocus: input.nextFocus?.trim() || undefined,
      recoveryScore: sanitizeScore(input.recoveryScore),
      summary: input.summary?.trim() || undefined,
      traineeId,
    },
    include: {
      coach: true,
    },
  })

  return serializeCoachCheckIn(checkIn as CoachCheckInRecord)
}

async function listCoachWorkoutLogsForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  options?: { cursor?: string; limit?: number; weekStart?: string },
) {
  const db = ensurePrisma()
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)

  const take = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const parsedWeekStart = options?.weekStart ? parseLocalDateInput(options.weekStart) : undefined

  if (options?.weekStart && !parsedWeekStart) {
    throw new AuthServiceError("weekStart không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  const weekEnd = parsedWeekStart ? addLocalDays(parsedWeekStart, 7) : undefined
  const workoutLogs = await db.workoutLog.findMany({
    cursor: options?.cursor ? { id: options.cursor } : undefined,
    include: WORKOUT_LOG_INCLUDE,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    skip: options?.cursor ? 1 : 0,
    take: take + 1,
    where: {
      ...(parsedWeekStart && weekEnd
        ? {
            startedAt: {
              gte: parsedWeekStart,
              lt: weekEnd,
            },
          }
        : {}),
      userId: traineeId,
    },
  })

  const hasMore = workoutLogs.length > take
  const visibleLogs = hasMore ? workoutLogs.slice(0, take) : workoutLogs

  return {
    logs: visibleLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    nextCursor: hasMore ? visibleLogs[visibleLogs.length - 1]?.id : undefined,
  }
}

async function createWorkoutLogCommentForCoach(
  profile: SerializedProfile,
  workoutLogId: string,
  input: { content: string },
) {
  const db = ensurePrisma()
  assertCoach(profile)
  await assertCoachOwnsWorkoutLog(profile.id, workoutLogId)

  const content = input.content.trim()

  if (!content) {
    throw new AuthServiceError("Feedback không được để trống.", 400)
  }

  const comment = await db.workoutLogComment.create({
    data: {
      authorId: profile.id,
      content,
      workoutLogId,
    },
    include: WORKOUT_LOG_COMMENT_INCLUDE,
  })

  return serializeWorkoutLogComment(comment as WorkoutLogCommentRecord)
}

async function updateWorkoutLogCommentForCoach(
  profile: SerializedProfile,
  commentId: string,
  input: { content: string },
) {
  const db = ensurePrisma()
  assertCoach(profile)
  const existingComment = await assertCoachOwnsWorkoutLogComment(profile.id, commentId)

  if (existingComment.authorId !== profile.id) {
    throw new AuthServiceError("Bạn chỉ có thể sửa feedback do chính mình tạo.", 403)
  }

  const content = input.content.trim()

  if (!content) {
    throw new AuthServiceError("Feedback không được để trống.", 400)
  }

  const comment = await db.workoutLogComment.update({
    data: {
      content,
    },
    include: WORKOUT_LOG_COMMENT_INCLUDE,
    where: {
      id: commentId,
    },
  })

  return serializeWorkoutLogComment(comment as WorkoutLogCommentRecord)
}

async function deleteWorkoutLogCommentForCoach(profile: SerializedProfile, commentId: string) {
  const db = ensurePrisma()
  assertCoach(profile)
  const existingComment = await assertCoachOwnsWorkoutLogComment(profile.id, commentId)

  if (existingComment.authorId !== profile.id) {
    throw new AuthServiceError("Bạn chỉ có thể xóa feedback do chính mình tạo.", 403)
  }

  await db.workoutLogComment.delete({
    where: {
      id: commentId,
    },
  })

  return {
    deleted: true,
    id: commentId,
  }
}

async function listCoachTrainees(profile: SerializedProfile, options?: { phone?: string }) {
  assertCoach(profile)
  const db = ensurePrisma()
  const trainees = await db.user.findMany({
    include: {
      _count: {
        select: {
          programAssignments: true,
          workoutLogs: true,
        },
      },
      programAssignments: {
        include: {
          program: {
            select: {
              id: true,
              workoutsPerWeek: true,
            },
          },
        },
        orderBy: {
          assignedAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      coachId: profile.id,
      role: UserRole.trainee,
    },
  })

  const phoneQuery = normalizePhoneNumber(options?.phone)
  const filteredTrainees = phoneQuery
    ? trainees.filter((trainee) => normalizePhoneNumber(trainee.phone).includes(phoneQuery))
    : trainees

  const traineeIds = filteredTrainees.map((trainee) => trainee.id)
  const recentWindow = toRecentWindow(7)
  const [recentLogs, recentMetrics, recentCheckIns] = traineeIds.length
    ? await Promise.all([
        db.workoutLog.findMany({
          select: {
            userId: true,
          },
          where: {
            startedAt: {
              gte: recentWindow.start,
              lte: recentWindow.end,
            },
            userId: {
              in: traineeIds,
            },
          },
        }),
        db.bodyMetricEntry.findMany({
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          select: {
            recordedAt: true,
            traineeId: true,
            weightKg: true,
          },
          where: {
            traineeId: {
              in: traineeIds,
            },
          },
        }),
        db.coachCheckIn.findMany({
          orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
          select: {
            checkInDate: true,
            traineeId: true,
          },
          where: {
            traineeId: {
              in: traineeIds,
            },
          },
        }),
      ])
    : [[], [], []]

  const thisWeekByUser = recentLogs.reduce<Map<string, number>>((accumulator, log) => {
    accumulator.set(log.userId, (accumulator.get(log.userId) ?? 0) + 1)
    return accumulator
  }, new Map())

  const latestMetricByUser = recentMetrics.reduce<Map<string, { recordedAt: Date; weightKg: number | null }>>(
    (accumulator, metric) => {
      if (!accumulator.has(metric.traineeId)) {
        accumulator.set(metric.traineeId, {
          recordedAt: metric.recordedAt,
          weightKg: metric.weightKg,
        })
      }

      return accumulator
    },
    new Map(),
  )

  const latestCheckInByUser = recentCheckIns.reduce<Map<string, Date>>((accumulator, checkIn) => {
    if (!accumulator.has(checkIn.traineeId)) {
      accumulator.set(checkIn.traineeId, checkIn.checkInDate)
    }

    return accumulator
  }, new Map())

  return filteredTrainees.map((trainee) => ({
    assignedProgramIds: trainee.programAssignments.map((assignment) => assignment.programId),
    avatar: trainee.avatar,
    completionRate:
      trainee.programAssignments.reduce((sum, assignment) => sum + assignment.program.workoutsPerWeek, 0) > 0
        ? Math.min(
            100,
            Math.round(
              ((thisWeekByUser.get(trainee.id) ?? 0) /
                trainee.programAssignments.reduce((sum, assignment) => sum + assignment.program.workoutsPerWeek, 0)) *
                100,
            ),
          )
        : 0,
    createdAt: trainee.createdAt,
    email: trainee.email,
    fitnessGoals: trainee.fitnessGoals,
    id: trainee.id,
    lastCheckInAt: latestCheckInByUser.get(trainee.id),
    latestWeightKg: latestMetricByUser.get(trainee.id)?.weightKg ?? undefined,
    name: trainee.name,
    phone: trainee.phone ?? undefined,
    plannedSessionsPerWeek: trainee.programAssignments.reduce((sum, assignment) => sum + assignment.program.workoutsPerWeek, 0),
    programCount: trainee._count.programAssignments,
    thisWeekWorkouts: thisWeekByUser.get(trainee.id) ?? 0,
    totalWorkoutLogs: trainee._count.workoutLogs,
  }))
}

async function getCoachTraineeDetail(profile: SerializedProfile, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const trainee = await db.user.findFirst({
    include: {
      _count: {
        select: {
          programAssignments: true,
          workoutLogs: true,
        },
      },
      programAssignments: {
        include: {
          program: {
            include: PROGRAM_INCLUDE,
          },
        },
      },
      workoutLogs: {
        include: WORKOUT_LOG_INCLUDE,
        orderBy: {
          startedAt: "desc",
        },
        take: 10,
      },
    },
    where: {
      coachId: profile.id,
      id: traineeId,
      role: UserRole.trainee,
    },
  })

  if (!trainee) {
    throw new AuthServiceError("Không tìm thấy trainee.", 404)
  }

  const recentWindow = toRecentWindow(7)
  const last30Days = toRecentWindow(30)
  const [thisWeekWorkouts, progressLogs, bodyMetrics, checkIns] = await Promise.all([
    db.workoutLog.count({
      where: {
        startedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        userId: trainee.id,
      },
    }),
    db.workoutLog.findMany({
      orderBy: {
        startedAt: "desc",
      },
      select: {
        startedAt: true,
        totalVolume: true,
      },
      where: {
        startedAt: {
          gte: last30Days.start,
          lte: last30Days.end,
        },
        userId: trainee.id,
      },
    }),
    db.bodyMetricEntry.findMany({
      include: {
        coach: true,
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      where: {
        traineeId: trainee.id,
      },
    }),
    db.coachCheckIn.findMany({
      include: {
        coach: true,
      },
      orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
      take: 8,
      where: {
        traineeId: trainee.id,
      },
    }),
  ])

  const plannedSessionsPerWeek = trainee.programAssignments.reduce(
    (sum, assignment) => sum + assignment.program.workoutsPerWeek,
    0,
  )
  const totalVolumeLast30Days = progressLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const completionRate =
    plannedSessionsPerWeek > 0 ? Math.min(100, Math.round((thisWeekWorkouts / plannedSessionsPerWeek) * 100)) : 0

  return {
    bodyMetrics: bodyMetrics.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord)),
    checkIns: checkIns.map((entry) => serializeCoachCheckIn(entry as CoachCheckInRecord)),
    programs: trainee.programAssignments.map((assignment) => serializeProgram(assignment.program as ProgramRecord)),
    progressSummary: {
      completionRate,
      latestWorkoutAt: trainee.workoutLogs[0]?.startedAt ?? progressLogs[0]?.startedAt ?? undefined,
      plannedSessionsPerWeek,
      totalVolumeLast30Days,
      workoutsLast30Days: progressLogs.length,
      workoutsLast7Days: thisWeekWorkouts,
    },
    recentLogs: trainee.workoutLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    trainee: {
      assignedProgramIds: trainee.programAssignments.map((assignment) => assignment.programId),
      avatar: trainee.avatar,
      completionRate,
      createdAt: trainee.createdAt,
      email: trainee.email,
      fitnessGoals: trainee.fitnessGoals,
      id: trainee.id,
      lastCheckInAt: checkIns[0]?.checkInDate,
      latestWeightKg: bodyMetrics[0]?.weightKg ?? undefined,
      name: trainee.name,
      phone: trainee.phone ?? undefined,
      plannedSessionsPerWeek,
      programCount: trainee._count.programAssignments,
      thisWeekWorkouts,
      totalWorkoutLogs: trainee._count.workoutLogs,
    },
  }
}

async function getCoachDashboard(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const recentWindow = toRecentWindow(7)
  const [trainees, pendingRequests, recentWorkoutLogs, weeklyLogs, unreadNotificationCount] = await Promise.all([
    listCoachTrainees(profile),
    db.coachRequest.findMany({
      include: {
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        coachId: profile.id,
        status: CoachRequestStatus.pending,
      },
    }),
    db.workoutLog.findMany({
      include: {
        _count: {
          select: {
            comments: true,
          },
        },
        user: true,
        workout: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 8,
      where: {
        user: {
          coachId: profile.id,
        },
      },
    }),
    db.workoutLog.findMany({
      select: {
        startedAt: true,
        totalVolume: true,
      },
      where: {
        startedAt: {
          gte: recentWindow.start,
          lte: recentWindow.end,
        },
        user: {
          coachId: profile.id,
        },
      },
    }),
    db.notification.count({
      where: {
        readAt: null,
        status: {
          not: NotificationStatus.cancelled,
        },
        userId: profile.id,
      },
    }),
  ])

  const workoutsThisWeek = trainees.reduce((sum, trainee) => sum + trainee.thisWeekWorkouts, 0)
  const totalPlannedSessions = trainees.reduce((sum, trainee) => sum + (trainee.plannedSessionsPerWeek ?? 0), 0)
  const averageCompletionRate =
    trainees.length > 0
      ? Math.round(trainees.reduce((sum, trainee) => sum + (trainee.completionRate ?? 0), 0) / trainees.length)
      : 0
  const atRiskTrainees = trainees
    .filter((trainee) => (trainee.plannedSessionsPerWeek ?? 0) > 0 && (trainee.completionRate ?? 0) < 50)
    .sort((left, right) => {
      const completionDelta = (left.completionRate ?? 0) - (right.completionRate ?? 0)

      if (completionDelta !== 0) {
        return completionDelta
      }

      return (left.thisWeekWorkouts ?? 0) - (right.thisWeekWorkouts ?? 0)
    })
    .slice(0, 5)

  const activityByDay = Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(recentWindow.start)
    date.setDate(recentWindow.start.getDate() + index)
    const dayKey = date.toISOString().slice(0, 10)
    const dayLogs = weeklyLogs.filter((log) => log.startedAt.toISOString().slice(0, 10) === dayKey)

    return {
      date,
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      totalVolume: Math.round(dayLogs.reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)),
      workouts: dayLogs.length,
    }
  })

  return {
    activityByDay,
    atRiskTrainees,
    pendingRequests: pendingRequests.map(serializeCoachRequest),
    recentWorkoutLogs: recentWorkoutLogs.map((log) => ({
      commentCount: log._count.comments,
      completedAt: log.completedAt ?? undefined,
      id: log.id,
      startedAt: log.startedAt,
      totalVolume: log.totalVolume ?? undefined,
      trainee: serializeMiniUser(log.user),
      workout: log.workout
        ? {
            id: log.workout.id,
            name: log.workout.name,
          }
        : {
            id: log.workoutId ?? log.id,
            name: "Workout",
          },
    })),
    summary: {
      atRiskTraineeCount: atRiskTrainees.length,
      averageCompletionRate,
      totalPlannedSessions,
      totalTrainees: trainees.length,
      unreadNotificationCount,
      workoutsThisWeek,
    },
    trainees,
  }
}

async function listNotificationsForUser(profile: SerializedProfile, options?: { limit?: number }) {
  const db = ensurePrisma()
  const take = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const notifications = await db.notification.findMany({
    orderBy: [{ readAt: "asc" }, { scheduledFor: "desc" }, { createdAt: "desc" }],
    take,
    where: {
      status: {
        not: NotificationStatus.cancelled,
      },
      userId: profile.id,
    },
  })
  const unreadCount = await db.notification.count({
    where: {
      readAt: null,
      status: {
        not: NotificationStatus.cancelled,
      },
      userId: profile.id,
    },
  })

  return {
    notifications: notifications.map((notification) => serializeNotification(notification)),
    unreadCount,
  }
}

async function markNotificationAsReadForUser(profile: SerializedProfile, notificationId: string) {
  const db = ensurePrisma()
  const existingNotification = await db.notification.findFirst({
    where: {
      id: notificationId,
      userId: profile.id,
    },
  })

  if (!existingNotification) {
    throw new AuthServiceError("Không tìm thấy notification.", 404)
  }

  const notification = await db.notification.update({
    data: {
      readAt: existingNotification.readAt ?? new Date(),
    },
    where: {
      id: notificationId,
    },
  })

  return serializeNotification(notification)
}

async function markAllNotificationsAsReadForUser(profile: SerializedProfile) {
  const db = ensurePrisma()
  const result = await db.notification.updateMany({
    data: {
      readAt: new Date(),
    },
    where: {
      readAt: null,
      status: {
        not: NotificationStatus.cancelled,
      },
      userId: profile.id,
    },
  })

  return {
    updatedCount: result.count,
  }
}

async function updateCoachRequestStatus(
  profile: SerializedProfile,
  requestId: string,
  status: CoachRequestStatus,
) {
  const db = ensurePrisma()
  assertCoach(profile)

  if (status === CoachRequestStatus.pending) {
    throw new AuthServiceError("Trạng thái cập nhật không hợp lệ.", 400)
  }

  const existingRequest = await db.coachRequest.findFirst({
    include: {
      trainee: true,
    },
    where: {
      coachId: profile.id,
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status !== CoachRequestStatus.pending) {
    throw new AuthServiceError("Coach request này đã được xử lý.", 400)
  }

  const updatedRequest = await db.$transaction(async (transaction) => {
    const request = await transaction.coachRequest.update({
      data: {
        status,
      },
      include: {
        trainee: true,
      },
      where: {
        id: requestId,
      },
    })

    if (status === CoachRequestStatus.approved) {
      await transaction.user.update({
        data: {
          coachId: profile.id,
        },
        where: {
          id: existingRequest.traineeId,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          id: {
            not: requestId,
          },
          status: CoachRequestStatus.pending,
          traineeId: existingRequest.traineeId,
        },
      })
    }

    return request
  })

  return serializeCoachRequest(updatedRequest)
}

export {
  adjustCoachProgramForTrainee,
  assignCoachProgramToTrainee,
  createBodyMetricForTrainee,
  createBodyMetricForCurrentTrainee,
  createCoachCheckInForTrainee,
  createCoachExercise,
  createCoachRequestForTrainee,
  createCoachProgram,
  createMealForUser,
  createPersonalWorkoutForTrainee,
  createWorkoutLogForTrainee,
  createWorkoutLogCommentForCoach,
  deleteCoachExercise,
  deleteCoachProgram,
  deleteMealForUser,
  deletePersonalWorkoutForTrainee,
  deleteWorkoutLogCommentForCoach,
  deleteWorkoutLogForTrainee,
  getCoachDashboard,
  getDashboardForTrainee,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  getCalendarForTrainee,
  getProgressAnalyticsForCurrentTrainee,
  getWorkoutDetailForTrainee,
  getWorkoutLogDetailForTrainee,
  getYearViewForTrainee,
  listAvailableCoachesForTrainee,
  listBodyMetricsForCurrentTrainee,
  listExerciseLibrary,
  listCoachExercises,
  listCoachPrograms,
  listCoachWorkoutLogsForTrainee,
  listCoachTrainees,
  listExercises,
  listMealHistoryForUser,
  listMealsForUser,
  listNotificationsForUser,
  listWorkoutsForTrainee,
  markAllNotificationsAsReadForUser,
  markNotificationAsReadForUser,
  resetCurrentTraineeData,
  unassignCoachProgramFromTrainee,
  updateCoachExercise,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateMealForUser,
  updatePersonalWorkoutForTrainee,
  updateWorkoutLogCommentForCoach,
}
