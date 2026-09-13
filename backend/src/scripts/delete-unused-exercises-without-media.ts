import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import { Prisma, PrismaClient } from "@prisma/client"

import { readExternalSourceMetadata } from "../lib/exercise-media"

const REPORT_DIRECTORY = resolve(__dirname, "../../../.exercise-sync-reports")

type CliOptions = {
  apply: boolean
  reportPath: string
}

type ExerciseRecord = Prisma.ExerciseGetPayload<{
  include: {
    variations: {
      include: {
        _count: {
          select: {
            workoutExercises: true
          }
        }
      }
    }
  }
}>

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function parseArgs(args = process.argv.slice(2)): CliOptions {
  const options = {
    apply: false,
    reportPath: join(REPORT_DIRECTORY, `delete-unused-exercises-without-media-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--report") options.reportPath = resolve(takeValue(args, index++, arg))
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function hasAnimationMedia(metadata: Prisma.JsonValue | null) {
  const root = asRecord(metadata)
  const externalMedia = asRecord(readExternalSourceMetadata(root)?.media)
  if (typeof externalMedia?.animationUrl === "string" && externalMedia.animationUrl.trim()) return true
  if (typeof externalMedia?.animationObjectPath === "string" && externalMedia.animationObjectPath.trim()) return true

  const datasetMedia = asRecord(asRecord(root?.exerciseDataset)?.media)
  if (typeof datasetMedia?.animationObjectPath === "string" && datasetMedia.animationObjectPath.trim()) return true
  if (typeof datasetMedia?.animationUrl === "string" && datasetMedia.animationUrl.trim()) return true

  return false
}

function serializeExercise(exercise: ExerciseRecord, originalUsageCountByVariationId: Map<string, number>) {
  const variations = exercise.variations.map((variation) => ({
    hasAnimationMedia: hasAnimationMedia(variation.metadata),
    id: variation.id,
    name: variation.name,
    originalUsageCount: originalUsageCountByVariationId.get(variation.id) ?? 0,
    workoutUsageCount: variation._count.workoutExercises,
  }))
  return {
    createdById: exercise.createdById,
    exerciseId: exercise.id,
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    variations,
  }
}

async function buildOriginalUsageCounts(prisma: PrismaClient, variationIds: string[]) {
  const usageCountByVariationId = new Map<string, number>()
  const batchSize = 1000

  for (let index = 0; index < variationIds.length; index += batchSize) {
    const batch = variationIds.slice(index, index + batchSize)
    const rows = await prisma.workoutExercise.groupBy({
      by: ["originalVariationId"],
      _count: { _all: true },
      where: {
        originalVariationId: {
          in: batch,
        },
      },
    })

    for (const row of rows) {
      if (row.originalVariationId) usageCountByVariationId.set(row.originalVariationId, row._count._all)
    }
  }

  return usageCountByVariationId
}

async function main() {
  const options = parseArgs()
  const prisma = new PrismaClient()

  try {
    const exercises = await prisma.exercise.findMany({
      include: {
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
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
    })
    const variationIds = exercises.flatMap((exercise) => exercise.variations.map((variation) => variation.id))
    const originalUsageCountByVariationId = await buildOriginalUsageCounts(prisma, variationIds)

    const deletableExercises = exercises.filter((exercise) => {
      const hasAnyAnimationMedia = exercise.variations.some((variation) => hasAnimationMedia(variation.metadata))
      const hasAnyWorkoutUsage = exercise.variations.some((variation) => variation._count.workoutExercises > 0)
      const hasAnyOriginalUsage = exercise.variations.some((variation) =>
        (originalUsageCountByVariationId.get(variation.id) ?? 0) > 0,
      )
      return !hasAnyAnimationMedia && !hasAnyWorkoutUsage && !hasAnyOriginalUsage
    })

    const deleteVariationIds = deletableExercises.flatMap((exercise) => exercise.variations.map((variation) => variation.id))
    const deleteExerciseIds = deletableExercises.map((exercise) => exercise.id)

    let deletedVariations = 0
    let deletedExercises = 0

    if (options.apply && deleteExerciseIds.length > 0) {
      const result = await prisma.$transaction(async (tx) => {
        const variationResult = deleteVariationIds.length > 0
          ? await tx.variation.deleteMany({ where: { id: { in: deleteVariationIds } } })
          : { count: 0 }
        const exerciseResult = await tx.exercise.deleteMany({
          where: {
            id: {
              in: deleteExerciseIds,
            },
            variations: {
              none: {},
            },
          },
        })
        return {
          deletedExercises: exerciseResult.count,
          deletedVariations: variationResult.count,
        }
      }, { maxWait: 30_000, timeout: 180_000 })
      deletedExercises = result.deletedExercises
      deletedVariations = result.deletedVariations
    }

    const report = {
      applied: options.apply,
      deletedExercises,
      deletedVariations,
      generatedAt: new Date().toISOString(),
      metrics: {
        candidateExercises: deleteExerciseIds.length,
        candidateVariations: deleteVariationIds.length,
        totalExercises: exercises.length,
        totalVariations: variationIds.length,
      },
      candidates: deletableExercises.map((exercise) => serializeExercise(exercise, originalUsageCountByVariationId)),
    }

    await mkdir(dirname(options.reportPath), { recursive: true })
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    console.log(JSON.stringify({
      applied: options.apply,
      deletedExercises,
      deletedVariations,
      reportPath: options.reportPath,
      ...report.metrics,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
