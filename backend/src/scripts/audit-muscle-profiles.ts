import { ExerciseActivityType, MuscleProfileStatus, MuscleTargetRole } from "@prisma/client"

import { prisma } from "../lib/prisma"

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const [
    variations,
    profiled,
    pending,
    approvedStrengthMissingPrimary,
    gluteal,
    tibialis,
    fallbackUsage,
  ] = await Promise.all([
    prisma.variation.count(),
    prisma.variation.count({ where: { activityType: { not: null }, muscleProfileSource: { not: null } } }),
    prisma.variation.count({ where: { muscleProfileStatus: MuscleProfileStatus.pending } }),
    prisma.variation.count({ where: {
      activityType: ExerciseActivityType.strength,
      muscleProfileStatus: MuscleProfileStatus.approved,
      muscleTargets: { none: { role: MuscleTargetRole.primary } },
    } }),
    prisma.variationMuscleTarget.count({ where: { muscleSlug: "gluteal" } }),
    prisma.variationMuscleTarget.count({ where: { muscleSlug: "tibialis" } }),
    prisma.variation.count({ where: { OR: [{ activityType: null }, { muscleProfileStatus: MuscleProfileStatus.pending }] } }),
  ])
  const result = {
    approvedStrengthMissingPrimary,
    fallbackUsage,
    glutealTargets: gluteal,
    pending,
    profiled,
    tibialisTargets: tibialis,
    variations,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (process.argv.includes("--strict") && (profiled !== variations || pending || approvedStrengthMissingPrimary || !gluteal || !tibialis)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
}).finally(async () => prisma?.$disconnect())
