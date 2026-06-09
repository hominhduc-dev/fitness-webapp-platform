/**
 * One-off query profiler.
 *
 * Calls the heaviest read services directly (bypassing auth) against real data
 * and prints wall-clock time per call. Run with the slow-query log enabled to
 * also see per-statement DB execution time:
 *
 *   PRISMA_SLOW_QUERY_MS=1 npx tsx src/scripts/profile-queries.ts   (bash)
 *   $env:PRISMA_SLOW_QUERY_MS="1"; npx tsx src/scripts/profile-queries.ts   (PowerShell)
 *
 * The script makes no writes — safe to run against any environment.
 */
import { UserRole, type User } from "@prisma/client"

import { prisma } from "../lib/prisma"
import {
  getCoachDashboard,
  getCoachTraineeDetail,
  getDashboardForTrainee,
  listCoachTrainees,
  listExerciseLibrary,
} from "../services/fitness-data"

type SerializedProfile = {
  avatar: string | null
  coachId: string | null
  createdAt: Date
  dailyCalorieGoal: number
  dailyCarbsGoal: number
  dailyFatGoal: number
  dailyProteinGoal: number
  email: string
  fitnessGoals: string[]
  heightCm: number | null
  id: string
  isActive: boolean
  name: string
  phone: string | null
  preferredWeightUnit: User["preferredWeightUnit"]
  role: UserRole
  supabaseAuthUserId: string | null
  targetWeightKg: number | null
  updatedAt: Date
  username: string | null
}

function toProfile(user: User): SerializedProfile {
  return {
    avatar: user.avatar,
    coachId: user.coachId,
    createdAt: user.createdAt,
    dailyCalorieGoal: user.dailyCalorieGoal,
    dailyCarbsGoal: user.dailyCarbsGoal,
    dailyFatGoal: user.dailyFatGoal,
    dailyProteinGoal: user.dailyProteinGoal,
    email: user.email,
    fitnessGoals: user.fitnessGoals,
    heightCm: user.heightCm,
    id: user.id,
    isActive: user.isActive,
    name: user.name,
    phone: user.phone,
    preferredWeightUnit: user.preferredWeightUnit,
    role: user.role,
    supabaseAuthUserId: user.supabaseAuthUserId,
    targetWeightKg: user.targetWeightKg,
    updatedAt: user.updatedAt,
    username: user.username,
  }
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const ms = performance.now() - start
    const size = Array.isArray(result) ? ` (${result.length} rows)` : ""
    console.log(`\n⏱  ${label}: ${ms.toFixed(0)}ms${size}`)
    return result
  } catch (error) {
    const ms = performance.now() - start
    console.log(`\n❌ ${label}: ${ms.toFixed(0)}ms — ${(error as Error).message}`)
    throw error
  }
}

async function main() {
  if (!prisma) {
    throw new Error("DATABASE_URL not configured — cannot profile.")
  }

  // Pick the coach that has the most trainees so the heavy aggregations have data.
  const coaches = await prisma.user.findMany({
    include: { _count: { select: { trainees: true } } },
    where: { role: UserRole.coach },
  })
  const coach = coaches.sort((a, b) => b._count.trainees - a._count.trainees)[0]

  if (!coach) {
    console.log("No coach found in DB — skipping coach profiling.")
  } else {
    console.log(`Coach: ${coach.name} (${coach._count.trainees} trainees)`)
    const coachProfile = toProfile(coach)

    await time("listExerciseLibrary(coach)", () => listExerciseLibrary(coachProfile))
    await time("getCoachDashboard(coach)", () => getCoachDashboard(coachProfile))
    const trainees = await time("listCoachTrainees(coach)", () => listCoachTrainees(coachProfile))

    const firstTraineeId = trainees[0]?.id
    if (firstTraineeId) {
      await time("getCoachTraineeDetail(coach, trainee)", () =>
        getCoachTraineeDetail(coachProfile, firstTraineeId),
      )
    }
  }

  // Profile a trainee dashboard too — the schedule builder is heavy.
  const trainee = await prisma.user.findFirst({
    orderBy: { createdAt: "desc" },
    where: { role: UserRole.trainee },
  })
  if (trainee) {
    console.log(`\nTrainee: ${trainee.name}`)
    await time("getDashboardForTrainee(trainee)", () => getDashboardForTrainee(toProfile(trainee)))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma?.$disconnect()
  })
