import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { prisma } from "../lib/prisma"

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const legacyOnly = process.argv.includes("--legacy-only")
  const outputDirectory = path.resolve(process.cwd(), process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) || "../.backups")
  await mkdir(outputDirectory, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const variationsQuery = legacyOnly
    ? prisma.variation.findMany({ select: {
        createdAt: true,
        equipment: true,
        exerciseId: true,
        id: true,
        isDefault: true,
        metadata: true,
        name: true,
        sortOrder: true,
        updatedAt: true,
      } })
    : prisma.variation.findMany()
  const [exercises, variations, workoutLogs] = await Promise.all([
    prisma.exercise.findMany(),
    variationsQuery,
    prisma.workoutLog.findMany(),
  ])
  const [muscleRegions, variationMuscleTargets] = legacyOnly
    ? [[], []]
    : await Promise.all([prisma.muscleRegion.findMany(), prisma.variationMuscleTarget.findMany()])
  const target = path.join(outputDirectory, `muscle-profile-rollout-${timestamp}.json`)
  await writeFile(target, JSON.stringify({ exportedAt: new Date().toISOString(), exercises, muscleRegions, variationMuscleTargets, variations, workoutLogs }, null, 2), "utf8")
  process.stdout.write(`${JSON.stringify({ counts: { exercises: exercises.length, muscleRegions: muscleRegions.length, variationMuscleTargets: variationMuscleTargets.length, variations: variations.length, workoutLogs: workoutLogs.length }, target })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
}).finally(async () => prisma?.$disconnect())
