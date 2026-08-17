import { Prisma } from "@prisma/client"

import type { SnapshotMuscleProfile } from "../domain/workout-muscle-snapshot"
import { enrichExerciseSnapshot } from "../domain/workout-muscle-snapshot"
import { serializeMuscleProfile } from "../domain/muscle-profile"
import { prisma } from "../lib/prisma"

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`)
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const apply = hasFlag("apply")
  if (apply === hasFlag("dry-run")) throw new Error("Choose exactly one of --dry-run or --apply.")

  const pendingProfiles = await prisma.variation.count({ where: { muscleProfileStatus: "pending" } })
  if (pendingProfiles > 0 && !hasFlag("allow-pending")) {
    throw new Error(`Refusing snapshot backfill while ${pendingProfiles} muscle profiles are pending. Review the catalog first.`)
  }

  const [variations, logs] = await Promise.all([
    prisma.variation.findMany({ include: { muscleTargets: true } }),
    prisma.workoutLog.findMany({ orderBy: { id: "asc" }, select: { exerciseSnapshot: true, id: true } }),
  ])
  const profiles = new Map<string, SnapshotMuscleProfile>(
    variations.map((variation) => {
      const profile = serializeMuscleProfile(variation)
      return [variation.id, {
        activityType: profile.activityType,
        primaryMuscles: profile.primaryMuscles,
        secondaryMuscles: profile.secondaryMuscles,
      }]
    }),
  )
  const updates = logs.flatMap((log) => {
    const result = enrichExerciseSnapshot(log.exerciseSnapshot, profiles)
    return result.changed ? [{ id: log.id, snapshot: result.snapshot }] : []
  })

  if (apply) {
    for (let offset = 0; offset < updates.length; offset += 100) {
      const batch = updates.slice(offset, offset + 100)
      await prisma.$transaction(batch.map((update) => prisma!.workoutLog.update({
        data: { exerciseSnapshot: update.snapshot as Prisma.InputJsonValue },
        where: { id: update.id },
      })))
    }
  }

  process.stdout.write(`${JSON.stringify({ changedLogs: updates.length, mode: apply ? "apply" : "dry-run", totalLogs: logs.length })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
}).finally(async () => prisma?.$disconnect())
