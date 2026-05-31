import {
  CoachRequestStatus,
  Prisma,
  PrismaClient,
  UserRole,
  type AdminAuditLog,
  type Program,
  type User,
} from "@prisma/client"

import { prisma } from "../../lib/prisma"
import { supabaseAdmin } from "../../lib/supabase"
import { AuthServiceError, type SerializedProfile } from "../auth.service"

type DbClient = PrismaClient | Prisma.TransactionClient

type UserSummaryRecord = User & {
  coach: User | null
  _count: {
    meals: number
    programAssignments: number
    programsCreated: number
    trainees: number
    workoutLogs: number
  }
}

type ProgramSummaryRecord = Program & {
  createdBy: User
  _count: {
    assignments: number
    workouts: number
  }
}

const ADMIN_VARIATION_INCLUDE = {
  _count: {
    select: {
      workoutExercises: true,
    },
  },
  exercise: {
    include: {
      createdBy: true,
    },
  },
} satisfies Prisma.VariationInclude

type ExerciseSummaryRecord = Prisma.VariationGetPayload<{
  include: typeof ADMIN_VARIATION_INCLUDE
}>

type ExerciseWithVariationsRecord = Prisma.ExerciseGetPayload<{
  include: {
    variations: true
  }
}>

type CoachRequestRecord = {
  coach: User
  coachId: string
  createdAt: Date
  id: string
  status: CoachRequestStatus
  trainee: User
  traineeId: string
  updatedAt: Date
}

type AuditLogRecord = AdminAuditLog & {
  admin: User
}

type ExerciseImportRowInput = {
  exerciseName?: string
  equipment?: string
  isDefault?: boolean
  muscleGroup?: string
  rowNumber?: number
  sortOrder?: number
  variationName?: string
}

const DAILY_CHART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
})

const MONTHLY_CHART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
})

function ensurePrisma() {
  if (!prisma) {
    throw new AuthServiceError("Database is not configured.", 500)
  }

  return prisma
}

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) {
    throw new AuthServiceError("Chỉ admin mới có quyền truy cập dữ liệu này.", 403)
  }
}

function sanitizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function normalizeSearch(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function normalizePhoneDigits(value?: string | null) {
  return (value ?? "").replace(/\D/g, "")
}

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth(value = new Date()) {
  const date = new Date(value)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function serializeMiniUser(user: Pick<User, "avatar" | "email" | "id" | "isActive" | "name" | "phone" | "role">) {
  return {
    avatar: user.avatar ?? undefined,
    email: user.email,
    id: user.id,
    isActive: user.isActive,
    name: user.name,
    phone: user.phone ?? undefined,
    role: user.role,
  }
}

function serializeUserListItem(user: UserSummaryRecord) {
  return {
    coach: user.coach ? serializeMiniUser(user.coach) : null,
    coachId: user.coachId,
    createdAt: user.createdAt,
    dailyCalorieGoal: user.dailyCalorieGoal,
    email: user.email,
    fitnessGoals: user.fitnessGoals,
    id: user.id,
    isActive: user.isActive,
    name: user.name,
    phone: user.phone ?? undefined,
    preferredWeightUnit: user.preferredWeightUnit,
    role: user.role,
    stats: {
      assignedPrograms: user._count.programAssignments,
      createdPrograms: user._count.programsCreated,
      meals: user._count.meals,
      trainees: user._count.trainees,
      workoutLogs: user._count.workoutLogs,
    },
    updatedAt: user.updatedAt,
    username: user.username ?? undefined,
  }
}

function serializeCoachRequest(request: CoachRequestRecord) {
  return {
    coach: serializeMiniUser(request.coach),
    coachId: request.coachId,
    createdAt: request.createdAt,
    id: request.id,
    status: request.status,
    trainee: serializeMiniUser(request.trainee),
    traineeId: request.traineeId,
    updatedAt: request.updatedAt,
  }
}

function serializeProgramSummary(program: ProgramSummaryRecord) {
  return {
    assignmentCount: program._count.assignments,
    createdAt: program.createdAt,
    createdBy: serializeMiniUser(program.createdBy),
    description: program.description ?? undefined,
    difficulty: program.difficulty,
    duration: program.duration,
    id: program.id,
    name: program.name,
    workoutsPerWeek: program.workoutsPerWeek || program._count.workouts,
  }
}

function serializeExerciseSummary(exercise: ExerciseSummaryRecord) {
  return {
    createdAt: exercise.createdAt,
    createdBy: exercise.exercise.createdBy ? serializeMiniUser(exercise.exercise.createdBy) : null,
    equipment: exercise.equipment ?? undefined,
    id: exercise.id,
    isDefault: exercise.isDefault,
    muscleGroup: exercise.exercise.muscleGroup,
    name: exercise.exercise.name,
    updatedAt: exercise.updatedAt,
    usageCount: exercise._count.workoutExercises,
    variationName: exercise.name,
  }
}

function serializeAuditLog(log: AuditLogRecord) {
  return {
    action: log.action,
    admin: serializeMiniUser(log.admin),
    createdAt: log.createdAt,
    entityId: log.entityId ?? undefined,
    entityLabel: log.entityLabel ?? undefined,
    entityType: log.entityType,
    id: log.id,
    metadata: log.metadata ?? undefined,
  }
}

function buildDailyCountSeries(values: Date[]) {
  const rangeStart = startOfDay(new Date())
  rangeStart.setDate(rangeStart.getDate() - 6)

  const totals = new Map<string, number>()

  values.forEach((value) => {
    if (value < rangeStart) {
      return
    }

    const bucket = startOfDay(value).toISOString()
    totals.set(bucket, (totals.get(bucket) ?? 0) + 1)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setDate(rangeStart.getDate() + index)

    return {
      label: DAILY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString()) ?? 0,
    }
  })
}

function buildMonthlyCountSeries(values: Date[]) {
  const rangeStart = startOfMonth(new Date())
  rangeStart.setMonth(rangeStart.getMonth() - 5)

  const totals = new Map<string, number>()

  values.forEach((value) => {
    if (value < rangeStart) {
      return
    }

    const bucketDate = startOfMonth(value)
    const bucket = bucketDate.toISOString()
    totals.set(bucket, (totals.get(bucket) ?? 0) + 1)
  })

  return Array.from({ length: 6 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setMonth(rangeStart.getMonth() + index)

    return {
      label: MONTHLY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString()) ?? 0,
    }
  })
}

function buildDailyUniqueSeries(values: Array<{ occurredAt: Date; userId: string }>) {
  const rangeStart = startOfDay(new Date())
  rangeStart.setDate(rangeStart.getDate() - 6)

  const totals = new Map<string, Set<string>>()

  values.forEach((value) => {
    if (value.occurredAt < rangeStart) {
      return
    }

    const bucket = startOfDay(value.occurredAt).toISOString()
    const currentSet = totals.get(bucket) ?? new Set<string>()
    currentSet.add(value.userId)
    totals.set(bucket, currentSet)
  })

  return Array.from({ length: 7 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setDate(rangeStart.getDate() + index)

    return {
      label: DAILY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString())?.size ?? 0,
    }
  })
}

function buildMonthlyUniqueSeries(values: Array<{ occurredAt: Date; userId: string }>) {
  const rangeStart = startOfMonth(new Date())
  rangeStart.setMonth(rangeStart.getMonth() - 5)

  const totals = new Map<string, Set<string>>()

  values.forEach((value) => {
    if (value.occurredAt < rangeStart) {
      return
    }

    const bucketDate = startOfMonth(value.occurredAt)
    const bucket = bucketDate.toISOString()
    const currentSet = totals.get(bucket) ?? new Set<string>()
    currentSet.add(value.userId)
    totals.set(bucket, currentSet)
  })

  return Array.from({ length: 6 }, (_value, index) => {
    const bucketDate = new Date(rangeStart)
    bucketDate.setMonth(rangeStart.getMonth() + index)

    return {
      label: MONTHLY_CHART_FORMATTER.format(bucketDate),
      periodStart: bucketDate,
      value: totals.get(bucketDate.toISOString())?.size ?? 0,
    }
  })
}

function matchesSearch(parts: Array<string | null | undefined>, search: string) {
  if (!search) {
    return true
  }

  const normalizedSearch = search.toLowerCase()
  const normalizedDigits = normalizePhoneDigits(search)

  return parts.some((part) => {
    if (!part) {
      return false
    }

    const normalizedPart = part.toLowerCase()

    if (normalizedPart.includes(normalizedSearch)) {
      return true
    }

    if (normalizedDigits && normalizePhoneDigits(part).includes(normalizedDigits)) {
      return true
    }

    return false
  })
}

async function logAdminAudit(
  db: DbClient,
  adminId: string,
  input: {
    action: string
    entityId?: string
    entityLabel?: string
    entityType: string
    metadata?: Prisma.JsonObject
  },
) {
  await db.adminAuditLog.create({
    data: {
      action: input.action,
      adminId,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      entityType: input.entityType,
      metadata: input.metadata,
    },
  })
}

async function getAdminDashboard(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const monthlyRangeStart = startOfMonth(new Date())
  monthlyRangeStart.setMonth(monthlyRangeStart.getMonth() - 5)
  const recent30Days = startOfDay(new Date())
  recent30Days.setDate(recent30Days.getDate() - 29)

  const [
    totalUsers,
    totalAdmins,
    totalCoaches,
    totalTrainees,
    totalPrograms,
    totalMeals,
    totalWorkoutLogs,
    pendingCoachRequests,
    recentUsers,
    topCoaches,
    recentPrograms,
    recentPendingCoachRequests,
    userGrowthDates,
    workoutActivity,
    mealActivity,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: {
        role: UserRole.admin,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.coach,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.trainee,
      },
    }),
    db.program.count(),
    db.meal.count(),
    db.workoutLog.count(),
    db.coachRequest.count({
      where: {
        status: CoachRequestStatus.pending,
      },
    }),
    db.user.findMany({
      include: {
        coach: true,
        _count: {
          select: {
            meals: true,
            programAssignments: true,
            programsCreated: true,
            trainees: true,
            workoutLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.user.findMany({
      include: {
        _count: {
          select: {
            programsCreated: true,
            trainees: true,
          },
        },
      },
      where: {
        role: UserRole.coach,
      },
    }),
    db.program.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
            workouts: true,
          },
        },
        createdBy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.coachRequest.findMany({
      include: {
        coach: true,
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      where: {
        status: CoachRequestStatus.pending,
      },
    }),
    db.user.findMany({
      select: {
        createdAt: true,
      },
      where: {
        createdAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
    db.workoutLog.findMany({
      select: {
        startedAt: true,
        userId: true,
      },
      where: {
        startedAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
    db.meal.findMany({
      select: {
        recordedAt: true,
        userId: true,
      },
      where: {
        recordedAt: {
          gte: monthlyRangeStart,
        },
      },
    }),
  ])

  const userGrowth = userGrowthDates.map((entry) => entry.createdAt)
  const workoutLogDates = workoutActivity.map((entry) => entry.startedAt)
  const combinedActivity = [
    ...workoutActivity.map((entry) => ({
      occurredAt: entry.startedAt,
      userId: entry.userId,
    })),
    ...mealActivity.map((entry) => ({
      occurredAt: entry.recordedAt,
      userId: entry.userId,
    })),
  ]
  const activeUsersLast30Days = new Set(
    combinedActivity.filter((entry) => entry.occurredAt >= recent30Days).map((entry) => entry.userId),
  ).size
  const recent7DaysStart = startOfDay(new Date())
  recent7DaysStart.setDate(recent7DaysStart.getDate() - 6)
  const activeUsersLast7Days = new Set(
    combinedActivity.filter((entry) => entry.occurredAt >= recent7DaysStart).map((entry) => entry.userId),
  ).size

  return {
    charts: {
      activeUsers: {
        monthly: buildMonthlyUniqueSeries(combinedActivity),
        weekly: buildDailyUniqueSeries(combinedActivity),
      },
      userGrowth: {
        monthly: buildMonthlyCountSeries(userGrowth),
        weekly: buildDailyCountSeries(userGrowth),
      },
      workoutLogs: {
        monthly: buildMonthlyCountSeries(workoutLogDates),
        weekly: buildDailyCountSeries(workoutLogDates),
      },
    },
    pendingCoachRequests: recentPendingCoachRequests.map((request) => serializeCoachRequest(request as CoachRequestRecord)),
    recentPrograms: recentPrograms.map((program) => serializeProgramSummary(program as ProgramSummaryRecord)),
    recentUsers: recentUsers.map((user) => serializeUserListItem(user as UserSummaryRecord)),
    stats: {
      activeUsersLast30Days,
      activeUsersLast7Days,
      pendingCoachRequests,
      totalAdmins,
      totalCoaches,
      totalMeals,
      totalPrograms,
      totalTrainees,
      totalUsers,
      totalWorkoutLogs,
    },
    topCoaches: topCoaches
      .map((coach) => ({
        email: coach.email,
        id: coach.id,
        isActive: coach.isActive,
        name: coach.name,
        programCount: coach._count.programsCreated,
        traineeCount: coach._count.trainees,
      }))
      .sort((left, right) => right.traineeCount - left.traineeCount || right.programCount - left.programCount)
      .slice(0, 6),
  }
}

async function listAdminUsers(
  profile: SerializedProfile,
  options?: {
    role?: UserRole | "all"
    search?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const users = await db.user.findMany({
    include: {
      coach: true,
      _count: {
        select: {
          meals: true,
          programAssignments: true,
          programsCreated: true,
          trainees: true,
          workoutLogs: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: options?.role && options.role !== "all" ? { role: options.role } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return users
    .filter((user) =>
      matchesSearch([user.name, user.email, user.username, user.phone, user.coach?.name, user.coach?.email], search),
    )
    .map((user) => serializeUserListItem(user as UserSummaryRecord))
}

async function getAdminUserDetail(profile: SerializedProfile, userId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const user = await db.user.findUnique({
    include: {
      coach: true,
      coachRequestsAsCoach: {
        include: {
          coach: true,
          trainee: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      coachRequestsAsTrainee: {
        include: {
          coach: true,
          trainee: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      programAssignments: {
        include: {
          program: {
            include: {
              _count: {
                select: {
                  assignments: true,
                  workouts: true,
                },
              },
              createdBy: true,
            },
          },
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 6,
      },
      programsCreated: {
        include: {
          _count: {
            select: {
              assignments: true,
              workouts: true,
            },
          },
          createdBy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      },
      trainees: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      workoutLogs: {
        include: {
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
      },
      _count: {
        select: {
          meals: true,
          programAssignments: true,
          programsCreated: true,
          trainees: true,
          workoutLogs: true,
        },
      },
    },
    where: {
      id: userId,
    },
  })

  if (!user) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  const auditLogs = await db.adminAuditLog.findMany({
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 8,
    where: {
      OR: [{ adminId: user.id }, { entityId: user.id }],
    },
  })

  return {
    assignedCoach: user.coach ? serializeMiniUser(user.coach) : null,
    assignedPrograms: user.programAssignments.map((assignment) =>
      serializeProgramSummary(assignment.program as ProgramSummaryRecord),
    ),
    coachRequests: [...user.coachRequestsAsCoach, ...user.coachRequestsAsTrainee]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 8)
      .map((request) => serializeCoachRequest(request as CoachRequestRecord)),
    connectedTrainees: user.trainees.map((trainee) => serializeMiniUser(trainee)),
    createdPrograms: user.programsCreated.map((program) => serializeProgramSummary(program as ProgramSummaryRecord)),
    recentAuditLogs: auditLogs.map((log) => serializeAuditLog(log as AuditLogRecord)),
    recentWorkoutLogs: user.workoutLogs.map((log) => ({
      completedAt: log.completedAt ?? undefined,
      id: log.id,
      startedAt: log.startedAt,
      totalVolume: log.totalVolume ?? undefined,
      workout: log.workout
        ? {
            id: log.workout.id,
            name: log.workout.name,
          }
        : null,
    })),
    user: serializeUserListItem(user as UserSummaryRecord),
  }
}

async function updateAdminUser(
  profile: SerializedProfile,
  userId: string,
  input: {
    isActive?: boolean
    role?: UserRole
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const existingUser = await db.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!existingUser) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  const nextRole = input.role ?? existingUser.role
  const nextIsActive = input.isActive ?? existingUser.isActive

  if (existingUser.id === profile.id && (nextRole !== UserRole.admin || !nextIsActive)) {
    throw new AuthServiceError("Bạn không thể tự hạ quyền hoặc tự khoá tài khoản admin đang đăng nhập.", 400)
  }

  if (existingUser.role === UserRole.admin && (nextRole !== UserRole.admin || !nextIsActive)) {
    const activeOtherAdmins = await db.user.count({
      where: {
        id: {
          not: existingUser.id,
        },
        isActive: true,
        role: UserRole.admin,
      },
    })

    if (activeOtherAdmins === 0) {
      throw new AuthServiceError("Hệ thống cần giữ lại ít nhất một admin đang hoạt động.", 400)
    }
  }

  const updatedUser = await db.$transaction(async (transaction) => {
    if (existingUser.role === UserRole.coach && nextRole !== UserRole.coach) {
      await transaction.user.updateMany({
        data: {
          coachId: null,
        },
        where: {
          coachId: existingUser.id,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          coachId: existingUser.id,
          status: CoachRequestStatus.pending,
        },
      })
    }

    const updated = await transaction.user.update({
      data: {
        coachId: nextRole === UserRole.trainee ? existingUser.coachId : null,
        isActive: nextIsActive,
        programAssignments: nextRole === UserRole.trainee ? undefined : { deleteMany: {} },
        role: nextRole,
      },
      include: {
        coach: true,
        _count: {
          select: {
            meals: true,
            programAssignments: true,
            programsCreated: true,
            trainees: true,
            workoutLogs: true,
          },
        },
      },
      where: {
        id: existingUser.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "user.updated",
      entityId: updated.id,
      entityLabel: updated.email,
      entityType: "user",
      metadata: {
        isActive: nextIsActive,
        previousIsActive: existingUser.isActive,
        previousRole: existingUser.role,
        role: nextRole,
      },
    })

    return updated
  })

  if (supabaseAdmin && existingUser.supabaseAuthUserId) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.supabaseAuthUserId, {
        user_metadata: {
          isActive: nextIsActive,
          role: nextRole,
        },
      })
    } catch (error) {
      console.warn("Unable to sync admin user metadata to Supabase", error)
    }
  }

  return serializeUserListItem(updatedUser as UserSummaryRecord)
}

async function resetAdminUserPassword(profile: SerializedProfile, userId: string, password: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const trimmedPassword = password.trim()

  if (trimmedPassword.length < 6) {
    throw new AuthServiceError("Mật khẩu mới phải có ít nhất 6 ký tự.", 400)
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
  })

  if (!user) {
    throw new AuthServiceError("Không tìm thấy người dùng.", 404)
  }

  if (!user.supabaseAuthUserId || !supabaseAdmin) {
    throw new AuthServiceError("Không thể reset mật khẩu thủ công vì Supabase admin chưa được cấu hình.", 500)
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.supabaseAuthUserId, {
    password: trimmedPassword,
  })

  if (error) {
    throw new AuthServiceError(error.message, 400)
  }

  await logAdminAudit(db, profile.id, {
    action: "user.password_reset",
    entityId: user.id,
    entityLabel: user.email,
    entityType: "user",
  })

  return {
    success: true,
    userId: user.id,
  }
}

async function listAdminCoachRequests(
  profile: SerializedProfile,
  options?: {
    search?: string
    status?: CoachRequestStatus | "all"
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const requests = await db.coachRequest.findMany({
    include: {
      coach: true,
      trainee: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    where: options?.status && options.status !== "all" ? { status: options.status } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return requests
    .filter((request) =>
      matchesSearch(
        [request.coach.name, request.coach.email, request.trainee.name, request.trainee.email],
        search,
      ),
    )
    .map((request) => serializeCoachRequest(request as CoachRequestRecord))
}

async function updateAdminCoachRequest(
  profile: SerializedProfile,
  requestId: string,
  status: CoachRequestStatus,
) {
  assertAdmin(profile)
  const db = ensurePrisma()

  if (status === CoachRequestStatus.pending) {
    throw new AuthServiceError("Trạng thái coach request không hợp lệ.", 400)
  }

  const existingRequest = await db.coachRequest.findUnique({
    include: {
      coach: true,
      trainee: true,
    },
    where: {
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status !== CoachRequestStatus.pending) {
    throw new AuthServiceError("Coach request này đã được xử lý trước đó.", 400)
  }

  const updatedRequest = await db.$transaction(async (transaction) => {
    const request = await transaction.coachRequest.update({
      data: {
        status,
      },
      include: {
        coach: true,
        trainee: true,
      },
      where: {
        id: existingRequest.id,
      },
    })

    if (status === CoachRequestStatus.approved) {
      await transaction.user.update({
        data: {
          coachId: request.coachId,
        },
        where: {
          id: request.traineeId,
        },
      })

      await transaction.coachRequest.updateMany({
        data: {
          status: CoachRequestStatus.rejected,
        },
        where: {
          coachId: {
            not: request.coachId,
          },
          traineeId: request.traineeId,
          status: {
            in: [CoachRequestStatus.pending, CoachRequestStatus.approved],
          },
        },
      })
    }

    await logAdminAudit(transaction, profile.id, {
      action: status === CoachRequestStatus.approved ? "coach_request.approved" : "coach_request.rejected",
      entityId: request.id,
      entityLabel: `${request.trainee.email} -> ${request.coach.email}`,
      entityType: "coach_request",
      metadata: {
        coachId: request.coachId,
        traineeId: request.traineeId,
      },
    })

    return request
  })

  return serializeCoachRequest(updatedRequest as CoachRequestRecord)
}

async function deleteAdminCoachRequest(profile: SerializedProfile, requestId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const existingRequest = await db.coachRequest.findUnique({
    include: {
      coach: true,
      trainee: true,
    },
    where: {
      id: requestId,
    },
  })

  if (!existingRequest) {
    throw new AuthServiceError("Không tìm thấy coach request.", 404)
  }

  if (existingRequest.status === CoachRequestStatus.approved && existingRequest.trainee.coachId === existingRequest.coachId) {
    throw new AuthServiceError("Coach request đã được duyệt và đang là kết nối hiện tại. Hãy gỡ connection trước.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.coachRequest.delete({
      where: {
        id: existingRequest.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "coach_request.deleted",
      entityId: existingRequest.id,
      entityLabel: `${existingRequest.trainee.email} -> ${existingRequest.coach.email}`,
      entityType: "coach_request",
    })
  })

  return {
    deleted: true,
    id: existingRequest.id,
  }
}

async function listAdminConnections(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const [trainees, coaches] = await Promise.all([
    db.user.findMany({
      include: {
        coach: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        role: UserRole.trainee,
      },
    }),
    db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        isActive: true,
        role: UserRole.coach,
      },
    }),
  ])

  const search = normalizeSearch(options?.search)
  const connectedTrainees = trainees.filter((trainee) => trainee.coach)

  return {
    coaches: coaches.map((coach) => serializeMiniUser(coach)),
    connections: connectedTrainees
      .filter((trainee) => matchesSearch([trainee.name, trainee.email, trainee.coach?.name, trainee.coach?.email], search))
      .map((trainee) => ({
        coach: serializeMiniUser(trainee.coach as User),
        trainee: serializeMiniUser(trainee),
      })),
    unassignedTrainees: trainees
      .filter((trainee) => !trainee.coachId && trainee.isActive)
      .map((trainee) => serializeMiniUser(trainee)),
  }
}

async function assignAdminCoachToTrainee(
  profile: SerializedProfile,
  input: {
    coachId: string
    traineeId: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const [coach, trainee] = await Promise.all([
    db.user.findUnique({
      where: {
        id: input.coachId,
      },
    }),
    db.user.findUnique({
      where: {
        id: input.traineeId,
      },
    }),
  ])

  if (!coach || coach.role !== UserRole.coach) {
    throw new AuthServiceError("Coach được chọn không hợp lệ.", 400)
  }

  if (!trainee || trainee.role !== UserRole.trainee) {
    throw new AuthServiceError("Trainee được chọn không hợp lệ.", 400)
  }

  if (!coach.isActive || !trainee.isActive) {
    throw new AuthServiceError("Chỉ có thể tạo kết nối giữa các tài khoản đang hoạt động.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      data: {
        coachId: coach.id,
      },
      where: {
        id: trainee.id,
      },
    })

    await transaction.coachRequest.upsert({
      create: {
        coachId: coach.id,
        status: CoachRequestStatus.approved,
        traineeId: trainee.id,
      },
      update: {
        status: CoachRequestStatus.approved,
      },
      where: {
        traineeId_coachId: {
          coachId: coach.id,
          traineeId: trainee.id,
        },
      },
    })

    await transaction.coachRequest.updateMany({
      data: {
        status: CoachRequestStatus.rejected,
      },
      where: {
        coachId: {
          not: coach.id,
        },
        traineeId: trainee.id,
        status: {
          in: [CoachRequestStatus.pending, CoachRequestStatus.approved],
        },
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "connection.assigned",
      entityId: trainee.id,
      entityLabel: trainee.email,
      entityType: "connection",
      metadata: {
        coachId: coach.id,
        coachName: coach.name,
        traineeId: trainee.id,
        traineeName: trainee.name,
      },
    })
  })

  return {
    coach: serializeMiniUser(coach),
    trainee: serializeMiniUser(trainee),
  }
}

async function removeAdminCoachFromTrainee(profile: SerializedProfile, traineeId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const trainee = await db.user.findUnique({
    include: {
      coach: true,
    },
    where: {
      id: traineeId,
    },
  })

  if (!trainee || trainee.role !== UserRole.trainee) {
    throw new AuthServiceError("Không tìm thấy trainee.", 404)
  }

  if (!trainee.coachId || !trainee.coach) {
    throw new AuthServiceError("Trainee này hiện chưa được gán coach.", 400)
  }

  const currentCoach = trainee.coach

  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      data: {
        coachId: null,
      },
      where: {
        id: trainee.id,
      },
    })

    await transaction.coachRequest.updateMany({
      data: {
        status: CoachRequestStatus.rejected,
      },
      where: {
        coachId: trainee.coachId as string,
        status: CoachRequestStatus.approved,
        traineeId: trainee.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "connection.removed",
      entityId: trainee.id,
      entityLabel: trainee.email,
      entityType: "connection",
      metadata: {
        coachId: trainee.coachId,
        coachName: currentCoach.name,
        traineeId: trainee.id,
        traineeName: trainee.name,
      },
    })
  })

  return {
    removed: true,
    traineeId: trainee.id,
  }
}

async function listAdminPrograms(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const programs = await db.program.findMany({
    include: {
      _count: {
        select: {
          assignments: true,
          workouts: true,
        },
      },
      createdBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const search = normalizeSearch(options?.search)

  return programs
    .filter((program) =>
      matchesSearch([program.name, program.description, program.createdBy.name, program.createdBy.email], search),
    )
    .map((program) => serializeProgramSummary(program as ProgramSummaryRecord))
}

async function deleteAdminProgram(profile: SerializedProfile, programId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const program = await db.program.findUnique({
    include: {
      createdBy: true,
    },
    where: {
      id: programId,
    },
  })

  if (!program) {
    throw new AuthServiceError("Không tìm thấy chương trình.", 404)
  }

  await db.$transaction(async (transaction) => {
    await transaction.program.delete({
      where: {
        id: program.id,
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "program.deleted",
      entityId: program.id,
      entityLabel: program.name,
      entityType: "program",
      metadata: {
        createdById: program.createdById,
        createdByName: program.createdBy.name,
      },
    })
  })

  return {
    deleted: true,
    id: program.id,
  }
}

async function listAdminExercises(profile: SerializedProfile, options?: { search?: string }) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const exercises = await db.variation.findMany({
    include: ADMIN_VARIATION_INCLUDE,
    orderBy: [{ exercise: { muscleGroup: "asc" } }, { exercise: { name: "asc" } }, { createdAt: "asc" }],
  })

  const search = normalizeSearch(options?.search)

  return exercises
    .filter((exercise) => matchesSearch([exercise.exercise.name, exercise.exercise.muscleGroup, exercise.equipment], search))
    .map((exercise) => serializeExerciseSummary(exercise as ExerciseSummaryRecord))
}

async function createAdminExercise(
  profile: SerializedProfile,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
    variationName?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const name = sanitizeText(input.name)
  const muscleGroup = sanitizeText(input.muscleGroup)
  const equipment = sanitizeText(input.equipment)
  const variationName = sanitizeText(input.variationName)

  if (!name || !muscleGroup || !variationName) {
    throw new AuthServiceError("Tên bài tập, nhóm cơ và variation không được để trống.", 400)
  }

  let exercise

  try {
    // Create the exercise + its default variation and return the variation
    // (with the relations serializeExerciseSummary needs) in a single round
    // trip — avoids a second variation.findFirst over the network.
    exercise = await db.exercise.create({
      data: {
        createdById: profile.id,
        muscleGroup,
        name,
        variations: {
          create: {
            equipment,
            isDefault: true,
            name: variationName,
            sortOrder: 0,
          },
        },
      },
      include: {
        variations: {
          include: {
            _count: {
              select: {
                workoutExercises: true,
              },
            },
            exercise: {
              include: {
                createdBy: true,
              },
            },
          },
        },
      },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthServiceError("Variation này đã tồn tại trong bài tập hiện tại.", 400)
    }
    throw error
  }

  const variation = exercise.variations[0]

  if (!variation) {
    throw new AuthServiceError("Không thể tạo bài tập.", 500)
  }

  // Fire-and-forget: audit logging already swallows its own errors and must
  // not add latency to the response the admin is waiting on.
  void logAdminAudit(db, profile.id, {
    action: "exercise.created",
    entityId: variation.id,
    entityLabel: exercise.name,
    entityType: "exercise",
  })

  return serializeExerciseSummary(variation as ExerciseSummaryRecord)
}

async function importAdminExercises(
  profile: SerializedProfile,
  rows: ExerciseImportRowInput[],
) {
  assertAdmin(profile)
  const db = ensurePrisma()

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AuthServiceError("File import không có dữ liệu bài tập hợp lệ.", 400)
  }

  if (rows.length > 1000) {
    throw new AuthServiceError("Chỉ hỗ trợ import tối đa 1000 dòng mỗi lần.", 400)
  }

  const sanitizedRows = rows.map((row, index) => ({
    exerciseName: sanitizeText(row.exerciseName),
    equipment: sanitizeText(row.equipment),
    isDefault: row.isDefault === true,
    muscleGroup: sanitizeText(row.muscleGroup),
    sortOrder:
      typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder) ? Math.max(0, Math.round(row.sortOrder)) : undefined,
    variationName: sanitizeText(row.variationName) ?? "Default",
    rowNumber: row.rowNumber ?? index + 2,
  }))

  const invalidRows = sanitizedRows.filter((row) => !row.exerciseName || !row.muscleGroup || !row.variationName)

  if (invalidRows.length > 0) {
    const invalidPreview = invalidRows
      .slice(0, 5)
      .map((row) => row.rowNumber)
      .join(", ")

    throw new AuthServiceError(
      `Có dòng thiếu exercise name, muscle group hoặc variation name. Kiểm tra lại các dòng: ${invalidPreview}${invalidRows.length > 5 ? "..." : ""}`,
      400,
    )
  }

  function buildExerciseSignature(row: { exerciseName?: string | null; muscleGroup?: string | null }) {
    return `${row.exerciseName?.trim().toLowerCase() ?? ""}::${row.muscleGroup?.trim().toLowerCase() ?? ""}`
  }

  function buildVariationSignature(row: {
    exerciseName?: string | null
    muscleGroup?: string | null
    variationName?: string | null
  }) {
    return `${buildExerciseSignature(row)}::${row.variationName?.trim().toLowerCase() ?? ""}`
  }

  // --- Phase 1: Deduplicate within the file ---
  const duplicateRowsInFile: Array<{
    exerciseName: string
    equipment?: string
    isDefault?: boolean
    muscleGroup: string
    reason: "duplicate_in_file"
    rowNumber: number
    sortOrder?: number
    variationName: string
  }> = []
  const uniqueRows: Array<{
    exerciseName: string
    equipment?: string
    isDefault: boolean
    muscleGroup: string
    rowNumber: number
    sortOrder?: number
    variationName: string
  }> = []
  const seenSignatures = new Set<string>()

  sanitizedRows.forEach((row) => {
    const signature = buildVariationSignature(row)

    if (seenSignatures.has(signature)) {
      duplicateRowsInFile.push({
        exerciseName: row.exerciseName as string,
        equipment: row.equipment,
        isDefault: row.isDefault,
        muscleGroup: row.muscleGroup as string,
        reason: "duplicate_in_file",
        rowNumber: row.rowNumber,
        sortOrder: row.sortOrder,
        variationName: row.variationName as string,
      })
      return
    }

    seenSignatures.add(signature)
    uniqueRows.push({
      exerciseName: row.exerciseName as string,
      equipment: row.equipment,
      isDefault: row.isDefault,
      muscleGroup: row.muscleGroup as string,
      rowNumber: row.rowNumber,
      sortOrder: row.sortOrder,
      variationName: row.variationName as string,
    })
  })

  // --- Phase 2: Deduplicate against existing DB records ---
  const existingVariations = await db.variation.findMany({
    include: {
      exercise: true,
    },
  })

  const existingSignatures = new Set(
    existingVariations.map((variation) =>
      buildVariationSignature({
        exerciseName: variation.exercise.name,
        muscleGroup: variation.exercise.muscleGroup,
        variationName: variation.name,
      }),
    ),
  )

  const rowsToCreate: Array<{
    createdById: string
    exerciseName: string
    equipment?: string
    isDefault: boolean
    muscleGroup: string
    rowNumber: number
    sortOrder?: number
    variationName: string
  }> = []
  const duplicateRowsExisting: Array<{
    exerciseName: string
    equipment?: string
    isDefault?: boolean
    muscleGroup: string
    reason: "already_exists"
    rowNumber: number
    sortOrder?: number
    variationName: string
  }> = []

  uniqueRows.forEach((row) => {
    const signature = buildVariationSignature(row)

    if (existingSignatures.has(signature)) {
      duplicateRowsExisting.push({
        exerciseName: row.exerciseName,
        equipment: row.equipment,
        isDefault: row.isDefault,
        muscleGroup: row.muscleGroup,
        reason: "already_exists",
        rowNumber: row.rowNumber,
        sortOrder: row.sortOrder,
        variationName: row.variationName,
      })
      return
    }

    rowsToCreate.push({
      createdById: profile.id,
      exerciseName: row.exerciseName,
      equipment: row.equipment,
      isDefault: row.isDefault,
      muscleGroup: row.muscleGroup,
      rowNumber: row.rowNumber,
      sortOrder: row.sortOrder,
      variationName: row.variationName,
    })
    existingSignatures.add(signature)
  })

  // --- Phase 3: Batch create inside a single transaction ---
  let createdCount = 0

  if (rowsToCreate.length > 0) {
    createdCount = await db.$transaction(async (tx) => {
      // 3a. Build map of existing exercises
      const allExercises = await tx.exercise.findMany({
        include: {
          variations: {
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })

      const existingExerciseMap = new Map<string, ExerciseWithVariationsRecord>()
      allExercises.forEach((exercise) => {
        const signature = buildExerciseSignature({
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
        })
        if (!existingExerciseMap.has(signature)) {
          existingExerciseMap.set(signature, exercise)
        }
      })

      // 3b. Group rows by exercise
      const rowsByExercise = rowsToCreate.reduce<Map<string, typeof rowsToCreate>>((result, row) => {
        const signature = buildExerciseSignature({
          exerciseName: row.exerciseName,
          muscleGroup: row.muscleGroup,
        })
        const group = result.get(signature) ?? []
        group.push(row)
        result.set(signature, group)
        return result
      }, new Map())

      // 3c. Create missing parent exercises
      for (const [exerciseSignature, exerciseRows] of rowsByExercise.entries()) {
        if (!existingExerciseMap.has(exerciseSignature)) {
          const created = await tx.exercise.create({
            data: {
              createdById: exerciseRows[0]?.createdById,
              muscleGroup: exerciseRows[0]?.muscleGroup ?? "",
              name: exerciseRows[0]?.exerciseName ?? "",
            },
            include: {
              variations: true,
            },
          })
          existingExerciseMap.set(exerciseSignature, created)
        }
      }

      // 3d. Create variations — batch non-default, individual for default
      let count = 0
      const bulkNonDefaultData: Array<{
        equipment: string | null
        exerciseId: string
        isDefault: boolean
        name: string
        sortOrder: number
      }> = []

      for (const [exerciseSignature, exerciseRows] of rowsByExercise.entries()) {
        const exercise = existingExerciseMap.get(exerciseSignature)!
        const explicitDefaultIndex = exerciseRows.findIndex(
          (row) => row.isDefault || row.variationName.trim().toLowerCase() === "default",
        )
        let hasExistingDefault = exercise.variations.some((v) => v.isDefault)
        const variationSignatures = new Set(
          exercise.variations.map((v) => v.name.trim().toLowerCase()),
        )

        for (const [index, row] of exerciseRows.entries()) {
          const variationSignature = row.variationName.trim().toLowerCase()

          if (variationSignatures.has(variationSignature)) {
            duplicateRowsExisting.push({
              exerciseName: row.exerciseName,
              equipment: row.equipment,
              isDefault: row.isDefault,
              muscleGroup: row.muscleGroup,
              reason: "already_exists",
              rowNumber: row.rowNumber,
              sortOrder: row.sortOrder,
              variationName: row.variationName,
            })
            continue
          }

          const shouldBeDefault =
            explicitDefaultIndex >= 0 ? index === explicitDefaultIndex : !hasExistingDefault && index === 0

          if (shouldBeDefault) {
            // Default variations need individual create + updateMany to unset old defaults
            try {
              const createdVariation = await tx.variation.create({
                data: {
                  equipment: row.equipment ?? null,
                  exerciseId: exercise.id,
                  isDefault: true,
                  name: row.variationName,
                  sortOrder: row.sortOrder ?? index,
                },
                select: { id: true },
              })

              await tx.variation.updateMany({
                data: { isDefault: false },
                where: {
                  exerciseId: exercise.id,
                  id: { not: createdVariation.id },
                },
              })

              variationSignatures.add(variationSignature)
              count += 1
              hasExistingDefault = true
            } catch (error) {
              if (isUniqueConstraintError(error)) {
                duplicateRowsExisting.push({
                  exerciseName: row.exerciseName,
                  equipment: row.equipment,
                  isDefault: row.isDefault,
                  muscleGroup: row.muscleGroup,
                  reason: "already_exists",
                  rowNumber: row.rowNumber,
                  sortOrder: row.sortOrder,
                  variationName: row.variationName,
                })
                continue
              }
              throw error
            }
          } else {
            // Non-default: accumulate for batch createMany
            bulkNonDefaultData.push({
              equipment: row.equipment ?? null,
              exerciseId: exercise.id,
              isDefault: false,
              name: row.variationName,
              sortOrder: row.sortOrder ?? index,
            })
            variationSignatures.add(variationSignature)
          }
        }
      }

      // 3e. Batch insert all non-default variations at once
      if (bulkNonDefaultData.length > 0) {
        const batchResult = await tx.variation.createMany({
          data: bulkNonDefaultData,
          skipDuplicates: true,
        })
        count += batchResult.count
      }

      return count
    }, {
      timeout: 120_000, // 2 minute timeout for the transaction
    })
  }

  await logAdminAudit(db, profile.id, {
    action: "exercise.imported",
    entityLabel: `Imported ${createdCount} exercises`,
    entityType: "exercise",
    metadata: {
      createdCount,
      duplicateInFileCount: duplicateRowsInFile.length,
      existingDuplicateCount: duplicateRowsExisting.length,
      totalRows: rows.length,
    },
  })

  return {
    createdCount,
    skippedCount: duplicateRowsInFile.length + duplicateRowsExisting.length,
    skippedRows: [...duplicateRowsInFile, ...duplicateRowsExisting].slice(0, 20),
    totalRows: rows.length,
  }
}

async function updateAdminExercise(
  profile: SerializedProfile,
  exerciseId: string,
  input: {
    equipment?: string
    muscleGroup: string
    name: string
    variationName?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const name = sanitizeText(input.name)
  const muscleGroup = sanitizeText(input.muscleGroup)
  const equipment = sanitizeText(input.equipment)
  const variationName = sanitizeText(input.variationName)

  if (!name || !muscleGroup || !variationName) {
    throw new AuthServiceError("Tên bài tập, nhóm cơ và variation không được để trống.", 400)
  }

  const existingExercise = await db.variation.findUnique({
    include: ADMIN_VARIATION_INCLUDE,
    where: {
      id: exerciseId,
    },
  })

  if (!existingExercise) {
    throw new AuthServiceError("Không tìm thấy bài tập.", 404)
  }

  let exercise

  try {
    exercise = await db.$transaction(async (transaction) => {
      await transaction.exercise.update({
        data: {
          muscleGroup,
          name,
        },
        where: {
          id: existingExercise.exerciseId,
        },
      })

      return transaction.variation.update({
        data: {
          equipment,
          name: variationName,
        },
        include: ADMIN_VARIATION_INCLUDE,
        where: {
          id: existingExercise.id,
        },
      })
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthServiceError("Variation này đã tồn tại trong bài tập hiện tại.", 400)
    }
    throw error
  }

  await logAdminAudit(db, profile.id, {
    action: "exercise.updated",
    entityId: exercise.id,
    entityLabel: exercise.exercise.name,
    entityType: "exercise",
    metadata: {
      previousEquipment: existingExercise.equipment,
      previousMuscleGroup: existingExercise.exercise.muscleGroup,
      previousName: existingExercise.exercise.name,
      previousVariationName: existingExercise.name,
    },
  })

  return serializeExerciseSummary(exercise as ExerciseSummaryRecord)
}

async function deleteAdminExercise(profile: SerializedProfile, exerciseId: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const exercise = await db.variation.findUnique({
    include: ADMIN_VARIATION_INCLUDE,
    where: {
      id: exerciseId,
    },
  })

  if (!exercise) {
    throw new AuthServiceError("Không tìm thấy bài tập.", 404)
  }

  if (exercise._count.workoutExercises > 0) {
    throw new AuthServiceError("Bài tập này đang được sử dụng trong workout, chưa thể xoá.", 400)
  }

  await db.$transaction(async (transaction) => {
    await transaction.variation.delete({
      where: {
        id: exercise.id,
      },
    })

    await transaction.exercise.deleteMany({
      where: {
        id: exercise.exerciseId,
        variations: {
          none: {},
        },
      },
    })

    await logAdminAudit(transaction, profile.id, {
      action: "exercise.deleted",
      entityId: exercise.id,
      entityLabel: exercise.exercise.name,
      entityType: "exercise",
    })
  })

  return {
    deleted: true,
    id: exercise.id,
  }
}

async function deleteAdminExerciseGroup(profile: SerializedProfile, muscleGroupInput: string) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const muscleGroup = sanitizeText(muscleGroupInput)

  if (!muscleGroup) {
    throw new AuthServiceError("Nhóm cơ không được để trống.", 400)
  }

  const exercises = await db.variation.findMany({
    include: ADMIN_VARIATION_INCLUDE,
    orderBy: [{ exercise: { name: "asc" } }, { createdAt: "asc" }],
    where: {
      exercise: {
        muscleGroup: {
          equals: muscleGroup,
          mode: "insensitive",
        },
      },
    },
  })

  if (!exercises.length) {
    throw new AuthServiceError("Không tìm thấy nhóm bài tập.", 404)
  }

  const deletableExercises = exercises.filter((exercise) => exercise._count.workoutExercises === 0)
  const skippedExercises = exercises
    .filter((exercise) => exercise._count.workoutExercises > 0)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.exercise.name,
      usageCount: exercise._count.workoutExercises,
    }))
  const deletedIds = deletableExercises.map((exercise) => exercise.id)
  const deletedExerciseIds = Array.from(new Set(deletableExercises.map((exercise) => exercise.exerciseId)))

  await db.$transaction(async (transaction) => {
    if (deletedIds.length > 0) {
      await transaction.variation.deleteMany({
        where: {
          id: {
            in: deletedIds,
          },
        },
      })

      await transaction.exercise.deleteMany({
        where: {
          id: {
            in: deletedExerciseIds,
          },
          variations: {
            none: {},
          },
        },
      })
    }

    await logAdminAudit(transaction, profile.id, {
      action: "exercise.group_deleted",
      entityLabel: muscleGroup,
      entityType: "exercise",
      metadata: {
        deletedCount: deletedIds.length,
        deletedIds,
        skippedCount: skippedExercises.length,
        skippedExercises: skippedExercises.slice(0, 20),
        totalCount: exercises.length,
      },
    })
  })

  return {
    deletedCount: deletedIds.length,
    deletedIds,
    muscleGroup,
    skippedCount: skippedExercises.length,
    skippedExercises,
  }
}

async function listAdminAuditLogs(
  profile: SerializedProfile,
  options?: {
    entityType?: string
    search?: string
  },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const logs = await db.adminAuditLog.findMany({
    include: {
      admin: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    where: options?.entityType && options.entityType !== "all" ? { entityType: options.entityType } : undefined,
  })

  const search = normalizeSearch(options?.search)

  return logs
    .filter((log) =>
      matchesSearch([log.action, log.entityType, log.entityLabel, log.admin.name, log.admin.email], search),
    )
    .map((log) => serializeAuditLog(log as AuditLogRecord))
}

export {
  assignAdminCoachToTrainee,
  createAdminExercise,
  importAdminExercises,
  deleteAdminCoachRequest,
  deleteAdminExercise,
  deleteAdminExerciseGroup,
  deleteAdminProgram,
  getAdminDashboard,
  getAdminUserDetail,
  listAdminAuditLogs,
  listAdminCoachRequests,
  listAdminConnections,
  listAdminExercises,
  listAdminPrograms,
  listAdminUsers,
  removeAdminCoachFromTrainee,
  resetAdminUserPassword,
  updateAdminCoachRequest,
  updateAdminExercise,
  updateAdminUser,
}
