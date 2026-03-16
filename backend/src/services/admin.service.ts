import { CoachRequestStatus, UserRole } from "@prisma/client"

import { type SerializedProfile, AuthServiceError } from "./auth.service"
import { prisma } from "../lib/prisma"

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

async function getAdminDashboard(profile: SerializedProfile) {
  assertAdmin(profile)
  const db = ensurePrisma()

  const [
    totalUsers,
    totalTrainees,
    totalCoaches,
    totalAdmins,
    totalPrograms,
    totalMeals,
    totalWorkoutLogs,
    pendingCoachRequests,
    recentUsers,
    pendingRequests,
    recentPrograms,
    coaches,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: {
        role: UserRole.trainee,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.coach,
      },
    }),
    db.user.count({
      where: {
        role: UserRole.admin,
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
        _count: {
          select: {
            programAssignments: true,
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
    db.coachRequest.findMany({
      include: {
        coach: true,
        trainee: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      where: {
        status: CoachRequestStatus.pending,
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
      take: 6,
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
  ])

  return {
    pendingCoachRequests: pendingRequests.map((request) => ({
      coach: {
        email: request.coach.email,
        id: request.coach.id,
        name: request.coach.name,
      },
      createdAt: request.createdAt,
      id: request.id,
      status: request.status,
      trainee: {
        email: request.trainee.email,
        id: request.trainee.id,
        name: request.trainee.name,
      },
    })),
    recentPrograms: recentPrograms.map((program) => ({
      assignmentCount: program._count.assignments,
      createdAt: program.createdAt,
      createdBy: {
        email: program.createdBy.email,
        id: program.createdBy.id,
        name: program.createdBy.name,
      },
      difficulty: program.difficulty,
      duration: program.duration,
      id: program.id,
      name: program.name,
      workoutsPerWeek: program.workoutsPerWeek,
    })),
    recentUsers: recentUsers.map((user) => ({
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      name: user.name,
      programCount: user._count.programAssignments,
      role: user.role,
      traineeCount: user._count.trainees,
      workoutLogCount: user._count.workoutLogs,
    })),
    stats: {
      pendingCoachRequests,
      totalAdmins,
      totalCoaches,
      totalMeals,
      totalPrograms,
      totalTrainees,
      totalUsers,
      totalWorkoutLogs,
    },
    topCoaches: coaches
      .map((coach) => ({
        email: coach.email,
        id: coach.id,
        name: coach.name,
        programCount: coach._count.programsCreated,
        traineeCount: coach._count.trainees,
      }))
      .sort((left, right) => {
        if (right.traineeCount !== left.traineeCount) {
          return right.traineeCount - left.traineeCount
        }

        return right.programCount - left.programCount
      })
      .slice(0, 5),
  }
}

export { getAdminDashboard }
