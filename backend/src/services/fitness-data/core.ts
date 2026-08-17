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
  type VariationMuscleTarget,
  type ExerciseImportRequest,
} from "@prisma/client"
import { randomUUID } from "node:crypto"

import { AuthServiceError, type SerializedProfile } from "../auth.service"
import { MEAL_WITH_FOOD_INCLUDE, serializeMealRecord } from "../meal-log.service"
import {
  CACHE_KEYS,
  EXERCISE_LIBRARY_TTL_MS,
  invalidateExerciseLibrary,
  libraryCache,
} from "../../lib/library-cache"
import { isN8nLogExportEnabled, sendWebhookPayloadToN8n } from "../n8n-log-export.service"
import { logger } from "../../lib/logger"
import { retryTransaction } from "../../lib/prisma"
import {
  buildApprovedMuscleProfileData,
  buildApprovedMuscleProfileUpdate,
  legacyMuscleGroupToSlugs,
  legacyMuscleGroupsForSlug,
  muscleProfileInputSchema,
  parseMuscleListValue,
  serializePublicMuscleProfile,
  type ExerciseActivityTypeValue,
  type MuscleProfileInput,
  type MuscleSlugValue,
} from "../../domain/muscle-profile"
import { enrichExerciseSnapshot, type SnapshotMuscleProfile } from "../../domain/workout-muscle-snapshot"
import {
  addUtcDays,
  DAY_IN_MS,
  DAY_LABELS,
  DISPLAY_WEEKDAY_ORDER,
  formatUtcDateOnly,
  getUtcMonthBounds,
  parseLocalDateInput,
  parseScheduledDateInput,
  startOfUtcDay,
  startOfUtcWeek,
  toDateRange,
  toRecentWindow,
} from "./shared/dates"
import {
  buildMuscleGroupDistribution,
  buildPersonalRecords,
  buildStrengthProgression,
  buildWeeklyVolume,
  calculateWorkoutStreaks,
  calculateWorkoutVolume,
  type ProgressAnalyticsLogRecord,
} from "./shared/analytics"
import { assertCoach, assertCoachOwnsTrainee, assertTrainee, ensurePrisma } from "./shared/guards"
import {
  getSnapshotExerciseId,
  getSnapshotVariationId,
  parseWorkoutLogSnapshotExercises,
  toFiniteNumber,
  type WorkoutLogSnapshotExercise,
} from "./shared/workout-snapshot"

// Narrow projections of the User relation so list queries don't drag the full
// ~20-column row (email/phone/avatar/goal arrays/timestamps) per joined record.
const MINI_USER_SELECT = {
  avatar: true,
  email: true,
  id: true,
  name: true,
} satisfies Prisma.UserSelect

const TRAINEE_SUMMARY_SELECT = {
  avatar: true,
  email: true,
  fitnessGoals: true,
  id: true,
  name: true,
} satisfies Prisma.UserSelect

const IMPORT_REVIEWER_SELECT = {
  avatar: true,
  email: true,
  id: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect

const WORKOUT_EXERCISE_INCLUDE = {
  sets: {
    orderBy: {
      setNumber: "asc",
    },
  },
  variation: {
    include: {
      exercise: true,
      muscleTargets: true,
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
  author: {
    select: {
      avatar: true,
      name: true,
    },
  },
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
      user: {
        select: TRAINEE_SUMMARY_SELECT,
      },
    },
  },
  workouts: {
    include: WORKOUT_INCLUDE,
    orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }, { createdAt: "asc" }],
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

type TraineeProgramAssignmentWithWorkouts = Prisma.ProgramAssignmentGetPayload<{
  include: {
    program: {
      include: {
        workouts: {
          include: typeof WORKOUT_INCLUDE
        }
      }
    }
  }
}>

type CoachUpdate = {
  field?: "weight" | "rir" | "sets" | "reps" | "exercise" | "notes"
  newValue?: number | string
  oldValue?: number | string
  text: string
  type: "weight_up" | "weight_down" | "rir_down" | "rir_up" | "edit"
}

type WorkoutLogRecord = Prisma.WorkoutLogGetPayload<{
  include: typeof WORKOUT_LOG_INCLUDE
}>

type CoachExerciseRecord = Prisma.ExerciseGetPayload<{
  include: {
    createdBy: { select: { name: true } }
    variations: {
      include: {
        _count: {
          select: {
            workoutExercises: true
          }
        }
        muscleTargets: true
      }
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }
  }
}>

type NotificationRecord = Notification

type ImportReviewerUser = Pick<User, "avatar" | "email" | "id" | "name" | "role">

type ExerciseImportRequestRecord = ExerciseImportRequest & {
  reviewedBy: ImportReviewerUser | null
  submittedBy: ImportReviewerUser
}

type ExerciseImportRowInput = {
  activityType?: string
  exerciseName?: string
  equipment?: string
  isDefault?: boolean
  muscleGroup?: string
  primaryMuscles?: string[] | string
  rowNumber?: number
  sortOrder?: number
  secondaryMuscles?: string[] | string
  variationName?: string
}


type PreviousSetPerformanceSource = "most_recent" | "same_weekday_last_week"

type PreviousExerciseSetPerformance = {
  completedAt: Date
  reps?: number
  rir?: number
  source: PreviousSetPerformanceSource
  weight?: number
}



type BodyMetricRecord = BodyMetricEntry & {
  coach: Pick<User, "name"> | null
}

type BodyMetricListOptions = {
  days?: number
  from?: string
  to?: string
}

type CoachCheckInRecord = CoachCheckIn & {
  coach: Pick<User, "name">
}

type PersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    notes?: string
    repsMin?: number
    rir?: number
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

type CoachProgramInput = {
  assignToUserIds?: string[]
  description?: string | null
  difficulty: ProgramDifficulty
  duration: number
  name: string
  workouts: Array<{
    duration?: number
    exercises: Array<{
      repsMin?: number
      rir?: number
      restTime?: number
      variationId: string
      reps: number
      sets: number
      weight?: number
    }>
    name: string
    scheduledDay?: number
    scheduledDate?: string
    weekIndex?: number
  }>
}

type NormalizedPersonalWorkoutInput = {
  duration?: number
  exercises: Array<{
    notes?: string
    repsMin?: number
    rir?: number
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

type VariationWithMuscleTargets = Variation & { muscleTargets?: VariationMuscleTarget[] }

function serializeVariation(variation: VariationWithMuscleTargets, legacyMuscleGroup?: string | null) {
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
    ...serializePublicMuscleProfile({
      ...variation,
      muscleTargets: variation.muscleTargets ?? [],
    }, legacyMuscleGroup),
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

function sanitizeImportText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeCoachExerciseImportRows(rows: ExerciseImportRowInput[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthServiceError("File import không có dữ liệu bài tập hợp lệ.", 400)
  }

  if (rows.length > 1000) {
    throw new AuthServiceError("Chỉ hỗ trợ import tối đa 1000 dòng mỗi lần.", 400)
  }

  const sanitizedRows = rows.map((row, index) => {
    const muscleProfileResult = muscleProfileInputSchema.safeParse({
      activityType: sanitizeImportText(row.activityType),
      primaryMuscles: parseMuscleListValue(row.primaryMuscles),
      secondaryMuscles: parseMuscleListValue(row.secondaryMuscles),
    })

    return {
      exerciseName: sanitizeImportText(row.exerciseName),
      equipment: sanitizeImportText(row.equipment),
      isDefault: row.isDefault === true,
      muscleGroup: sanitizeImportText(row.muscleGroup),
      muscleProfile: muscleProfileResult.success ? muscleProfileResult.data : undefined,
      rowNumber: row.rowNumber ?? index + 2,
      sortOrder:
        typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
          ? Math.max(0, Math.round(row.sortOrder))
          : undefined,
      variationName: sanitizeImportText(row.variationName) ?? "Default",
    }
  })

  const invalidRows = sanitizedRows.filter(
    (row) => !row.exerciseName || !row.muscleGroup || row.muscleGroup.toLowerCase() === "full body" || !row.variationName || !row.muscleProfile,
  )

  if (invalidRows.length > 0) {
    const invalidPreview = invalidRows
      .slice(0, 5)
      .map((row) => row.rowNumber)
      .join(", ")

    throw new AuthServiceError(
      `Có dòng thiếu thông tin hoặc muscle profile không hợp lệ. Kiểm tra lại các dòng: ${invalidPreview}${invalidRows.length > 5 ? "..." : ""}`,
      400,
    )
  }

  return sanitizedRows.map((row) => ({
    exerciseName: row.exerciseName as string,
    equipment: row.equipment,
    isDefault: row.isDefault,
    muscleGroup: row.muscleGroup as string,
    activityType: (row.muscleProfile as MuscleProfileInput).activityType,
    primaryMuscles: (row.muscleProfile as MuscleProfileInput).primaryMuscles,
    rowNumber: row.rowNumber,
    sortOrder: row.sortOrder,
    secondaryMuscles: (row.muscleProfile as MuscleProfileInput).secondaryMuscles,
    variationName: row.variationName as string,
  }))
}

function serializeExerciseImportRequest(request: ExerciseImportRequestRecord) {
  return {
    createdAt: request.createdAt,
    fileName: request.fileName ?? undefined,
    id: request.id,
    result:
      request.result && typeof request.result === "object" && !Array.isArray(request.result)
        ? (request.result as Record<string, unknown>)
        : undefined,
    reviewedAt: request.reviewedAt ?? undefined,
    reviewedBy: request.reviewedBy
      ? {
          avatar: request.reviewedBy.avatar,
          email: request.reviewedBy.email,
          id: request.reviewedBy.id,
          name: request.reviewedBy.name,
          role: request.reviewedBy.role,
        }
      : null,
    reviewNote: request.reviewNote ?? undefined,
    rowCount: request.rowCount,
    rows: Array.isArray(request.rows) ? request.rows : [],
    status: request.status,
    submittedBy: {
      avatar: request.submittedBy.avatar,
      email: request.submittedBy.email,
      id: request.submittedBy.id,
      name: request.submittedBy.name,
      role: request.submittedBy.role,
    },
    updatedAt: request.updatedAt,
  }
}

function serializeVariationOption(
  variation: VariationWithMuscleTargets & { exercise: Exercise & { createdById?: string | null } },
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
    ...serializePublicMuscleProfile({
      ...variation,
      muscleTargets: variation.muscleTargets ?? [],
    }, variation.exercise.muscleGroup),
  }
}

function serializePreviousSetPerformance(previousPerformance: PreviousExerciseSetPerformance) {
  return {
    completedAt: previousPerformance.completedAt,
    reps: previousPerformance.reps,
    rir: previousPerformance.rir,
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

function buildExerciseSetsWithHistory(
  templateSets: ExerciseSet[],
  previousPerformanceBySetNumber: Map<number, PreviousExerciseSetPerformance> | undefined,
): ReturnType<typeof serializeExerciseSet>[] {
  const sorted = templateSets.slice().sort((a, b) => a.setNumber - b.setNumber)
  return sorted.map((set) => serializeExerciseSet(set, previousPerformanceBySetNumber))
}

function serializeWorkout(
  workout: WorkoutRecord,
  options?: {
    coachUpdatesByWorkoutExerciseId?: Map<string, CoachUpdate>
    hasCoachUpdate?: boolean
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
        coachUpdate: options?.coachUpdatesByWorkoutExerciseId?.get(workoutExercise.id),
        exercise: serializeExerciseBase(workoutExercise.variation.exercise),
        id: workoutExercise.id,
        notes: workoutExercise.notes ?? undefined,
        restTime: workoutExercise.restTime ?? undefined,
        sets: buildExerciseSetsWithHistory(
          workoutExercise.sets,
          options?.previousPerformanceByWorkoutExerciseId?.get(workoutExercise.id),
        ),
        variation: serializeVariation(workoutExercise.variation, workoutExercise.variation.exercise.muscleGroup),
      })),
    ...(options?.hasCoachUpdate ? { hasCoachUpdate: true } : {}),
    id: workout.id,
    isPersonal: options?.isPersonal ?? false,
    kind: workout.kind ?? undefined,
    name: workout.name,
    notes: workout.notes ?? undefined,
    programId: workout.programId ?? undefined,
    scheduledDay: workout.scheduledDay ?? undefined,
    scheduledDate: workout.scheduledDate ? formatUtcDateOnly(workout.scheduledDate) : undefined,
    weekIndex: workout.weekIndex ?? undefined,
  }
}

function formatPlanNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "")
}

function formatNullablePlanNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatPlanNumber(value) : "—"
}

function formatRepTargetForCoachUpdate(set: ExerciseSet) {
  return set.targetRepsMin ? `${set.targetRepsMin}-${set.targetReps}` : String(set.targetReps)
}

function normalizeProgramMatchLabel(value: string) {
  return value.trim().toLowerCase()
}

function readPreviousProgramIdFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined

  const previousProgramId = (metadata as { previousProgramId?: unknown }).previousProgramId
  return typeof previousProgramId === "string" && previousProgramId.trim() ? previousProgramId : undefined
}

function readUpdatedWorkoutIdsFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return []

  const updatedWorkoutIds = (metadata as { updatedWorkoutIds?: unknown }).updatedWorkoutIds
  if (!Array.isArray(updatedWorkoutIds)) return []

  return updatedWorkoutIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
}

function isCoachUpdate(value: unknown): value is CoachUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false

  const update = value as { text?: unknown; type?: unknown }
  return (
    typeof update.text === "string" &&
    ["weight_up", "weight_down", "rir_down", "rir_up", "edit"].includes(String(update.type))
  )
}

function readCoachUpdatesByWorkoutIdFromMetadata(metadata: Prisma.JsonValue | null) {
  const updatesByWorkoutId = new Map<string, Map<string, CoachUpdate>>()

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return updatesByWorkoutId

  const rawUpdates = (metadata as { coachUpdatesByWorkoutId?: unknown }).coachUpdatesByWorkoutId
  if (!rawUpdates || typeof rawUpdates !== "object" || Array.isArray(rawUpdates)) return updatesByWorkoutId

  Object.entries(rawUpdates as Record<string, unknown>).forEach(([workoutId, rawExerciseUpdates]) => {
    if (!rawExerciseUpdates || typeof rawExerciseUpdates !== "object" || Array.isArray(rawExerciseUpdates)) {
      return
    }

    const exerciseUpdates = new Map<string, CoachUpdate>()
    Object.entries(rawExerciseUpdates as Record<string, unknown>).forEach(([exerciseId, rawUpdate]) => {
      if (isCoachUpdate(rawUpdate)) {
        exerciseUpdates.set(exerciseId, rawUpdate)
      }
    })

    if (exerciseUpdates.size > 0) {
      updatesByWorkoutId.set(workoutId, exerciseUpdates)
    }
  })

  return updatesByWorkoutId
}

function normalizeWorkoutWeekIndex(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null
}

function normalizeWorkoutScheduledDay(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null
}

function normalizeWorkoutScheduledDate(value?: Date | string | null) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatUtcDateOnly(value)
  }

  const parsed = parseScheduledDateInput(value)
  return parsed ? formatUtcDateOnly(parsed) : null
}

function getWorkoutOccurrenceKey(workout: { scheduledDay?: number | null; scheduledDate?: Date | string | null; weekIndex?: number | null }) {
  const scheduledDate = normalizeWorkoutScheduledDate(workout.scheduledDate)
  if (scheduledDate) return `date:${scheduledDate}`

  const weekIndex = normalizeWorkoutWeekIndex(workout.weekIndex)
  const scheduledDay = normalizeWorkoutScheduledDay(workout.scheduledDay)
  if (weekIndex == null || scheduledDay == null) return undefined

  return `week:${weekIndex}|day:${scheduledDay}`
}

function buildReusableWorkoutIdsForProgramInput(
  previousProgram: ProgramRecord,
  nextWorkouts: CoachProgramInput["workouts"],
) {
  const previousByOccurrence = previousProgram.workouts.reduce<Map<string, WorkoutRecord[]>>((map, workout) => {
    const key = getWorkoutOccurrenceKey(workout)
    if (!key) return map
    const matches = map.get(key) ?? []
    matches.push(workout as WorkoutRecord)
    map.set(key, matches)
    return map
  }, new Map())

  return nextWorkouts.map((workout) => {
    const key = getWorkoutOccurrenceKey({
      scheduledDay: workout.scheduledDay ?? null,
      scheduledDate: workout.scheduledDate ?? null,
      weekIndex: workout.weekIndex ?? null,
    })
    if (!key) return undefined

    const matches = previousByOccurrence.get(key)
    return matches?.shift()?.id
  })
}

function findPreviousWorkoutForCoachUpdate(
  currentWorkout: { name: string; scheduledDay: number | null; scheduledDate?: Date | string | null; weekIndex?: number | null },
  previousProgram: ProgramRecord,
) {
  const currentName = normalizeProgramMatchLabel(currentWorkout.name)
  const currentOccurrenceKey = getWorkoutOccurrenceKey(currentWorkout)
  const byOccurrence = currentOccurrenceKey
    ? previousProgram.workouts.find((workout) => getWorkoutOccurrenceKey(workout) === currentOccurrenceKey)
    : undefined
  if (byOccurrence) return byOccurrence

  const byScheduleAndName = previousProgram.workouts.find(
    (workout) =>
      (workout.weekIndex ?? null) === (currentWorkout.weekIndex ?? null) &&
      workout.scheduledDay === currentWorkout.scheduledDay &&
      normalizeProgramMatchLabel(workout.name) === currentName,
  )
  if (byScheduleAndName) return byScheduleAndName

  const bySchedule = previousProgram.workouts.find(
    (workout) =>
      (workout.weekIndex ?? null) === (currentWorkout.weekIndex ?? null) &&
      workout.scheduledDay === currentWorkout.scheduledDay,
  )
  if (bySchedule) return bySchedule

  return previousProgram.workouts.find((workout) => normalizeProgramMatchLabel(workout.name) === currentName)
}

function buildExerciseCoachUpdate(
  currentExercise: WorkoutExerciseRecord,
  previousExercise?: WorkoutExerciseRecord,
): CoachUpdate | undefined {
  if (!previousExercise) {
    return {
      field: "exercise",
      newValue: currentExercise.variation.exercise.name,
      text: "New exercise",
      type: "edit",
    }
  }

  const currentSets = currentExercise.sets.slice().sort((left, right) => left.setNumber - right.setNumber)
  const previousSets = previousExercise.sets.slice().sort((left, right) => left.setNumber - right.setNumber)
  const currentFirstSet = currentSets[0]
  const previousFirstSet = previousSets[0]
  const changes: string[] = []
  let primaryUpdate: CoachUpdate | undefined

  if (previousExercise.variationId !== currentExercise.variationId) {
    changes.push(`${previousExercise.variation.exercise.name} → ${currentExercise.variation.exercise.name}`)
    primaryUpdate = {
      field: "exercise",
      newValue: currentExercise.variation.exercise.name,
      oldValue: previousExercise.variation.exercise.name,
      text: "",
      type: "edit",
    }
  }

  if (previousSets.length !== currentSets.length) {
    changes.push(`Sets ${previousSets.length} → ${currentSets.length}`)
    primaryUpdate ??= {
      field: "sets",
      newValue: currentSets.length,
      oldValue: previousSets.length,
      text: "",
      type: "edit",
    }
  }

  if (currentFirstSet && previousFirstSet) {
    const previousReps = formatRepTargetForCoachUpdate(previousFirstSet)
    const currentReps = formatRepTargetForCoachUpdate(currentFirstSet)

    if (previousReps !== currentReps) {
      changes.push(`Reps ${previousReps} → ${currentReps}`)
      primaryUpdate ??= {
        field: "reps",
        newValue: currentReps,
        oldValue: previousReps,
        text: "",
        type: "edit",
      }
    }

    if (previousFirstSet.weight !== currentFirstSet.weight) {
      changes.push(
        `Weight ${formatNullablePlanNumber(previousFirstSet.weight)}kg → ${formatNullablePlanNumber(currentFirstSet.weight)}kg`,
      )
      primaryUpdate ??= {
        field: "weight",
        newValue: currentFirstSet.weight ?? "—",
        oldValue: previousFirstSet.weight ?? "—",
        text: "",
        type:
          typeof previousFirstSet.weight === "number" &&
          typeof currentFirstSet.weight === "number" &&
          currentFirstSet.weight < previousFirstSet.weight
            ? "weight_down"
            : "weight_up",
      }
    }

    if (previousFirstSet.rir !== currentFirstSet.rir) {
      changes.push(`RIR ${formatNullablePlanNumber(previousFirstSet.rir)} → ${formatNullablePlanNumber(currentFirstSet.rir)}`)
      primaryUpdate ??= {
        field: "rir",
        newValue: currentFirstSet.rir ?? "—",
        oldValue: previousFirstSet.rir ?? "—",
        text: "",
        type:
          typeof previousFirstSet.rir === "number" &&
          typeof currentFirstSet.rir === "number" &&
          currentFirstSet.rir > previousFirstSet.rir
            ? "rir_up"
            : "rir_down",
      }
    }
  }

  if (!primaryUpdate || changes.length === 0) return undefined

  return {
    ...primaryUpdate,
    text: changes.join(" · "),
  }
}

function normalizeCoachProgramInputSetCount(value: number) {
  return Math.max(1, Math.round(value))
}

function normalizeCoachProgramInputOptionalInt(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined
}

function normalizeCoachProgramInputWeight(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : undefined
}

function buildExerciseCoachUpdateFromProgramInput(
  previousExercise: WorkoutExerciseRecord | undefined,
  nextExercise: CoachProgramInput["workouts"][number]["exercises"][number],
): CoachUpdate | undefined {
  if (!previousExercise) {
    return {
      field: "exercise",
      text: "New exercise",
      type: "edit",
    }
  }

  const previousSets = previousExercise.sets.slice().sort((left, right) => left.setNumber - right.setNumber)
  const previousFirstSet = previousSets[0]
  const changes: string[] = []
  let primaryUpdate: CoachUpdate | undefined

  if (previousExercise.variationId !== nextExercise.variationId) {
    changes.push("Exercise updated")
    primaryUpdate = {
      field: "exercise",
      text: "",
      type: "edit",
    }
  }

  const nextSetCount = normalizeCoachProgramInputSetCount(nextExercise.sets)
  if (previousSets.length !== nextSetCount) {
    changes.push(`Sets ${previousSets.length} → ${nextSetCount}`)
    primaryUpdate ??= {
      field: "sets",
      newValue: nextSetCount,
      oldValue: previousSets.length,
      text: "",
      type: "edit",
    }
  }

  if (previousFirstSet) {
    const nextRepTarget = normalizeRepTarget(nextExercise.reps, nextExercise.repsMin)
    const previousReps = formatRepTargetForCoachUpdate(previousFirstSet)
    const nextReps = nextRepTarget.repsMin ? `${nextRepTarget.repsMin}-${nextRepTarget.reps}` : String(nextRepTarget.reps)

    if (previousReps !== nextReps) {
      changes.push(`Reps ${previousReps} → ${nextReps}`)
      primaryUpdate ??= {
        field: "reps",
        newValue: nextReps,
        oldValue: previousReps,
        text: "",
        type: "edit",
      }
    }

    const nextWeight = normalizeCoachProgramInputWeight(nextExercise.weight)
    if ((previousFirstSet.weight ?? undefined) !== nextWeight) {
      changes.push(`Weight ${formatNullablePlanNumber(previousFirstSet.weight)}kg → ${formatNullablePlanNumber(nextWeight)}kg`)
      primaryUpdate ??= {
        field: "weight",
        newValue: nextWeight ?? "—",
        oldValue: previousFirstSet.weight ?? "—",
        text: "",
        type:
          typeof previousFirstSet.weight === "number" &&
          typeof nextWeight === "number" &&
          nextWeight < previousFirstSet.weight
            ? "weight_down"
            : "weight_up",
      }
    }

    const nextRir = normalizeCoachProgramInputOptionalInt(nextExercise.rir)
    if ((previousFirstSet.rir ?? undefined) !== nextRir) {
      changes.push(`RIR ${formatNullablePlanNumber(previousFirstSet.rir)} → ${formatNullablePlanNumber(nextRir)}`)
      primaryUpdate ??= {
        field: "rir",
        newValue: nextRir ?? "—",
        oldValue: previousFirstSet.rir ?? "—",
        text: "",
        type:
          typeof previousFirstSet.rir === "number" &&
          typeof nextRir === "number" &&
          nextRir > previousFirstSet.rir
            ? "rir_up"
            : "rir_down",
      }
    }
  }

  if (!primaryUpdate || changes.length === 0) return undefined

  return {
    ...primaryUpdate,
    text: changes.join(" · "),
  }
}

function hasWorkoutInputChanged(
  previousWorkout: WorkoutRecord,
  nextWorkout: CoachProgramInput["workouts"][number],
) {
  if ((previousWorkout.name.trim() || "") !== (nextWorkout.name.trim() || "")) return true
  if ((previousWorkout.duration ?? undefined) !== (nextWorkout.duration ? Math.max(1, Math.round(nextWorkout.duration)) : undefined)) return true
  if ((previousWorkout.scheduledDay ?? undefined) !== nextWorkout.scheduledDay) return true
  if ((previousWorkout.weekIndex ?? undefined) !== (nextWorkout.weekIndex == null ? undefined : normalizeWorkoutWeekIndex(nextWorkout.weekIndex) ?? undefined)) return true
  if (normalizeWorkoutScheduledDate(previousWorkout.scheduledDate) !== normalizeWorkoutScheduledDate(nextWorkout.scheduledDate ?? null)) return true

  const previousExercises = previousWorkout.exercises.slice().sort((left, right) => left.order - right.order)
  if (previousExercises.length !== nextWorkout.exercises.length) return true

  return nextWorkout.exercises.some((nextExercise, index) => {
    const previousExercise = previousExercises[index]
    if (!previousExercise) return true
    if (previousExercise.variationId !== nextExercise.variationId) return true

    const nextSetCount = normalizeCoachProgramInputSetCount(nextExercise.sets)
    if (previousExercise.sets.length !== nextSetCount) return true

    const previousFirstSet = previousExercise.sets.slice().sort((left, right) => left.setNumber - right.setNumber)[0]
    if (!previousFirstSet) return true

    const nextRepTarget = normalizeRepTarget(nextExercise.reps, nextExercise.repsMin)
    const nextRir = normalizeCoachProgramInputOptionalInt(nextExercise.rir)
    const nextWeight = normalizeCoachProgramInputWeight(nextExercise.weight)

    return (
      (previousFirstSet.targetRepsMin ?? undefined) !== nextRepTarget.repsMin ||
      previousFirstSet.targetReps !== nextRepTarget.reps ||
      (previousFirstSet.rir ?? undefined) !== nextRir ||
      (previousFirstSet.weight ?? undefined) !== nextWeight
    )
  })
}

function buildUpdatedWorkoutIdsForProgramInput(
  previousProgram: ProgramRecord,
  nextWorkouts: CoachProgramInput["workouts"],
  workoutRows: Prisma.WorkoutCreateManyInput[],
) {
  return nextWorkouts.flatMap((nextWorkout, index) => {
    const nextWorkoutId = workoutRows[index]?.id
    if (typeof nextWorkoutId !== "string") return []

    const previousWorkout = findPreviousWorkoutForCoachUpdate({
      name: nextWorkout.name,
      scheduledDay: nextWorkout.scheduledDay ?? null,
      scheduledDate: nextWorkout.scheduledDate ?? null,
      weekIndex: nextWorkout.weekIndex ?? null,
    }, previousProgram)

    if (!previousWorkout || hasWorkoutInputChanged(previousWorkout as WorkoutRecord, nextWorkout)) {
      return [nextWorkoutId]
    }

    return []
  })
}

function buildCoachUpdatePayloadForProgramInput(
  previousProgram: ProgramRecord,
  nextWorkouts: CoachProgramInput["workouts"],
  workoutRows: Prisma.WorkoutCreateManyInput[],
  exerciseRows: Prisma.WorkoutExerciseCreateManyInput[],
) {
  const payload: Record<string, Record<string, CoachUpdate>> = {}

  nextWorkouts.forEach((nextWorkout, workoutIndex) => {
    const nextWorkoutId = workoutRows[workoutIndex]?.id
    if (typeof nextWorkoutId !== "string") return

    const previousWorkout = findPreviousWorkoutForCoachUpdate({
      name: nextWorkout.name,
      scheduledDay: nextWorkout.scheduledDay ?? null,
      scheduledDate: nextWorkout.scheduledDate ?? null,
      weekIndex: nextWorkout.weekIndex ?? null,
    }, previousProgram)
    const previousExercises = previousWorkout
      ? previousWorkout.exercises.slice().sort((left, right) => left.order - right.order)
      : []
    const nextExerciseRows = exerciseRows
      .filter((row) => row.workoutId === nextWorkoutId)
      .sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))

    nextWorkout.exercises.forEach((nextExercise, exerciseIndex) => {
      const nextWorkoutExerciseId = nextExerciseRows[exerciseIndex]?.id
      if (typeof nextWorkoutExerciseId !== "string") return

      const update = buildExerciseCoachUpdateFromProgramInput(
        previousExercises[exerciseIndex] as WorkoutExerciseRecord | undefined,
        nextExercise,
      )

      if (!update) return

      payload[nextWorkoutId] ??= {}
      payload[nextWorkoutId][nextWorkoutExerciseId] = update
    })
  })

  return payload
}

async function buildCoachUpdatesForAdjustedWorkout(
  profile: SerializedProfile,
  workout: WorkoutWithProgramRecord,
) {
  const db = ensurePrisma()
  if (!workout.programId || !workout.program || workout.program.createdById === profile.id) {
    return undefined
  }

  const notification = await db.notification.findFirst({
    orderBy: {
      createdAt: "desc",
    },
    where: {
      relatedEntityId: workout.programId,
      relatedEntityType: "program",
      type: NotificationType.program_assigned,
      userId: profile.id,
    },
  })
  const previousProgramId = readPreviousProgramIdFromMetadata(notification?.metadata ?? null)
  const storedUpdates = readCoachUpdatesByWorkoutIdFromMetadata(notification?.metadata ?? null).get(workout.id)

  if (storedUpdates && storedUpdates.size > 0) return storedUpdates

  if (!previousProgramId) return undefined

  const previousProgram = await db.program.findFirst({
    include: PROGRAM_INCLUDE,
    where: {
      createdById: workout.program.createdById,
      id: previousProgramId,
    },
  })

  if (!previousProgram) return undefined

  const previousWorkout = findPreviousWorkoutForCoachUpdate(workout, previousProgram as ProgramRecord)
  if (!previousWorkout) return undefined

  const previousExercises = previousWorkout.exercises.slice().sort((left, right) => left.order - right.order)
  const updates = new Map<string, CoachUpdate>()

  workout.exercises
    .slice()
    .sort((left, right) => left.order - right.order)
    .forEach((currentExercise, index) => {
      const update = buildExerciseCoachUpdate(currentExercise as WorkoutExerciseRecord, previousExercises[index] as WorkoutExerciseRecord | undefined)
      if (update) updates.set(currentExercise.id, update)
    })

  return updates.size > 0 ? updates : undefined
}

async function buildCoachUpdateWorkoutIdsForAssignments(
  profile: SerializedProfile,
  assignments: TraineeProgramAssignmentWithWorkouts[],
) {
  const db = ensurePrisma()
  const coachAssignments = assignments.filter((assignment) => assignment.program.createdById !== profile.id)
  const programIds = Array.from(new Set(coachAssignments.map((assignment) => assignment.programId)))
  const updateWorkoutIds = new Set<string>()

  if (programIds.length === 0) return updateWorkoutIds

  const notifications = await db.notification.findMany({
    orderBy: {
      createdAt: "desc",
    },
    where: {
      relatedEntityId: {
        in: programIds,
      },
      relatedEntityType: "program",
      type: NotificationType.program_assigned,
      userId: profile.id,
    },
  })
  const previousProgramIdByProgramId = new Map<string, string>()

  notifications.forEach((notification) => {
    readUpdatedWorkoutIdsFromMetadata(notification.metadata).forEach((workoutId) => updateWorkoutIds.add(workoutId))

    if (!notification.relatedEntityId || previousProgramIdByProgramId.has(notification.relatedEntityId)) {
      return
    }

    const previousProgramId = readPreviousProgramIdFromMetadata(notification.metadata)
    if (previousProgramId) {
      previousProgramIdByProgramId.set(notification.relatedEntityId, previousProgramId)
    }
  })

  const previousProgramIds = Array.from(new Set(previousProgramIdByProgramId.values()))
  if (previousProgramIds.length === 0) return updateWorkoutIds

  const previousPrograms = await db.program.findMany({
    include: PROGRAM_INCLUDE,
    where: {
      id: {
        in: previousProgramIds,
      },
    },
  })
  const previousProgramById = new Map(previousPrograms.map((program) => [program.id, program as ProgramRecord]))

  coachAssignments.forEach((assignment) => {
    const previousProgramId = previousProgramIdByProgramId.get(assignment.programId)
    const previousProgram = previousProgramId ? previousProgramById.get(previousProgramId) : undefined

    if (!previousProgram || previousProgram.createdById !== assignment.program.createdById) {
      return
    }

    ;(assignment.program.workouts as WorkoutRecord[]).forEach((currentWorkout) => {
      const previousWorkout = findPreviousWorkoutForCoachUpdate(currentWorkout, previousProgram)

      if (!previousWorkout) {
        updateWorkoutIds.add(currentWorkout.id)
        return
      }

      const currentExercises = currentWorkout.exercises.slice().sort((left, right) => left.order - right.order)
      const previousExercises = previousWorkout.exercises.slice().sort((left, right) => left.order - right.order)
      const hasExerciseCountChange = currentExercises.length !== previousExercises.length
      const hasExerciseUpdate = currentExercises.some((currentExercise, index) =>
        Boolean(buildExerciseCoachUpdate(currentExercise as WorkoutExerciseRecord, previousExercises[index] as WorkoutExerciseRecord | undefined)),
      )

      if (hasExerciseCountChange || hasExerciseUpdate) {
        updateWorkoutIds.add(currentWorkout.id)
      }
    })
  })

  return updateWorkoutIds
}

function roundMealValue(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}

function serializeProgram(program: ProgramRecord) {
  return {
    assignedTo: program.assignments.map((assignment) => assignment.userId),
    assignedTrainees: program.assignments.map((assignment) => ({
      assignedAt: assignment.assignedAt,
      avatar: assignment.user.avatar,
      email: assignment.user.email,
      fitnessGoals: assignment.user.fitnessGoals,
      id: assignment.user.id,
      name: assignment.user.name,
    })),
    archivedAt: program.archivedAt ?? null,
    createdAt: program.createdAt,
    createdBy: program.createdById,
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workouts: program.workouts
      .slice()
      .sort((left, right) => {
        const weekDiff = (left.weekIndex ?? 0) - (right.weekIndex ?? 0)
        return weekDiff !== 0 ? weekDiff : (left.scheduledDay ?? 7) - (right.scheduledDay ?? 7)
      })
      .map((workout) => serializeWorkout(workout)),
    workoutsPerWeek: program.workoutsPerWeek,
  }
}

function serializeCoachRequest(request: {
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: Pick<User, "avatar" | "email" | "fitnessGoals" | "id" | "name">
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
          programId?: string
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
    plannedDate: log.plannedDate ? formatUtcDateOnly(log.plannedDate) : undefined,
    programId: log.programId ?? snapshotWorkout?.programId,
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
          programId: snapshotWorkout?.programId,
          scheduledDate: snapshotWorkout?.scheduledDate,
          scheduledDay: snapshotWorkout?.scheduledDay,
        },
  }
}

type SerializedWorkoutLog = ReturnType<typeof serializeWorkoutLog>
type WorkoutLogSheetUser = Pick<SerializedProfile, "email" | "id" | "name">

function buildWorkoutLogSheetRows(
  logs: SerializedWorkoutLog[],
  options: { coachName?: string; trainee: WorkoutLogSheetUser },
): Array<Record<string, unknown>> {
  const sheetRows: Array<Record<string, unknown>> = []

  logs.forEach((log) => {
    const baseRow = {
      coachName: options.coachName ?? "",
      completedAt: log.completedAt?.toISOString() ?? "",
      logId: log.id,
      notes: log.notes ?? "",
      plannedDate: log.plannedDate ?? "",
      startedAt: log.startedAt.toISOString(),
      totalVolume: log.totalVolume ?? 0,
      traineeEmail: options.trainee.email,
      traineeId: options.trainee.id,
      traineeName: options.trainee.name,
      workoutId: log.workout.id,
      workoutKind: "kind" in log.workout ? log.workout.kind ?? "" : "",
      workoutName: log.workout.name,
    }

    log.exercises.forEach((exercise, exerciseIndex) => {
      const exerciseName = exercise.exercise?.name ?? ""
      const variationName = exercise.variation?.name ?? ""
      const muscleGroup = exercise.exercise?.muscleGroup ?? ""

      if (!exercise.sets.length) {
        sheetRows.push({
          ...baseRow,
          actualReps: "",
          completed: "",
          exerciseIndex: exerciseIndex + 1,
          exerciseName,
          muscleGroup,
          rir: "",
          setNumber: "",
          targetReps: "",
          targetRepsMin: "",
          variationName,
          weight: "",
        })
        return
      }

      exercise.sets.forEach((set) => {
        sheetRows.push({
        ...baseRow,
        actualReps: set.actualReps ?? "",
        completed: set.completed,
        exerciseIndex: exerciseIndex + 1,
        exerciseName,
        muscleGroup,
        rir: set.rir ?? "",
        setNumber: set.setNumber,
        targetReps: set.targetReps,
        targetRepsMin: set.targetRepsMin ?? "",
        variationName,
        weight: set.weight ?? "",
        })
      })
    })

    if (!log.exercises.length) {
      sheetRows.push({
      ...baseRow,
      actualReps: "",
      completed: "",
      exerciseIndex: "",
      exerciseName: "",
      muscleGroup: "",
      rir: "",
      setNumber: "",
      targetReps: "",
      targetRepsMin: "",
      variationName: "",
      weight: "",
      })
    }
  })

  return sheetRows
}

async function exportWorkoutLogsToN8n(input: {
  event: "trainee_workout_logs_export" | "coach_trainee_workout_logs_export"
  exportedBy: SerializedProfile
  filters: Record<string, unknown>
  logs: SerializedWorkoutLog[]
  trainee: WorkoutLogSheetUser
  coachName?: string
}) {
  if (!isN8nLogExportEnabled()) {
    throw new AuthServiceError("Chưa cấu hình N8N_LOGS_WEBHOOK_URL cho backend.", 400)
  }

  const rows = buildWorkoutLogSheetRows(input.logs, {
    coachName: input.coachName,
    trainee: input.trainee,
  })

  const response = await sendWebhookPayloadToN8n({
    timestamp: new Date().toISOString(),
    source: "backend",
    event: input.event,
    exportedBy: {
      email: input.exportedBy.email,
      id: input.exportedBy.id,
      name: input.exportedBy.name,
    },
    filters: input.filters,
    rowCount: rows.length,
    rows,
  })

  if (!response.ok) {
    throw new AuthServiceError("Không thể gửi workout logs sang n8n webhook.", 502)
  }

  return {
    exported: true,
    logCount: input.logs.length,
    rowCount: rows.length,
    webhookStatusCode: response.statusCode,
  }
}

function getScheduleEntryDurationLabel(
  workout: { duration?: number } | null,
  log: ReturnType<typeof serializeWorkoutLog> | null,
  now = new Date(),
) {
  if (log?.completedAt) {
    return `${Math.max(1, Math.floor((log.completedAt.getTime() - log.startedAt.getTime()) / 60000))}m`
  }

  if (log) {
    return `${Math.max(1, Math.floor((now.getTime() - log.startedAt.getTime()) / 60000))}m so far`
  }

  if (workout?.duration) {
    return `${workout.duration}m`
  }

  return undefined
}

function getScheduleOccurrenceKey(workoutId: string, plannedDateKey: string) {
  return `${workoutId}:${plannedDateKey}`
}

function normalizeScheduleMatchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function getWorkoutCompletionMatchKeys(workout: { id: string; name: string; scheduledDay?: number }) {
  const keys = [`id:${workout.id}`]
  const normalizedName = normalizeScheduleMatchText(workout.name)

  if (normalizedName) {
    keys.push(`name:${normalizedName}`)

    if (typeof workout.scheduledDay === "number") {
      keys.push(`day:${workout.scheduledDay}:name:${normalizedName}`)
    }
  }

  return keys
}

function getRecurringWorkoutPlannedDateKey(workout: { scheduledDate?: string; scheduledDay?: number }, weekStart: Date) {
  const scheduledDay = !workout.scheduledDate && typeof workout.scheduledDay === "number" ? workout.scheduledDay : null

  if (scheduledDay == null) {
    return null
  }

  const displayIndex = DISPLAY_WEEKDAY_ORDER.indexOf(scheduledDay)

  if (displayIndex < 0) {
    return null
  }

  return formatUtcDateOnly(addUtcDays(weekStart, displayIndex))
}

function getAssignmentWeekIndex(assignedAt: Date, weekStart: Date, duration: number) {
  const assignmentWeekStart = startOfUtcWeek(assignedAt)
  const elapsedWeeks = Math.floor((weekStart.getTime() - assignmentWeekStart.getTime()) / (DAY_IN_MS * 7))
  const lastWeekIndex = Math.max(0, Math.round(duration) - 1)

  return Math.max(0, Math.min(lastWeekIndex, elapsedWeeks))
}

// A program ends once the trainee is past its final week. After that, recurring
// program workouts no longer appear (no infinite repeat of the last week) — the
// coach must extend or assign a new program.
function isAssignmentProgramFinished(assignedAt: Date, weekStart: Date, duration: number) {
  const assignmentWeekStart = startOfUtcWeek(assignedAt)
  const elapsedWeeks = Math.floor((weekStart.getTime() - assignmentWeekStart.getTime()) / (DAY_IN_MS * 7))
  const lastWeekIndex = Math.max(0, Math.round(duration) - 1)

  return elapsedWeeks > lastWeekIndex
}

// A workout with no weekIndex belongs to week 1. The AI generator authors only
// week 0 and expects it to repeat, and older rows predate the column, so NULL
// must not be read as "belongs to no week".
function normalizeWeekIndexForVisibility(weekIndex: number | null | undefined) {
  return typeof weekIndex === "number" && Number.isFinite(weekIndex) ? Math.max(0, Math.round(weekIndex)) : 0
}

/**
 * Picks the workouts a trainee should see this week.
 *
 * Resolving one workout at a time is not enough: deciding whether a week is
 * missing requires knowing which weeks the program actually authored. A program
 * that stops short — the AI generator writing only week 0, or a coach filling
 * W1-W3 of an eight-week plan — repeats its last authored week rather than
 * going blank.
 */
function selectVisibleWorkoutsForAssignmentWeek<T extends Pick<WorkoutRecord, "scheduledDate" | "weekIndex">>(
  workouts: T[],
  assignedAt: Date,
  programDuration: number,
  weekStart: Date,
): T[] {
  const duration = Math.max(1, Math.round(programDuration))

  // Personal routines live in a synthetic one-week program and never expire.
  if (duration <= 1) {
    return workouts
  }

  const datedWorkouts = workouts.filter((workout) => workout.scheduledDate)

  if (isAssignmentProgramFinished(assignedAt, weekStart, duration)) {
    return datedWorkouts
  }

  const recurringWorkouts = workouts.filter((workout) => !workout.scheduledDate)
  const authoredWeeks = new Set(recurringWorkouts.map((workout) => normalizeWeekIndexForVisibility(workout.weekIndex)))

  if (authoredWeeks.size === 0) {
    return datedWorkouts
  }

  const currentWeekIndex = getAssignmentWeekIndex(assignedAt, weekStart, duration)
  const weeksAtOrBefore = Array.from(authoredWeeks).filter((weekIndex) => weekIndex <= currentWeekIndex)
  const effectiveWeekIndex =
    weeksAtOrBefore.length > 0 ? Math.max(...weeksAtOrBefore) : Math.min(...Array.from(authoredWeeks))

  return workouts.filter(
    (workout) =>
      Boolean(workout.scheduledDate) || normalizeWeekIndexForVisibility(workout.weekIndex) === effectiveWeekIndex,
  )
}

function getLogPlannedDateKey(log: ReturnType<typeof serializeWorkoutLog>) {
  if (log.plannedDate) {
    return log.plannedDate
  }

  const scheduledDay =
    !log.workout.scheduledDate && typeof log.workout.scheduledDay === "number" ? log.workout.scheduledDay : null

  if (scheduledDay != null) {
    const startedDay = startOfUtcDay(log.startedAt)
    const dayOffset = (startedDay.getUTCDay() - scheduledDay + 7) % 7
    return formatUtcDateOnly(addUtcDays(startedDay, -dayOffset))
  }

  if (log.workout.scheduledDate) {
    return log.workout.scheduledDate
  }

  return formatUtcDateOnly(log.startedAt)
}

// Sequential weekly schedule: completed sessions show on the day they were actually
// trained; days with no session are simply empty (never "missed"). Each uncompleted
// recurring session is laid out, in program order, on the earliest free day that is at
// or after both today and its coach-assigned weekday — so an on-track week keeps the
// coach's layout (including rest days), while a behind week slides the remaining sessions
// forward onto the following days.
function buildSerializedScheduleEntriesForWeek({
  logs,
  todayStart,
  weekStart,
  workouts,
}: {
  logs: Array<ReturnType<typeof serializeWorkoutLog>>
  todayStart: Date
  weekStart: Date
  workouts: Array<ReturnType<typeof serializeWorkout>>
}) {
  const now = new Date()
  const todayKey = formatUtcDateOnly(todayStart)
  const weekStartKey = formatUtcDateOnly(weekStart)
  const weekEndKey = formatUtcDateOnly(addUtcDays(weekStart, 7))

  const cells = DISPLAY_WEEKDAY_ORDER.map((weekday, displayIndex) => {
    const date = addUtcDays(weekStart, displayIndex)
    return { date, dateKey: formatUtcDateOnly(date), weekday }
  })

  const todayIndex = (() => {
    const found = cells.findIndex((cell) => cell.dateKey === todayKey)
    if (found >= 0) return found
    return todayKey < weekStartKey ? -1 : cells.length
  })()

  // First workout actually started on each day this week.
  const logByDay = new Map<string, ReturnType<typeof serializeWorkoutLog>>()
  for (const log of logs) {
    const key = formatUtcDateOnly(log.startedAt)
    if (!logByDay.has(key)) {
      logByDay.set(key, log)
    }
  }
  const completedOccurrenceKeys = new Set<string>()
  const completedWorkoutMatchKeysForWeek = new Set<string>()
  const coachUpdatedWorkoutMatchKeys = new Set<string>()
  workouts
    .filter((workout) => workout.hasCoachUpdate)
    .forEach((workout) => getWorkoutCompletionMatchKeys(workout).forEach((key) => coachUpdatedWorkoutMatchKeys.add(key)))

  for (const log of logs) {
    const startedKey = formatUtcDateOnly(log.startedAt)
    const startedInWeek = startedKey >= weekStartKey && startedKey < weekEndKey
    const plannedDateKey = getLogPlannedDateKey(log)
    const plannedInWeek = plannedDateKey >= weekStartKey && plannedDateKey < weekEndKey

    if (plannedInWeek) {
      completedOccurrenceKeys.add(getScheduleOccurrenceKey(log.workout.id, plannedDateKey))
    }
    // A workout started in this week counts as this week's completion for its
    // recurring signature, even when plannedDate spilled into a previous week
    // (catch-up sessions) — prevents the same recurring session from also being
    // rolled forward onto a later day this week.
    if (startedInWeek || plannedInWeek) {
      getWorkoutCompletionMatchKeys(log.workout).forEach((key) => completedWorkoutMatchKeysForWeek.add(key))
    }
  }

  // One-off workouts pinned to a specific date stay on that date.
  const oneOffByDay = new Map<string, ReturnType<typeof serializeWorkout>>()
  for (const workout of workouts) {
    if (workout.scheduledDate) {
      oneOffByDay.set(workout.scheduledDate, workout)
    }
  }

  // Uncompleted recurring program sessions, in coach weekday order.
  const remaining = workouts
    .filter((workout) => {
      const plannedDateKey = getRecurringWorkoutPlannedDateKey(workout, weekStart)

      return Boolean(
        plannedDateKey &&
          !completedOccurrenceKeys.has(getScheduleOccurrenceKey(workout.id, plannedDateKey)) &&
          !getWorkoutCompletionMatchKeys(workout).some((key) => completedWorkoutMatchKeysForWeek.has(key)),
      )
    })
    .sort((left, right) => DISPLAY_WEEKDAY_ORDER.indexOf(left.scheduledDay as number) - DISPLAY_WEEKDAY_ORDER.indexOf(right.scheduledDay as number))

  const occupied = cells.map((cell) => logByDay.has(cell.dateKey) || oneOffByDay.has(cell.dateKey))
  const assigned = new Array<ReturnType<typeof serializeWorkout> | null>(cells.length).fill(null)

  for (const session of remaining) {
    const schedIndex = DISPLAY_WEEKDAY_ORDER.indexOf(session.scheduledDay as number)
    const start = Math.max(0, todayIndex < 0 ? schedIndex : Math.max(todayIndex, schedIndex))
    for (let i = start; i < cells.length; i += 1) {
      if (!occupied[i]) {
        occupied[i] = true
        assigned[i] = session
        break
      }
    }
  }

  return cells.map((cell, index) => {
    const isPast = cell.dateKey < todayKey
    const isToday = cell.dateKey === todayKey
    const log = logByDay.get(cell.dateKey) ?? null

    if (log) {
      const logHasCoachUpdate = getWorkoutCompletionMatchKeys(log.workout).some((key) => coachUpdatedWorkoutMatchKeys.has(key))
      const entryWorkout = logHasCoachUpdate ? { ...log.workout, hasCoachUpdate: true } : log.workout

      return {
        date: cell.dateKey,
        durationLabel: getScheduleEntryDurationLabel(entryWorkout, log, now),
        isCatchUp: false,
        isCompleted: true,
        isMissed: false,
        isRolledOver: false,
        isToday,
        log,
        source: "isPersonal" in entryWorkout && entryWorkout.isPersonal ? "self" : "coach",
        weekday: cell.weekday,
        workout: entryWorkout,
      }
    }

    const oneOff = oneOffByDay.get(cell.dateKey) ?? null
    if (oneOff) {
      return {
        date: cell.dateKey,
        durationLabel: getScheduleEntryDurationLabel(oneOff, null, now),
        isCatchUp: false,
        isCompleted: false,
        isMissed: isPast,
        isRolledOver: false,
        isToday,
        log: null,
        source: oneOff.isPersonal ? "self" : "coach",
        weekday: cell.weekday,
        workout: oneOff,
      }
    }

    const placed = assigned[index]
    const schedIndex = placed ? DISPLAY_WEEKDAY_ORDER.indexOf(placed.scheduledDay as number) : -1

    return {
      date: cell.dateKey,
      durationLabel: getScheduleEntryDurationLabel(placed, null, now),
      isCatchUp: Boolean(placed) && todayIndex >= 0 && schedIndex < todayIndex,
      isCompleted: false,
      isMissed: false,
      isRolledOver: false,
      isToday,
      log: null,
      source: placed?.isPersonal ? "self" : "coach",
      weekday: cell.weekday,
      workout: placed,
    }
  })
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
    ...(defaultVariation
      ? serializePublicMuscleProfile({
          ...defaultVariation,
          muscleTargets: defaultVariation.muscleTargets,
        }, exercise.muscleGroup)
      : {
          primaryMuscles: [...legacyMuscleGroupToSlugs(exercise.muscleGroup)],
          secondaryMuscles: [],
        }),
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

function buildProgramTreeCreateManyData(
  programId: string,
  workouts: CoachProgramInput["workouts"],
  options?: { workoutIds?: Array<string | undefined> },
) {
  const workoutRows: Prisma.WorkoutCreateManyInput[] = []
  const exerciseRows: Prisma.WorkoutExerciseCreateManyInput[] = []
  const setRows: Prisma.ExerciseSetCreateManyInput[] = []

  workouts.forEach((workout, workoutIndex) => {
    const workoutId = options?.workoutIds?.[workoutIndex] ?? randomUUID()
    const workoutName = workout.name.trim() || `Day ${workoutIndex + 1}`
    const scheduledDate = workout.scheduledDate ? parseScheduledDateInput(workout.scheduledDate) : undefined

    workoutRows.push({
      duration: workout.duration ? Math.max(1, Math.round(workout.duration)) : undefined,
      id: workoutId,
      name: workoutName,
      programId,
      scheduledDate,
      scheduledDay: typeof workout.scheduledDay === "number" ? workout.scheduledDay : undefined,
      weekIndex:
        typeof workout.weekIndex === "number" && Number.isFinite(workout.weekIndex)
          ? Math.max(0, Math.round(workout.weekIndex))
          : undefined,
    })

    workout.exercises.forEach((exercise, exerciseIndex) => {
      const workoutExerciseId = randomUUID()
      const repTarget = normalizeRepTarget(
        exercise.reps,
        exercise.repsMin,
        `${workoutName || `Buổi ${workoutIndex + 1}`} / bài tập ${exerciseIndex + 1}`,
      )

      exerciseRows.push({
        id: workoutExerciseId,
        order: exerciseIndex + 1,
        restTime:
          exercise.restTime != null && Number.isFinite(exercise.restTime)
            ? Math.max(0, Math.round(exercise.restTime))
            : undefined,
        variationId: exercise.variationId,
        workoutId,
      })

      setRows.push(
        ...Array.from({ length: Math.max(1, Math.round(exercise.sets)) }, (_value, setIndex) => ({
          id: randomUUID(),
          rir: typeof exercise.rir === "number" && Number.isFinite(exercise.rir)
            ? Math.max(0, Math.round(exercise.rir))
            : undefined,
          setNumber: setIndex + 1,
          targetReps: repTarget.reps,
          targetRepsMin: repTarget.repsMin,
          weight:
            exercise.weight != null && Number.isFinite(exercise.weight)
              ? Math.max(0, exercise.weight)
              : undefined,
          workoutExerciseId,
        })),
      )
    })
  })

  return {
    exerciseRows,
    setRows,
    workoutRows,
  }
}

function addProgramIdToWorkoutSnapshot(snapshot: Prisma.JsonValue | null, programId: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return undefined
  }

  const snapshotObject = snapshot as Record<string, Prisma.JsonValue>
  if (snapshotObject.programId === programId) {
    return undefined
  }

  return {
    ...snapshotObject,
    programId,
  } satisfies Prisma.InputJsonObject
}

function getWorkoutSnapshotName(snapshot: Prisma.JsonValue | null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return undefined

  const name = (snapshot as { name?: unknown }).name
  return typeof name === "string" ? normalizeProgramMatchLabel(name) : undefined
}

async function backfillWorkoutLogProgramContextForWorkouts(
  tx: Prisma.TransactionClient,
  programId: string,
  workoutIds: string[],
) {
  if (workoutIds.length === 0) return

  const logs = await tx.workoutLog.findMany({
    select: {
      id: true,
      programId: true,
      workoutSnapshot: true,
    },
    where: {
      workoutId: {
        in: workoutIds,
      },
    },
  })

  await Promise.all(
    logs.map((log) => {
      const workoutSnapshot = addProgramIdToWorkoutSnapshot(log.workoutSnapshot, programId)
      const data: Prisma.WorkoutLogUpdateInput = {}

      if (!log.programId) {
        data.programId = programId
      }

      if (workoutSnapshot) {
        data.workoutSnapshot = workoutSnapshot
      }

      if (Object.keys(data).length === 0) {
        return Promise.resolve()
      }

      return tx.workoutLog.update({
        data,
        where: {
          id: log.id,
        },
      })
    }),
  )
}

async function backfillLegacyWorkoutLogProgramContextForAssignments(
  tx: Prisma.TransactionClient,
  programId: string,
  assignments: ProgramRecord["assignments"],
  workoutRows: Prisma.WorkoutCreateManyInput[],
  durationWeeks: number,
) {
  if (assignments.length === 0 || workoutRows.length === 0) return

  const plannedByUserAndDateName = new Map<string, true>()
  const assignmentWindows = assignments.map((assignment) => {
    const baseMonday = startOfUtcWeek(assignment.assignedAt)
    const end = addUtcDays(baseMonday, Math.max(1, Math.round(durationWeeks)) * 7)

    workoutRows.forEach((workout) => {
      const workoutName = typeof workout.name === "string" ? normalizeProgramMatchLabel(workout.name) : ""
      if (!workoutName) return

      let plannedDate: Date | undefined
      if (workout.scheduledDate instanceof Date) {
        plannedDate = workout.scheduledDate
      } else if (typeof workout.scheduledDate === "string") {
        plannedDate = parseScheduledDateInput(workout.scheduledDate)
      } else if (typeof workout.scheduledDay === "number") {
        plannedDate = addUtcDays(
          baseMonday,
          (normalizeWorkoutWeekIndex(Number(workout.weekIndex)) ?? 0) * 7 +
            (((workout.scheduledDay % 7) + 6) % 7),
        )
      }

      if (!plannedDate) return
      plannedByUserAndDateName.set(`${assignment.userId}|${formatUtcDateOnly(plannedDate)}|${workoutName}`, true)
    })

    return {
      end,
      start: baseMonday,
      userId: assignment.userId,
    }
  })

  const userIds = Array.from(new Set(assignmentWindows.map((window) => window.userId)))
  const earliestStart = assignmentWindows.reduce<Date | undefined>(
    (earliest, window) => (!earliest || window.start < earliest ? window.start : earliest),
    undefined,
  )
  const latestEnd = assignmentWindows.reduce<Date | undefined>(
    (latest, window) => (!latest || window.end > latest ? window.end : latest),
    undefined,
  )

  if (!earliestStart || !latestEnd || userIds.length === 0) return

  const logs = await tx.workoutLog.findMany({
    select: {
      id: true,
      plannedDate: true,
      userId: true,
      workoutSnapshot: true,
    },
    where: {
      plannedDate: {
        gte: earliestStart,
        lt: latestEnd,
      },
      programId: null,
      userId: {
        in: userIds,
      },
    },
  })

  await Promise.all(
    logs.map((log) => {
      if (!log.plannedDate) return Promise.resolve()
      const snapshotName = getWorkoutSnapshotName(log.workoutSnapshot)
      if (!snapshotName) return Promise.resolve()

      const key = `${log.userId}|${formatUtcDateOnly(log.plannedDate)}|${snapshotName}`
      if (!plannedByUserAndDateName.has(key)) return Promise.resolve()

      return tx.workoutLog.update({
        data: {
          programId,
          workoutSnapshot: addProgramIdToWorkoutSnapshot(log.workoutSnapshot, programId) ?? undefined,
        },
        where: {
          id: log.id,
        },
      })
    }),
  )
}




function resolveWorkoutLogPlannedDate(
  workout: Pick<WorkoutRecord, "scheduledDate" | "scheduledDay">,
  startedAt: Date,
  inputPlannedDate?: string | null,
) {
  if (inputPlannedDate?.trim()) {
    const plannedDate = parseScheduledDateInput(inputPlannedDate)

    if (!plannedDate) {
      throw new AuthServiceError("plannedDate không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
    }

    return plannedDate
  }

  if (workout.scheduledDate) {
    return workout.scheduledDate
  }

  if (typeof workout.scheduledDay === "number") {
    const startedDay = startOfUtcDay(startedAt)
    const dayOffset = (startedDay.getUTCDay() - workout.scheduledDay + 7) % 7
    return addUtcDays(startedDay, -dayOffset)
  }

  return startOfUtcDay(startedAt)
}


function resolveBodyMetricRecordedAtFilter(options?: BodyMetricListOptions) {
  if (options?.from || options?.to) {
    const parsedFrom = options.from ? parseLocalDateInput(options.from) : undefined
    const parsedTo = options.to ? parseLocalDateInput(options.to) : undefined

    if (options.from && !parsedFrom) {
      throw new AuthServiceError("from không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
    }

    if (options.to && !parsedTo) {
      throw new AuthServiceError("to không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
    }

    if (!parsedFrom || !parsedTo) {
      throw new AuthServiceError("from và to là bắt buộc khi lọc body metrics theo range.", 400)
    }

    if (parsedTo <= parsedFrom) {
      throw new AuthServiceError("to phải lớn hơn from.", 400)
    }

    return {
      recordedAt: {
        gte: parsedFrom,
        lt: parsedTo,
      },
    }
  }

  const requestedDays = options?.days ?? 30
  const normalizedDays = requestedDays === 90 || requestedDays === 365 ? requestedDays : 30
  const window = toRecentWindow(normalizedDays)

  return {
    recordedAt: {
      gte: window.start,
      lte: window.end,
    },
  }
}


function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
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
    if (!snapshotSet) {
      return
    }

    const parsedSetNumber = toFiniteNumber(snapshotSet.setNumber)
    const setNumber = parsedSetNumber != null ? Math.max(1, Math.round(parsedSetNumber)) : index + 1
    const actualReps = toFiniteNumber(snapshotSet.actualReps)
    const targetReps = toFiniteNumber(snapshotSet.targetReps)
    const reps = actualReps ?? (snapshotSet.completed === false ? undefined : targetReps)
    const weight = toFiniteNumber(snapshotSet.weight)
    const rir = toFiniteNumber(snapshotSet.rir)

    if (reps == null && weight == null) {
      return
    }

    previousPerformanceBySetNumber.set(setNumber, {
      completedAt: log.completedAt ?? log.startedAt,
      reps,
      rir: rir ?? undefined,
      source,
      weight,
    })
  })

  return previousPerformanceBySetNumber
}

async function buildPreviousSetPerformanceByWorkoutExercise(
  profileId: string,
  workoutExercises: WorkoutExerciseRecord[],
  scope: { programId: string | null; workoutId: string },
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

  // Scope prev-performance lookup to the same program (or, for personal workouts
  // with no program, to the same workout template). This keeps "prev" meaningful
  // for the current program instead of leaking numbers from other programs the
  // trainee happened to run the same exercise in.
  const scopeFilter = scope.programId != null
    ? { programId: scope.programId }
    : { workoutId: scope.workoutId }

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
        ...scopeFilter,
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

type VariationWithExercise = Prisma.VariationGetPayload<{
  include: { exercise: true; muscleTargets: true }
}>

// The default-seed scan only has work to do the very first time a process touches
// an empty/under-seeded DB; afterwards the rows exist forever. Gate it behind a
// cached flag so steady-state calls skip the scan + its round-trips entirely.
async function seedDefaultExercisesIfNeeded() {
  if (libraryCache.get<boolean>(CACHE_KEYS.exerciseDefaultsSeeded)) {
    return
  }

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
    invalidateExerciseLibrary()
  }

  libraryCache.set(CACHE_KEYS.exerciseDefaultsSeeded, true, EXERCISE_LIBRARY_TTL_MS)
}

async function ensureDefaultExercises(): Promise<VariationWithExercise[]> {
  await seedDefaultExercisesIfNeeded()

  const db = ensurePrisma()
  return libraryCache.getOrLoad(CACHE_KEYS.exerciseVariations, EXERCISE_LIBRARY_TTL_MS, () =>
    db.variation.findMany({
      include: {
        exercise: true,
        muscleTargets: true,
      },
      orderBy: [{ exercise: { muscleGroup: "asc" } }, { exercise: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  )
}

async function listExercises(
  profile: SerializedProfile,
  options?: {
    activityType?: ExerciseActivityTypeValue
    equipment?: string
    muscle?: MuscleSlugValue
    muscleGroup?: string
    search?: string
  },
) {
  const search = options?.search?.trim().toLowerCase()
  const muscleGroup = options?.muscleGroup?.trim().toLowerCase()
  const equipment = options?.equipment?.trim().toLowerCase()
  const muscle = options?.muscle
  const activityType = options?.activityType
  const variations = muscle || activityType
    ? await ensurePrisma().variation.findMany({
        include: { exercise: true, muscleTargets: true },
        orderBy: [{ exercise: { muscleGroup: "asc" } }, { exercise: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
        where: {
          ...(activityType ? { activityType } : {}),
          ...(muscle ? {
            OR: [
              { muscleProfileStatus: "approved", muscleTargets: { some: { muscleSlug: muscle } } },
              {
                muscleProfileStatus: "pending",
                exercise: {
                  is: {
                    OR: legacyMuscleGroupsForSlug(muscle).map((group) => ({
                      muscleGroup: { equals: group, mode: "insensitive" as const },
                    })),
                  },
                },
              },
            ],
          } : {}),
        },
      })
    : await ensureDefaultExercises()

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
      const resolvedMuscles =
        variation.muscleProfileStatus === "approved"
          ? variation.muscleTargets.map((target) => target.muscleSlug)
          : legacyMuscleGroupToSlugs(variation.exercise.muscleGroup)
      const matchesMuscle = !muscle || resolvedMuscles.includes(muscle)
      const matchesActivityType = !activityType || variation.activityType === activityType

      return matchesSearch && matchesGroup && matchesEquipment && matchesMuscle && matchesActivityType
    })
    .map((variation) => serializeVariationOption(variation, profile))
}

async function listExerciseLibrary(
  profile: SerializedProfile,
  options?: {
    activityType?: ExerciseActivityTypeValue
    equipment?: string
    muscle?: MuscleSlugValue
    muscleGroup?: string
    search?: string
  },
) {
  const db = ensurePrisma()
  await ensureDefaultExercises()
  const search = options?.search?.trim().toLowerCase()
  const muscleGroup = options?.muscleGroup?.trim().toLowerCase()
  const equipment = options?.equipment?.trim().toLowerCase()
  const muscle = options?.muscle
  const activityType = options?.activityType

  // Shared across all callers; per-profile visibility + the search/group/equipment
  // filters below run in-memory over the cached set, so the cache key is global.
  const exercises = await libraryCache.getOrLoad(CACHE_KEYS.exerciseLibrary, EXERCISE_LIBRARY_TTL_MS, () =>
    db.exercise.findMany({
      include: {
        createdBy: {
          select: {
            name: true,
          },
        },
        variations: {
          include: {
            muscleTargets: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
    }),
  )

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
        const resolvedMuscles =
          variation.muscleProfileStatus === "approved"
            ? variation.muscleTargets.map((target) => target.muscleSlug)
            : legacyMuscleGroupToSlugs(exercise.muscleGroup)
        const matchesMuscle = !muscle || resolvedMuscles.includes(muscle)
        const matchesActivityType = !activityType || variation.activityType === activityType
        return matchesSearch && matchesEquipment && matchesMuscle && matchesActivityType
      }),
    }))
    .filter((exercise) => {
      const matchesGroup = !muscleGroup || exercise.muscleGroup.toLowerCase() === muscleGroup
      return matchesGroup && exercise.variations.length > 0
    })
    .map((exercise) => ({
      ...exercise,
      variations: exercise.variations.map((variation) => serializeVariation(variation, exercise.muscleGroup)),
    }))
}

async function listCoachExercises(profile: SerializedProfile, options?: { search?: string }) {
  const db = ensurePrisma()
  assertCoach(profile)
  await ensureDefaultExercises()
  const search = options?.search?.trim().toLowerCase()

  const exercises = await db.exercise.findMany({
    include: {
      createdBy: {
        select: {
          name: true,
        },
      },
      variations: {
        include: {
          _count: {
            select: {
              workoutExercises: true,
            },
          },
          muscleTargets: true,
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
    muscleProfile: MuscleProfileInput
    name: string
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const name = input.name.trim()
  const muscleGroup = input.muscleGroup.trim()
  const equipment = input.equipment?.trim() || undefined

  if (!name || !muscleGroup || muscleGroup.toLowerCase() === "full body") {
    throw new AuthServiceError("Tên bài tập/nhóm cơ không hợp lệ; Full Body chỉ là nhãn suy ra từ muscle targets.", 400)
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
          ...buildApprovedMuscleProfileData(input.muscleProfile, profile.id),
        },
      },
    },
    include: {
      createdBy: {
        select: {
          name: true,
        },
      },
      variations: {
        include: {
          _count: {
            select: {
              workoutExercises: true,
            },
          },
          muscleTargets: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  })

  invalidateExerciseLibrary()
  return serializeCoachExercise(exercise as CoachExerciseRecord, profile)
}

async function updateCoachExercise(
  profile: SerializedProfile,
  exerciseId: string,
  input: {
    equipment?: string | null
    muscleGroup: string
    muscleProfile: MuscleProfileInput
    name: string
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const name = input.name.trim()
  const muscleGroup = input.muscleGroup.trim()
  const equipment = input.equipment?.trim() || undefined

  if (!name || !muscleGroup || muscleGroup.toLowerCase() === "full body") {
    throw new AuthServiceError("Tên bài tập/nhóm cơ không hợp lệ; Full Body chỉ là nhãn suy ra từ muscle targets.", 400)
  }

  const existingExercise = await db.exercise.findFirst({
    include: {
      variations: {
        include: {
          muscleTargets: true,
        },
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
          ...buildApprovedMuscleProfileUpdate(input.muscleProfile, profile.id),
        },
        where: {
          id: defaultVariation.id,
        },
      })
    }

    return transaction.exercise.findUniqueOrThrow({
      include: {
        createdBy: {
          select: {
            name: true,
          },
        },
        variations: {
          include: {
            _count: {
              select: {
                workoutExercises: true,
              },
            },
            muscleTargets: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      where: {
        id: exerciseId,
      },
    })
  })

  invalidateExerciseLibrary()
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

  invalidateExerciseLibrary()
  return {
    deleted: true,
    id: exerciseId,
  }
}

async function submitCoachExerciseImportRequest(
  profile: SerializedProfile,
  input: {
    fileName?: string
    rows: ExerciseImportRowInput[]
  },
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const rows = normalizeCoachExerciseImportRows(input.rows)

  const request = await db.exerciseImportRequest.create({
    data: {
      fileName: sanitizeImportText(input.fileName),
      rowCount: rows.length,
      rows: rows as Prisma.InputJsonValue,
      submittedById: profile.id,
    },
    include: {
      reviewedBy: {
        select: IMPORT_REVIEWER_SELECT,
      },
      submittedBy: {
        select: IMPORT_REVIEWER_SELECT,
      },
    },
  })

  return serializeExerciseImportRequest(request as ExerciseImportRequestRecord)
}

async function listCoachExerciseImportRequests(profile: SerializedProfile) {
  const db = ensurePrisma()
  assertCoach(profile)

  const requests = await db.exerciseImportRequest.findMany({
    include: {
      reviewedBy: {
        select: IMPORT_REVIEWER_SELECT,
      },
      submittedBy: {
        select: IMPORT_REVIEWER_SELECT,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    where: {
      submittedById: profile.id,
    },
  })

  return requests.map((request) => serializeExerciseImportRequest(request as ExerciseImportRequestRecord))
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
        loggedDate: {
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
        loggedDate: {
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
      loggedDate: input.recordedAt ? new Date(input.recordedAt) : new Date(),
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
      loggedDate: input.recordedAt ? new Date(input.recordedAt) : meal.loggedDate,
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
      program: { archivedAt: null },
    },
  })
  const coachUpdateWorkoutIds = await buildCoachUpdateWorkoutIdsForAssignments(
    profile,
    assignments as TraineeProgramAssignmentWithWorkouts[],
  )

  const workoutMap = new Map<string, WorkoutRecord>()
  const personalWorkoutIds = new Set<string>()
  const weekStart = startOfUtcWeek(new Date())

  assignments.forEach((assignment) => {
    const isPersonalProgram = assignment.program.createdById === profile.id
    const visibleWorkouts = selectVisibleWorkoutsForAssignmentWeek(
      assignment.program.workouts as WorkoutRecord[],
      assignment.assignedAt,
      assignment.program.duration,
      weekStart,
    )

    visibleWorkouts.forEach((workout) => {
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
    .map((workout) =>
      serializeWorkout(workout, {
        hasCoachUpdate: coachUpdateWorkoutIds.has(workout.id),
        isPersonal: personalWorkoutIds.has(workout.id),
      }),
    )

  const recurringWorkouts = serializedWorkouts.filter((workout) => !workout.scheduledDate)

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
  const serializedWeekLogs = weekLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord))

  return {
    historyLogs: historyLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    programs: assignments.map((a) => ({
      assignedAt: a.assignedAt,
      duration: a.program.duration,
      id: a.program.id,
      name: a.program.name,
    })),
    recentLogs: recentLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord)),
    schedule,
    scheduleEntries: buildSerializedScheduleEntriesForWeek({
      logs: serializedWeekLogs,
      todayStart,
      weekStart,
      workouts: serializedWorkouts,
    }),
    todayWorkout: todayOneOffWorkout ?? schedule[new Date().getDay()] ?? null,
    weekLogs: serializedWeekLogs,
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
        program: { archivedAt: null },
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
        loggedDate: {
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
    const visibleWorkouts = selectVisibleWorkoutsForAssignmentWeek(
      assignment.program.workouts as WorkoutRecord[],
      assignment.assignedAt,
      assignment.program.duration,
      weekStart,
    )

    visibleWorkouts.forEach((workout) => {
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
    { programId: workout.programId, workoutId: workout.id },
  )
  const coachUpdatesByWorkoutExerciseId = await buildCoachUpdatesForAdjustedWorkout(
    profile,
    workout as WorkoutWithProgramRecord,
  )

  return serializeWorkout(workout as WorkoutWithProgramRecord, {
    coachUpdatesByWorkoutExerciseId,
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
    plannedDate?: string | null
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
  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date()
  const completedAt = input.completedAt ? new Date(input.completedAt) : new Date()
  const plannedDate = resolveWorkoutLogPlannedDate(workout as WorkoutRecord, startedAt, input.plannedDate)
  const profilesByVariationId = new Map<string, SnapshotMuscleProfile>(
    serializedWorkout.exercises.map((entry) => [entry.variation.id, {
      activityType: entry.variation.activityType,
      primaryMuscles: entry.variation.primaryMuscles,
      secondaryMuscles: entry.variation.secondaryMuscles,
    }]),
  )
  const enrichedSnapshot = enrichExerciseSnapshot(input.exercises, profilesByVariationId).snapshot

  // A single insert needs no interactive transaction (which adds BEGIN/COMMIT
  // round-trips over PgBouncer); retryTransaction still guards against transient
  // connection resets.
  const log = await retryTransaction(() =>
    db.workoutLog.create({
      data: {
        completedAt,
        exerciseSnapshot: enrichedSnapshot as Prisma.InputJsonValue,
        notes: input.notes?.trim() || undefined,
        plannedDate,
        programId: workout.programId ?? undefined,
        startedAt,
        totalVolume,
        userId: profile.id,
        workoutId: workout.id,
        workoutSnapshot: {
          duration: serializedWorkout.duration,
          id: serializedWorkout.id,
          name: serializedWorkout.name,
          notes: serializedWorkout.notes,
          programId: workout.programId,
          scheduledDate: serializedWorkout.scheduledDate,
          scheduledDay: serializedWorkout.scheduledDay,
        } as Prisma.InputJsonObject,
      },
      include: WORKOUT_LOG_INCLUDE,
    }),
  )

  // The coach notification is non-critical: send it after the log is saved so the
  // trainee's request returns immediately, and never fail the log if it errors.
  if (profile.coachId) {
    const coachId = profile.coachId

    void db.notification
      .create({
        data: {
          channel: "in_app",
          message: `${profile.name} completed ${serializedWorkout.name}.`,
          metadata: {
            traineeId: profile.id,
            traineeName: profile.name,
            workoutId: workout.id,
            workoutLogId: log.id,
            workoutName: serializedWorkout.name,
          },
          relatedEntityId: log.id,
          relatedEntityType: "workout_log",
          scheduledFor: new Date(),
          sentAt: new Date(),
          status: NotificationStatus.sent,
          title: `${profile.name} logged a workout`,
          type: NotificationType.workout_logged,
          userId: coachId,
        },
      })
      .catch((error) => {
        logger.warn("unable to create workout-logged notification", { coachId, error })
      })
  }

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
        notes: exercise.notes?.trim() || undefined,
        reps: repTarget.reps,
        repsMin: repTarget.repsMin,
        rir: typeof exercise.rir === "number" && Number.isFinite(exercise.rir)
          ? Math.max(0, Math.round(exercise.rir))
          : undefined,
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
    notes: exercise.notes,
    order: exerciseIndex + 1,
    restTime: exercise.restTime,
    sets: {
      create: Array.from({ length: exercise.sets }, (_value, setIndex) => ({
        setNumber: setIndex + 1,
        targetRepsMin: exercise.repsMin,
        targetReps: exercise.reps,
        rir: exercise.rir,
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

async function listCoachPrograms(
  profile: SerializedProfile,
  options?: { includeArchived?: boolean },
) {
  assertCoach(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: PROGRAM_INCLUDE,
    orderBy: {
      createdAt: "desc",
    },
    where: {
      createdById: profile.id,
      ...(options?.includeArchived ? {} : { archivedAt: null }),
    },
  })

  return programs.map((program) => serializeProgram(program as ProgramRecord))
}

async function getCoachNavCounts(profile: SerializedProfile) {
  assertCoach(profile)
  const db = ensurePrisma()
  const [programs, trainees] = await Promise.all([
    db.program.count({
      where: {
        createdById: profile.id,
      },
    }),
    db.user.count({
      where: {
        coachId: profile.id,
      },
    }),
  ])

  return {
    programs,
    trainees,
  }
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

async function getTraineeProgramDetail(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  const program = await db.program.findFirst({
    include: PROGRAM_INCLUDE,
    where: {
      id: programId,
      OR: [
        { createdById: profile.id },
        { assignments: { some: { userId: profile.id } } },
      ],
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
        rir?: number
        restTime?: number
        variationId: string
        reps: number
        sets: number
        weight?: number
      }>
      name: string
      scheduledDay?: number
      weekIndex?: number
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

  const program = await retryTransaction(() => db.$transaction(async (tx) => {
    const programId = randomUUID()
    const { exerciseRows, setRows, workoutRows } = buildProgramTreeCreateManyData(programId, input.workouts)

    await tx.program.create({
      data: {
        createdById: profile.id,
        description: input.description?.trim() || undefined,
        difficulty: input.difficulty,
        duration: Math.max(1, Math.round(input.duration)),
        id: programId,
        name: input.name.trim(),
        workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
      },
    })

    if (assignToUserIds.length > 0) {
      await tx.programAssignment.createMany({
        data: assignToUserIds.map((userId) => ({
          programId,
          userId,
        })),
      })
    }

    if (workoutRows.length > 0) {
      await tx.workout.createMany({
        data: workoutRows,
      })
    }

    if (exerciseRows.length > 0) {
      await tx.workoutExercise.createMany({
        data: exerciseRows,
      })
    }

    if (setRows.length > 0) {
      await tx.exerciseSet.createMany({
        data: setRows,
      })
    }

    const createdProgram = await tx.program.findUnique({
      include: PROGRAM_INCLUDE,
      where: {
        id: programId,
      },
    })

    if (!createdProgram) {
      throw new AuthServiceError("Không tìm thấy chương trình vừa tạo.", 404)
    }

    return createdProgram
  }, {
    maxWait: 15000,
    timeout: 60000,
  }))

  return serializeProgram(program as ProgramRecord)
}

async function updateCoachProgram(
  profile: SerializedProfile,
  programId: string,
  input: CoachProgramInput,
) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    include: PROGRAM_INCLUDE,
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  if (existingProgram.archivedAt) {
    throw new AuthServiceError("Program đã archive — hãy restore trước khi chỉnh sửa.", 409)
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

  await retryTransaction(() => db.$transaction(async (tx) => {
    const reusableWorkoutIds = buildReusableWorkoutIdsForProgramInput(existingProgram as ProgramRecord, input.workouts)
    const { exerciseRows, setRows, workoutRows } = buildProgramTreeCreateManyData(
      existingProgram.id,
      input.workouts,
      { workoutIds: reusableWorkoutIds },
    )
    const updatedWorkoutIds = buildUpdatedWorkoutIdsForProgramInput(
      existingProgram as ProgramRecord,
      input.workouts,
      workoutRows,
    )
    const coachUpdatesByWorkoutId = buildCoachUpdatePayloadForProgramInput(
      existingProgram as ProgramRecord,
      input.workouts,
      workoutRows,
      exerciseRows,
    )
    const previouslyAssignedUserIds = new Set(existingProgram.assignments.map((assignment) => assignment.userId))
    const notifiedUserIds = assignToUserIds.filter((userId) => previouslyAssignedUserIds.has(userId))
    // Preserve `assignedAt` for trainees who stay assigned: only remove dropped
    // assignments and insert genuinely new ones. Deleting + recreating all of
    // them would reset every trainee's program start date to now(), which
    // corrupts weekly-schedule windowing and log-export date ranges.
    const removedUserIds = Array.from(previouslyAssignedUserIds).filter(
      (userId) => !assignToUserIds.includes(userId),
    )
    const newlyAssignedUserIds = assignToUserIds.filter((userId) => !previouslyAssignedUserIds.has(userId))
    const existingWorkoutIds = existingProgram.workouts.map((workout) => workout.id)
    const existingWorkoutIdSet = new Set(existingWorkoutIds)
    const nextWorkoutIds = workoutRows.map((row) => String(row.id)).filter(Boolean)
    const nextWorkoutIdSet = new Set(nextWorkoutIds)
    const reusedWorkoutIds = nextWorkoutIds.filter((id) => existingWorkoutIdSet.has(id))
    const obsoleteWorkoutIds = existingWorkoutIds.filter((id) => !nextWorkoutIdSet.has(id))
    const newWorkoutRows = workoutRows.filter((row) => !existingWorkoutIdSet.has(String(row.id)))

    if (removedUserIds.length > 0) {
      await tx.programAssignment.deleteMany({
        where: {
          programId: existingProgram.id,
          userId: {
            in: removedUserIds,
          },
        },
      })
    }

    if (newlyAssignedUserIds.length > 0) {
      await tx.programAssignment.createMany({
        data: newlyAssignedUserIds.map((userId) => ({
          programId: existingProgram.id,
          userId,
        })),
      })
    }

    await backfillWorkoutLogProgramContextForWorkouts(tx, existingProgram.id, existingWorkoutIds)
    await backfillLegacyWorkoutLogProgramContextForAssignments(
      tx,
      existingProgram.id,
      existingProgram.assignments.filter((assignment) => !removedUserIds.includes(assignment.userId)),
      workoutRows,
      input.duration,
    )

    if (reusedWorkoutIds.length > 0) {
      await tx.workoutExercise.deleteMany({
        where: {
          workoutId: {
            in: reusedWorkoutIds,
          },
        },
      })
    }

    if (obsoleteWorkoutIds.length > 0) {
      await tx.workout.deleteMany({
        where: {
          id: {
            in: obsoleteWorkoutIds,
          },
          programId: existingProgram.id,
        },
      })
    }

    await tx.program.update({
      data: {
        description: input.description?.trim() || null,
        difficulty: input.difficulty,
        duration: Math.max(1, Math.round(input.duration)),
        name: input.name.trim(),
        workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
      },
      where: {
        id: existingProgram.id,
      },
    })

    await Promise.all(
      workoutRows
        .filter((row) => existingWorkoutIdSet.has(String(row.id)))
        .map((row) =>
          tx.workout.update({
            data: {
              duration: row.duration ?? null,
              name: row.name,
              scheduledDate: row.scheduledDate ?? null,
              scheduledDay: row.scheduledDay ?? null,
              weekIndex: row.weekIndex ?? null,
            },
            where: {
              id: String(row.id),
            },
          }),
        ),
    )

    if (newWorkoutRows.length > 0) {
      await tx.workout.createMany({
        data: newWorkoutRows,
      })
    }

    if (exerciseRows.length > 0) {
      await tx.workoutExercise.createMany({
        data: exerciseRows,
      })
    }

    if (setRows.length > 0) {
      await tx.exerciseSet.createMany({
        data: setRows,
      })
    }

    if (updatedWorkoutIds.length > 0 && notifiedUserIds.length > 0) {
      await tx.notification.createMany({
        data: notifiedUserIds.map((userId) => ({
          channel: "in_app",
          message: `Coach updated your plan ${existingProgram.name}.`,
          metadata: {
            coachUpdatesByWorkoutId,
            previousProgramName: existingProgram.name,
            traineeId: userId,
            trainerId: profile.id,
            updatedWorkoutIds,
          },
          relatedEntityId: existingProgram.id,
          relatedEntityType: "program",
          scheduledFor: new Date(),
          sentAt: new Date(),
          status: NotificationStatus.sent,
          title: "Your training plan was updated",
          type: NotificationType.program_assigned,
          userId,
        })),
      })
    }
  }, {
    maxWait: 15000,
    timeout: 60000,
  }))

  const program = await db.program.findUniqueOrThrow({
    include: PROGRAM_INCLUDE,
    where: { id: existingProgram.id },
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
        restTime?: number
        variationId: string
        reps: number
        sets: number
        weight?: number
      }>
      name: string
      scheduledDay?: number
      weekIndex?: number
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

  if (existingProgram.archivedAt) {
    throw new AuthServiceError("Program đã archive — hãy restore trước khi điều chỉnh.", 409)
  }

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

  const adjustedProgram = await retryTransaction(() => db.$transaction(async (transaction) => {
    const programId = randomUUID()
    const { exerciseRows, setRows, workoutRows } = buildProgramTreeCreateManyData(programId, input.workouts)
    const updatedWorkoutIds = buildUpdatedWorkoutIdsForProgramInput(existingProgram as ProgramRecord, input.workouts, workoutRows)
    const coachUpdatesByWorkoutId = buildCoachUpdatePayloadForProgramInput(
      existingProgram as ProgramRecord,
      input.workouts,
      workoutRows,
      exerciseRows,
    )

    await transaction.program.create({
      data: {
        createdById: profile.id,
        description: input.description?.trim() || undefined,
        difficulty: input.difficulty,
        duration: Math.max(1, Math.round(input.duration)),
        id: programId,
        name: input.name.trim(),
        workoutsPerWeek: countProgramWorkoutsPerWeek(input.workouts),
      },
    })

    await transaction.programAssignment.createMany({
      data: [{
        // The adjusted program continues the same engagement, so keep the
        // original assignedAt: export date windows are anchored on it and a
        // reset to now() would exclude all logs recorded before the adjustment.
        assignedAt: existingAssignment.assignedAt,
        programId,
        userId: traineeId,
      }],
    })

    if (workoutRows.length > 0) {
      await transaction.workout.createMany({
        data: workoutRows,
      })
    }

    if (exerciseRows.length > 0) {
      await transaction.workoutExercise.createMany({
        data: exerciseRows,
      })
    }

    if (setRows.length > 0) {
      await transaction.exerciseSet.createMany({
        data: setRows,
      })
    }

    await transaction.programAssignment.delete({
      where: {
        programId_userId: {
          programId: existingProgram.id,
          userId: traineeId,
        },
      },
    })

    // Adjusting forks the program under a new id, so carry this trainee's log
    // history over to the adjusted program. Without this, program-scoped
    // exports for the new program would come back empty even though the
    // trainee trained the whole time. Other trainees still assigned to the
    // original program keep their logs untouched.
    await transaction.workoutLog.updateMany({
      data: {
        programId,
      },
      where: {
        programId: existingProgram.id,
        userId: traineeId,
      },
    })

    await transaction.notification.create({
      data: {
        channel: "in_app",
        message: `Coach updated your plan from ${existingProgram.name}.`,
        metadata: {
          coachUpdatesByWorkoutId,
          previousProgramId: existingProgram.id,
          previousProgramName: existingProgram.name,
          traineeId: trainee.id,
          trainerId: profile.id,
          updatedWorkoutIds,
        },
        relatedEntityId: programId,
        relatedEntityType: "program",
        scheduledFor: new Date(),
        sentAt: new Date(),
        status: NotificationStatus.sent,
        title: "Your training plan was updated",
        type: NotificationType.program_assigned,
        userId: trainee.id,
      },
    })

    const createdProgram = await transaction.program.findUnique({
      include: PROGRAM_INCLUDE,
      where: {
        id: programId,
      },
    })

    if (!createdProgram) {
      throw new AuthServiceError("Không tìm thấy chương trình vừa tạo.", 404)
    }

    return createdProgram
  }, {
    maxWait: 15000,
    timeout: 60000,
  }))

  return serializeProgram(adjustedProgram as ProgramRecord)
}

// ─── Swap exercise for a trainee ─────────────────────────────────────────────
//
// Trainee (mid-workout) asks to replace one exercise with a same-movement
// alternative. Scope of the change: this workoutExercise + every subsequent
// workoutExercise in this workout using the same OLD variation + every
// workoutExercise in future workouts of the same program using that variation.
// Past workouts and already-logged sessions are untouched.
//
// If the workout belongs to a program the trainee doesn't own (i.e. a coach's
// program), we fork the whole program into a new one owned by the coach, move
// the trainee's assignment + logs to the fork, then apply the swap on the
// fork. The coach's original stays pristine so their other trainees are
// unaffected. A metadata-tagged notification tells the coach it happened.
//
// If it's the trainee's own personal workout program, we patch in-place with
// no fork and no notification.
async function swapExerciseForTraineeFromWorkout(
  profile: SerializedProfile,
  input: {
    newVariationId: string
    workoutExerciseId: string
    workoutId: string
  },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const workout = await db.workout.findFirst({
    include: {
      exercises: {
        include: WORKOUT_EXERCISE_INCLUDE,
        orderBy: { order: "asc" },
      },
      program: true,
    },
    where: {
      id: input.workoutId,
      program: {
        assignments: {
          some: { userId: profile.id },
        },
      },
    },
  })

  if (!workout) {
    throw new AuthServiceError("Không tìm thấy workout.", 404)
  }

  const targetExercise = workout.exercises.find((exercise) => exercise.id === input.workoutExerciseId)
  if (!targetExercise) {
    throw new AuthServiceError("Không tìm thấy bài tập trong workout.", 404)
  }

  const oldVariationId = targetExercise.variationId
  if (oldVariationId === input.newVariationId) {
    throw new AuthServiceError("Variation mới trùng variation hiện tại.", 400)
  }

  const newVariation = await db.variation.findUnique({
    include: { exercise: true },
    where: { id: input.newVariationId },
  })
  if (!newVariation) {
    throw new AuthServiceError("Không tìm thấy variation mới.", 400)
  }

  const targetOrder = targetExercise.order

  // Personal workout (trainee owns the program) — no fork, no notification.
  if (!workout.program || workout.program.createdById === profile.id) {
    const workoutIds = workout.programId
      ? (await db.workout.findMany({
          select: { id: true, scheduledDay: true, weekIndex: true },
          where: { programId: workout.programId },
        })).filter((candidate) =>
          candidate.id === workout.id ||
          isFutureWorkout(candidate, workout),
        ).map((candidate) => candidate.id)
      : [workout.id]

    await db.workoutExercise.updateMany({
      data: { variationId: input.newVariationId },
      where: {
        variationId: oldVariationId,
        workoutId: { in: workoutIds },
        ...(workout.programId
          ? {}
          : { workoutId: workout.id }),
        // For the current workout only apply from targetOrder onward; for
        // other workouts, apply to every matching variation.
      },
    })

    // updateMany can't express "in current workout: order >= targetOrder,
    // elsewhere: all". Correct that after the fact by re-checking earlier
    // rows in the current workout: any occurrence of oldVariationId before
    // targetOrder must be reverted.
    if (workoutIds.length > 0) {
      await db.workoutExercise.updateMany({
        data: { variationId: oldVariationId },
        where: {
          order: { lt: targetOrder },
          variationId: input.newVariationId,
          workoutId: workout.id,
        },
      })
    }

    return {
      currentSetIdMap: {} as Record<string, string>,
      currentWorkoutExerciseIdMap: {} as Record<string, string>,
      forkedProgramId: null,
      workoutId: workout.id,
    }
  }

  // Coach's program — fork.
  const originalProgram = workout.program
  const originalProgramId = originalProgram.id

  const [existingAssignment, fullProgram] = await Promise.all([
    db.programAssignment.findUnique({
      where: { programId_userId: { programId: originalProgramId, userId: profile.id } },
    }),
    db.program.findUnique({
      include: {
        workouts: {
          include: {
            exercises: {
              include: { sets: true },
              orderBy: { order: "asc" },
            },
          },
          orderBy: [{ weekIndex: "asc" }, { scheduledDay: "asc" }, { createdAt: "asc" }],
        },
      },
      where: { id: originalProgramId },
    }),
  ])

  if (!existingAssignment || !fullProgram) {
    throw new AuthServiceError("Không tìm thấy assignment gốc.", 404)
  }

  const workoutIdMap = new Map<string, string>()
  const workoutExerciseIdMap = new Map<string, string>()
  // ID mappings scoped to the workout the user is actively swapping in — the client
  // needs these to migrate its in-progress localStorage session (keyed by workoutId
  // and referencing exercise/set IDs) across the fork without losing completed sets.
  const currentWorkoutExerciseIdMap: Record<string, string> = {}
  const currentSetIdMap: Record<string, string> = {}

  const workoutRows: Prisma.WorkoutCreateManyInput[] = []
  const exerciseRows: Prisma.WorkoutExerciseCreateManyInput[] = []
  const setRows: Prisma.ExerciseSetCreateManyInput[] = []

  const forkedProgramId = randomUUID()

  for (const sourceWorkout of fullProgram.workouts) {
    const newWorkoutId = randomUUID()
    workoutIdMap.set(sourceWorkout.id, newWorkoutId)

    workoutRows.push({
      duration: sourceWorkout.duration ?? undefined,
      id: newWorkoutId,
      kind: sourceWorkout.kind ?? undefined,
      name: sourceWorkout.name,
      notes: sourceWorkout.notes ?? undefined,
      programId: forkedProgramId,
      scheduledDate: sourceWorkout.scheduledDate ?? undefined,
      scheduledDay: sourceWorkout.scheduledDay ?? undefined,
      weekIndex: sourceWorkout.weekIndex ?? undefined,
    })

    const shouldSwapWholeWorkout = isFutureWorkout(sourceWorkout, workout)
    const isCurrentWorkout = sourceWorkout.id === workout.id

    for (const sourceExercise of sourceWorkout.exercises) {
      const newExerciseId = randomUUID()
      workoutExerciseIdMap.set(sourceExercise.id, newExerciseId)
      if (isCurrentWorkout) {
        currentWorkoutExerciseIdMap[sourceExercise.id] = newExerciseId
      }

      const shouldSwap =
        sourceExercise.variationId === oldVariationId &&
        (shouldSwapWholeWorkout || (isCurrentWorkout && sourceExercise.order >= targetOrder))

      exerciseRows.push({
        id: newExerciseId,
        notes: sourceExercise.notes ?? undefined,
        order: sourceExercise.order,
        restTime: sourceExercise.restTime ?? undefined,
        variationId: shouldSwap ? input.newVariationId : sourceExercise.variationId,
        workoutId: newWorkoutId,
      })

      for (const sourceSet of sourceExercise.sets) {
        const newSetId = randomUUID()
        if (isCurrentWorkout) {
          currentSetIdMap[sourceSet.id] = newSetId
        }
        setRows.push({
          actualReps: sourceSet.actualReps ?? undefined,
          completed: sourceSet.completed,
          id: newSetId,
          notes: sourceSet.notes ?? undefined,
          rir: sourceSet.rir ?? undefined,
          setNumber: sourceSet.setNumber,
          targetReps: sourceSet.targetReps,
          targetRepsMin: sourceSet.targetRepsMin ?? undefined,
          weight: sourceSet.weight ?? undefined,
          workoutExerciseId: newExerciseId,
        })
      }
    }
  }

  const swappedWorkoutIds = Array.from(workoutIdMap.entries())
    .filter(([sourceWorkoutId]) => {
      const source = fullProgram.workouts.find((candidate) => candidate.id === sourceWorkoutId)
      if (!source) return false
      if (source.id === workout.id) return true
      return isFutureWorkout(source, workout)
    })
    .map(([, newWorkoutId]) => newWorkoutId)

  await retryTransaction(() => db.$transaction(async (transaction) => {
    await transaction.program.create({
      data: {
        createdById: originalProgram.createdById,
        description: originalProgram.description ?? undefined,
        difficulty: originalProgram.difficulty,
        duration: originalProgram.duration,
        id: forkedProgramId,
        isAIGenerated: originalProgram.isAIGenerated,
        name: originalProgram.name,
        workoutsPerWeek: originalProgram.workoutsPerWeek,
      },
    })

    await transaction.programAssignment.createMany({
      data: [{
        assignedAt: existingAssignment.assignedAt,
        programId: forkedProgramId,
        userId: profile.id,
      }],
    })

    if (workoutRows.length > 0) {
      await transaction.workout.createMany({ data: workoutRows })
    }
    if (exerciseRows.length > 0) {
      await transaction.workoutExercise.createMany({ data: exerciseRows })
    }
    if (setRows.length > 0) {
      await transaction.exerciseSet.createMany({ data: setRows })
    }

    await transaction.programAssignment.delete({
      where: {
        programId_userId: {
          programId: originalProgramId,
          userId: profile.id,
        },
      },
    })

    // Carry log history over so program-scoped queries (prev-performance,
    // exports) still see this trainee's past sessions after the fork.
    await transaction.workoutLog.updateMany({
      data: { programId: forkedProgramId },
      where: {
        programId: originalProgramId,
        userId: profile.id,
      },
    })

    await transaction.notification.create({
      data: {
        channel: "in_app",
        message: `Trainee ${profile.name} swapped an exercise in ${originalProgram.name}.`,
        metadata: {
          forkedProgramId,
          kind: "trainee_swapped_exercise",
          newExerciseName: newVariation.exercise.name,
          newVariationId: input.newVariationId,
          oldExerciseName: targetExercise.variation.exercise.name,
          oldVariationId,
          originalProgramId,
          swappedAt: new Date().toISOString(),
          swappedWorkoutIds,
          traineeId: profile.id,
          traineeName: profile.name,
        },
        relatedEntityId: forkedProgramId,
        relatedEntityType: "program",
        scheduledFor: new Date(),
        sentAt: new Date(),
        status: NotificationStatus.sent,
        title: "Trainee replaced an exercise",
        type: NotificationType.general,
        userId: originalProgram.createdById,
      },
    })
  }, {
    maxWait: 15000,
    timeout: 60000,
  }))

  return {
    currentSetIdMap,
    currentWorkoutExerciseIdMap,
    forkedProgramId,
    workoutId: workoutIdMap.get(workout.id) ?? workout.id,
  }
}

function isFutureWorkout(
  candidate: { scheduledDay: number | null; weekIndex: number | null },
  reference: { scheduledDay: number | null; weekIndex: number | null },
) {
  const candidateWeek = candidate.weekIndex ?? 0
  const referenceWeek = reference.weekIndex ?? 0
  if (candidateWeek > referenceWeek) return true
  if (candidateWeek < referenceWeek) return false
  const candidateDay = candidate.scheduledDay ?? 0
  const referenceDay = reference.scheduledDay ?? 0
  return candidateDay > referenceDay
}

async function deleteCoachProgram(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const existingProgram = await db.program.findFirst({
    select: { id: true },
    where: {
      createdById: profile.id,
      id: programId,
    },
  })

  if (!existingProgram) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  // Hard-delete is only allowed when the program is a draft: no assignments AND
  // no workout logs anywhere. WorkoutLog.programId is checked alongside the live
  // workout FK so orphaned logs (created before workouts were deleted on edit)
  // also block hard-delete.
  const [assignmentCount, liveLogCount, orphanLogCount] = await Promise.all([
    db.programAssignment.count({ where: { programId: existingProgram.id } }),
    db.workoutLog.count({ where: { workout: { programId: existingProgram.id } } }),
    db.workoutLog.count({ where: { programId: existingProgram.id } }),
  ])

  if (assignmentCount > 0 || liveLogCount > 0 || orphanLogCount > 0) {
    throw new AuthServiceError(
      "Program đã có assignment hoặc log — dùng Archive thay vì Delete.",
      409,
    )
  }

  await db.program.delete({
    where: { id: existingProgram.id },
  })

  return {
    deleted: true,
    id: existingProgram.id,
  }
}

async function archiveCoachProgram(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  const program = await assertCoachOwnsProgram(profile.id, programId)

  if (program.archivedAt) {
    return serializeProgram(program as ProgramRecord)
  }

  const updated = await db.program.update({
    data: { archivedAt: new Date() },
    include: PROGRAM_INCLUDE,
    where: { id: program.id },
  })

  return serializeProgram(updated as ProgramRecord)
}

async function restoreCoachProgram(profile: SerializedProfile, programId: string) {
  const db = ensurePrisma()
  const program = await assertCoachOwnsProgram(profile.id, programId)

  if (!program.archivedAt) {
    return serializeProgram(program as ProgramRecord)
  }

  const updated = await db.program.update({
    data: { archivedAt: null },
    include: PROGRAM_INCLUDE,
    where: { id: program.id },
  })

  return serializeProgram(updated as ProgramRecord)
}

async function assignCoachProgramToTrainee(profile: SerializedProfile, programId: string, traineeId: string) {
  const db = ensurePrisma()
  assertCoach(profile)

  const [program] = await Promise.all([
    assertCoachOwnsProgram(profile.id, programId),
    assertCoachOwnsTrainee(profile.id, traineeId),
  ])

  if (program.archivedAt) {
    throw new AuthServiceError("Program đã archive — hãy restore trước khi gán.", 409)
  }

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
      coach: {
        select: {
          name: true,
        },
      },
    },
  })

  return serializeBodyMetricEntry(entry as BodyMetricRecord)
}

async function listBodyMetricsForCurrentTrainee(
  profile: SerializedProfile,
  options?: BodyMetricListOptions,
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const entries = await db.bodyMetricEntry.findMany({
    include: {
      coach: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    where: {
      ...resolveBodyMetricRecordedAtFilter(options),
      traineeId: profile.id,
      weightKg: {
        not: null,
      },
    },
  })

  return entries.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord))
}

async function listBodyMetricsForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  options?: BodyMetricListOptions,
) {
  const db = ensurePrisma()
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)

  const entries = await db.bodyMetricEntry.findMany({
    include: {
      coach: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    where: {
      ...resolveBodyMetricRecordedAtFilter(options),
      traineeId,
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
      coach: {
        select: {
          name: true,
        },
      },
    },
  })

  // Seed goal starting weight for users who already have a target but never
  // logged a weight when they set it. Only fires when this is the user's very
  // first weighted entry so it doesn't overwrite an established anchor.
  if (weightKg != null && profile.targetWeightKg != null && profile.goalStartWeightKg == null) {
    const otherWeightedEntries = await db.bodyMetricEntry.count({
      where: {
        id: { not: entry.id },
        traineeId: profile.id,
        weightKg: { not: null },
      },
    })

    if (otherWeightedEntries === 0) {
      await db.user.update({
        data: { goalStartWeightKg: weightKg },
        where: { id: profile.id },
      })
    }
  }

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
      coach: {
        select: {
          name: true,
        },
      },
    },
  })

  return serializeCoachCheckIn(checkIn as CoachCheckInRecord)
}

async function listWorkoutLogsForExportTrainee(
  profile: SerializedProfile,
  options: { from: string; programId?: string; to: string },
) {
  const db = ensurePrisma()
  assertTrainee(profile)

  const parsedFrom = parseLocalDateInput(options.from)
  const parsedTo = parseLocalDateInput(options.to)

  if (!parsedFrom || !parsedTo) {
    throw new AuthServiceError("from/to không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  if (parsedTo <= parsedFrom) {
    throw new AuthServiceError("to phải sau from.", 400)
  }

  // When a programId is provided, scope to that program's logs. Also include
  // logs with programId=NULL — those are legacy or orphaned logs (workout link
  // cleared by a program edit) that fall inside the date window and belong to
  // this program semantically. Same pattern as the coach export.
  const programFilter = options.programId
    ? { OR: [{ programId: options.programId }, { programId: null }] }
    : {}

  const logs = await db.workoutLog.findMany({
    include: WORKOUT_LOG_INCLUDE,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    where: {
      startedAt: { gte: parsedFrom, lt: parsedTo },
      userId: profile.id,
      ...programFilter,
    },
  })

  return logs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord))
}

async function exportWorkoutLogsToGoogleSheetsForTrainee(
  profile: SerializedProfile,
  options: { from: string; label?: string; to: string },
) {
  const logs = await listWorkoutLogsForExportTrainee(profile, options)

  if (logs.length === 0) {
    throw new AuthServiceError("Không có workout log nào trong khoảng thời gian này.", 400)
  }

  return exportWorkoutLogsToN8n({
    event: "trainee_workout_logs_export",
    exportedBy: profile,
    filters: {
      from: options.from,
      label: options.label,
      to: options.to,
    },
    logs,
    trainee: profile,
  })
}

async function listCoachWorkoutLogsForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  options?: { cursor?: string; from?: string; limit?: number; programId?: string; to?: string; weekStart?: string },
) {
  const db = ensurePrisma()
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)
  if (options?.programId) {
    await assertCoachOwnsProgram(profile.id, options.programId)
  }

  const take = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const parsedWeekStart = options?.weekStart ? parseLocalDateInput(options.weekStart) : undefined

  if (options?.weekStart && !parsedWeekStart) {
    throw new AuthServiceError("weekStart không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  const parsedFrom = options?.from ? parseLocalDateInput(options.from) : undefined
  const parsedTo = options?.to ? parseLocalDateInput(options.to) : undefined

  if (options?.from && !parsedFrom) {
    throw new AuthServiceError("from không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  if (options?.to && !parsedTo) {
    throw new AuthServiceError("to không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  const weekEnd = parsedWeekStart ? addLocalDays(parsedWeekStart, 7) : undefined

  const dateFilter = parsedFrom && parsedTo
    ? { startedAt: { gte: parsedFrom, lt: parsedTo } }
    : parsedWeekStart && weekEnd
      ? { startedAt: { gte: parsedWeekStart, lt: weekEnd } }
      : {}

  // When a date bound is present, also include logs where programId IS NULL —
  // these are orphaned logs whose workout was deleted by a prior program edit
  // (WorkoutLog.workoutId ON DELETE SET NULL clears the link). The date window
  // already scopes them to this program's period, so including them is correct.
  // Without this, any log created before the programId column was added would
  // silently disappear from exports after a program edit.
  const hasDateBound = !!((parsedFrom && parsedTo) || (parsedWeekStart && weekEnd))
  const programFilter = options?.programId
    ? hasDateBound
      ? { OR: [{ programId: options.programId }, { programId: null }] }
      : { programId: options.programId }
    : {}

  const workoutLogs = await db.workoutLog.findMany({
    cursor: options?.cursor ? { id: options.cursor } : undefined,
    include: WORKOUT_LOG_INCLUDE,
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    skip: options?.cursor ? 1 : 0,
    take: take + 1,
    where: {
      ...dateFilter,
      ...programFilter,
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

async function listCoachWorkoutLogsForExport(
  profile: SerializedProfile,
  traineeId: string,
  options?: { from?: string; programId?: string; to?: string; weekStart?: string },
) {
  const db = ensurePrisma()
  assertCoach(profile)
  await assertCoachOwnsTrainee(profile.id, traineeId)
  if (options?.programId) {
    await assertCoachOwnsProgram(profile.id, options.programId)
  }

  const parsedWeekStart = options?.weekStart ? parseLocalDateInput(options.weekStart) : undefined

  if (options?.weekStart && !parsedWeekStart) {
    throw new AuthServiceError("weekStart không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  const parsedFrom = options?.from ? parseLocalDateInput(options.from) : undefined
  const parsedTo = options?.to ? parseLocalDateInput(options.to) : undefined

  if (options?.from && !parsedFrom) {
    throw new AuthServiceError("from không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  if (options?.to && !parsedTo) {
    throw new AuthServiceError("to không hợp lệ. Dùng định dạng YYYY-MM-DD.", 400)
  }

  const weekEnd = parsedWeekStart ? addLocalDays(parsedWeekStart, 7) : undefined
  const dateFilter = parsedFrom && parsedTo
    ? { startedAt: { gte: parsedFrom, lt: parsedTo } }
    : parsedWeekStart && weekEnd
      ? { startedAt: { gte: parsedWeekStart, lt: weekEnd } }
      : {}

  // When a date bound is present, also include logs where programId IS NULL —
  // these are orphaned logs whose workout was deleted by a prior program edit
  // (WorkoutLog.workoutId ON DELETE SET NULL clears the link). The date window
  // already scopes them to this program's period.
  const hasDateBound = !!((parsedFrom && parsedTo) || (parsedWeekStart && weekEnd))
  const programFilter = options?.programId
    ? hasDateBound
      ? { OR: [{ programId: options.programId }, { programId: null }] }
      : { programId: options.programId }
    : {}

  const workoutLogs = await db.workoutLog.findMany({
    include: WORKOUT_LOG_INCLUDE,
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    where: {
      ...dateFilter,
      ...programFilter,
      userId: traineeId,
    },
  })

  return workoutLogs.map((log) => serializeWorkoutLog(log as WorkoutLogRecord))
}

async function exportCoachWorkoutLogsToGoogleSheetsForTrainee(
  profile: SerializedProfile,
  traineeId: string,
  options?: { from?: string; label?: string; programId?: string; to?: string; weekStart?: string },
) {
  assertCoach(profile)
  const trainee = await assertCoachOwnsTrainee(profile.id, traineeId)
  const logs = await listCoachWorkoutLogsForExport(profile, traineeId, options)

  if (logs.length === 0) {
    throw new AuthServiceError("Không có workout log nào trong khoảng thời gian này.", 400)
  }

  return exportWorkoutLogsToN8n({
    event: "coach_trainee_workout_logs_export",
    exportedBy: profile,
    filters: {
      from: options?.from,
      label: options?.label,
      programId: options?.programId,
      to: options?.to,
      weekStart: options?.weekStart,
    },
    logs,
    trainee,
    coachName: profile.name,
  })
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
  const [thisWeekWorkouts, progressLogs, bodyMetrics, checkIns, recentMeals] = await Promise.all([
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
        coach: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      where: {
        traineeId: trainee.id,
      },
    }),
    db.coachCheckIn.findMany({
      include: {
        coach: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
      take: 8,
      where: {
        traineeId: trainee.id,
      },
    }),
    db.meal.findMany({
      include: MEAL_WITH_FOOD_INCLUDE,
      orderBy: { loggedDate: "desc" },
      where: {
        loggedDate: { gte: last30Days.start, lte: last30Days.end },
        userId: trainee.id,
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

  // Group meals by day and compute per-day totals
  const mealsByDay = new Map<
    string,
    {
      calories: number
      carbs: number
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
  >()
  for (const meal of recentMeals) {
    const dateKey = meal.loggedDate instanceof Date
      ? meal.loggedDate.toISOString().slice(0, 10)
      : String(meal.loggedDate).slice(0, 10)
    const existing = mealsByDay.get(dateKey) ?? { calories: 0, carbs: 0, fat: 0, items: [], protein: 0 }
    mealsByDay.set(dateKey, {
      calories: existing.calories + (meal.calories ?? 0),
      carbs: existing.carbs + (meal.carbs ?? 0),
      fat: existing.fat + (meal.fat ?? 0),
      items: [
        ...existing.items,
        ...meal.items.map((item) => ({
          amountLabel: item.amountLabel ?? undefined,
          calories: Math.round(item.calories ?? 0),
          carbs: item.carbs ?? undefined,
          fat: item.fat ?? undefined,
          id: item.id,
          mealType: meal.type,
          name: item.foodNameSnapshot ?? item.food.name,
          protein: item.protein ?? undefined,
        })),
      ],
      protein: existing.protein + (meal.protein ?? 0),
    })
  }
  const dailyNutritionLogs = Array.from(mealsByDay.entries())
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => b.date.localeCompare(a.date))
  const daysTracked = dailyNutritionLogs.length
  const avgCalories = daysTracked > 0 ? Math.round(dailyNutritionLogs.reduce((s, d) => s + d.calories, 0) / daysTracked) : 0
  const avgProtein = daysTracked > 0 ? Math.round(dailyNutritionLogs.reduce((s, d) => s + d.protein, 0) / daysTracked) : 0
  const avgCarbs = daysTracked > 0 ? Math.round(dailyNutritionLogs.reduce((s, d) => s + d.carbs, 0) / daysTracked) : 0
  const avgFat = daysTracked > 0 ? Math.round(dailyNutritionLogs.reduce((s, d) => s + d.fat, 0) / daysTracked) : 0

  return {
    bodyMetrics: bodyMetrics.map((entry) => serializeBodyMetricEntry(entry as BodyMetricRecord)),
    checkIns: checkIns.map((entry) => serializeCoachCheckIn(entry as CoachCheckInRecord)),
    programs: trainee.programAssignments.map((assignment) => serializeProgram(assignment.program as ProgramRecord)),
    nutritionSummary: {
      avgCalories,
      avgCarbs,
      avgFat,
      avgProtein,
      dailyLogs: dailyNutritionLogs,
      daysTracked,
      traineeCalorieGoal: trainee.dailyCalorieGoal ?? 0,
    },
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
        trainee: {
          select: TRAINEE_SUMMARY_SELECT,
        },
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
        user: {
          select: MINI_USER_SELECT,
        },
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
        trainee: {
          select: TRAINEE_SUMMARY_SELECT,
        },
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
  archiveCoachProgram,
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
  exportCoachWorkoutLogsToGoogleSheetsForTrainee,
  exportWorkoutLogsToGoogleSheetsForTrainee,
  getCoachDashboard,
  getCoachNavCounts,
  getDashboardForTrainee,
  getCoachProgramDetail,
  getCoachTraineeDetail,
  getTraineeProgramDetail,
  getCalendarForTrainee,
  getProgressAnalyticsForCurrentTrainee,
  getWorkoutDetailForTrainee,
  getWorkoutLogDetailForTrainee,
  getYearViewForTrainee,
  listAvailableCoachesForTrainee,
  listBodyMetricsForCurrentTrainee,
  listBodyMetricsForTrainee,
  listCoachExerciseImportRequests,
  listExerciseLibrary,
  listCoachExercises,
  listCoachPrograms,
  listCoachWorkoutLogsForExport,
  listCoachWorkoutLogsForTrainee,
  listCoachTrainees,
  listExercises,
  listMealHistoryForUser,
  listMealsForUser,
  listNotificationsForUser,
  listWorkoutLogsForExportTrainee,
  listWorkoutsForTrainee,
  markAllNotificationsAsReadForUser,
  markNotificationAsReadForUser,
  resetCurrentTraineeData,
  restoreCoachProgram,
  selectVisibleWorkoutsForAssignmentWeek,
  submitCoachExerciseImportRequest,
  swapExerciseForTraineeFromWorkout,
  unassignCoachProgramFromTrainee,
  updateCoachExercise,
  updateCoachProgram,
  updateCoachRequestStatus,
  updateMealForUser,
  updatePersonalWorkoutForTrainee,
  updateWorkoutLogCommentForCoach,
}
