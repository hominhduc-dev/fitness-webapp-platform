import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, extname, join, resolve } from "node:path"

import { Prisma, PrismaClient } from "@prisma/client"

import { env } from "../config/env"
import { EXERCISE_MEDIA_BUCKET, publicObjectUrl, readExternalSourceMetadata } from "../lib/exercise-media"
import { EXERCISE_MEDIA_UPLOAD_CONCURRENCY, uploadWithRetry } from "../lib/exercise-media-upload"
import { supabaseAdmin } from "../lib/supabase"

const REPORT_DIRECTORY = resolve(__dirname, "../../../.exercise-sync-reports")
const DEFAULT_TARGET_ROOT = "library"

type CliOptions = {
  apply: boolean
  deleteOldObjects: boolean
  reportPath: string
  targetRoot: string
}

type MediaPathChange = {
  field: "thumbnailObjectPath" | "animationObjectPath"
  nextPath: string
  previousPath: string
  source: "exerciseDataset" | "externalSource"
}

type PlannedVariationUpdate = {
  exerciseName: string
  metadata: Prisma.InputJsonValue
  variationId: string
  variationName: string
  changes: MediaPathChange[]
}

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function parseArgs(args = process.argv.slice(2)): CliOptions {
  const options = {
    apply: false,
    deleteOldObjects: true,
    reportPath: join(REPORT_DIRECTORY, `merge-exercise-media-storage-folders-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
    targetRoot: DEFAULT_TARGET_ROOT,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--keep-old-objects") options.deleteOldObjects = false
    else if (arg === "--target-root") options.targetRoot = takeValue(args, index++, arg).replace(/^\/+|\/+$/g, "")
    else if (arg === "--report") options.reportPath = resolve(takeValue(args, index++, arg))
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(options.targetRoot)) {
    throw new Error("--target-root must be a simple folder name.")
  }

  return options
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function cloneJsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value)) as Record<string, unknown>
    : {}
}

function isMediaObjectPath(value: unknown, directory: "images" | "videos"): value is string {
  if (typeof value !== "string" || value.includes("..") || value.startsWith("/")) return false
  const segments = value.split("/")
  return segments.length === 3 && segments[1] === directory && segments[2].length > 0
}

function contentTypeForObjectPath(objectPath: string) {
  const extension = extname(objectPath).toLowerCase()
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  if (extension === ".gif") return "image/gif"
  if (extension === ".mp4") return "video/mp4"
  return "application/octet-stream"
}

function targetObjectPath(targetRoot: string, variationId: string, directory: "images" | "videos", previousPath: string) {
  const extension = extname(previousPath).toLowerCase() || (directory === "images" ? ".jpg" : ".mp4")
  return `${targetRoot}/${directory}/${variationId}${extension}`
}

function replaceMediaPath(params: {
  changes: MediaPathChange[]
  field: "thumbnailObjectPath" | "animationObjectPath"
  media: Record<string, unknown>
  nextPath: string
  previousPath: string
  source: "exerciseDataset" | "externalSource"
}) {
  if (params.previousPath === params.nextPath) return
  params.media[params.field] = params.nextPath
  params.changes.push({
    field: params.field,
    nextPath: params.nextPath,
    previousPath: params.previousPath,
    source: params.source,
  })
}

function planMetadataUpdate(params: {
  exerciseName: string
  metadata: Prisma.JsonValue | null
  targetRoot: string
  variationId: string
  variationName: string
}) {
  const metadata = cloneJsonObject(params.metadata)
  const changes: MediaPathChange[] = []

  const datasetMedia = asRecord(asRecord(metadata.exerciseDataset)?.media)
  if (datasetMedia) {
    const thumbnailObjectPath = datasetMedia.thumbnailObjectPath
    const animationObjectPath = datasetMedia.animationObjectPath
    if (isMediaObjectPath(thumbnailObjectPath, "images")) {
      replaceMediaPath({
        changes,
        field: "thumbnailObjectPath",
        media: datasetMedia,
        nextPath: targetObjectPath(params.targetRoot, params.variationId, "images", thumbnailObjectPath),
        previousPath: thumbnailObjectPath,
        source: "exerciseDataset",
      })
    }
    if (isMediaObjectPath(animationObjectPath, "videos")) {
      replaceMediaPath({
        changes,
        field: "animationObjectPath",
        media: datasetMedia,
        nextPath: targetObjectPath(params.targetRoot, params.variationId, "videos", animationObjectPath),
        previousPath: animationObjectPath,
        source: "exerciseDataset",
      })
    }
  }

  const externalMedia = asRecord(readExternalSourceMetadata(metadata)?.media)
  if (externalMedia) {
    const thumbnailObjectPath = externalMedia.thumbnailObjectPath
    const animationObjectPath = externalMedia.animationObjectPath
    if (isMediaObjectPath(thumbnailObjectPath, "images")) {
      const nextPath = targetObjectPath(params.targetRoot, params.variationId, "images", thumbnailObjectPath)
      replaceMediaPath({
        changes,
        field: "thumbnailObjectPath",
        media: externalMedia,
        nextPath,
        previousPath: thumbnailObjectPath,
        source: "externalSource",
      })
      if (env.supabaseUrl) externalMedia.thumbnailUrl = publicObjectUrl(env.supabaseUrl, nextPath)
    }
    if (isMediaObjectPath(animationObjectPath, "videos")) {
      const nextPath = targetObjectPath(params.targetRoot, params.variationId, "videos", animationObjectPath)
      replaceMediaPath({
        changes,
        field: "animationObjectPath",
        media: externalMedia,
        nextPath,
        previousPath: animationObjectPath,
        source: "externalSource",
      })
      if (env.supabaseUrl) externalMedia.animationUrl = publicObjectUrl(env.supabaseUrl, nextPath)
    }
  }

  if (changes.length === 0) return undefined
  return {
    changes,
    exerciseName: params.exerciseName,
    metadata: metadata as Prisma.InputJsonValue,
    variationId: params.variationId,
    variationName: params.variationName,
  } satisfies PlannedVariationUpdate
}

function assertNoDuplicateTargets(updates: PlannedVariationUpdate[]) {
  const ownerByTarget = new Map<string, string>()
  for (const update of updates) {
    for (const change of update.changes) {
      const owner = ownerByTarget.get(change.nextPath)
      if (owner && owner !== update.variationId) {
        throw new Error(`Target collision: ${change.nextPath} for ${owner} and ${update.variationId}`)
      }
      ownerByTarget.set(change.nextPath, update.variationId)
    }
  }
}

async function copyStorageObjects(updates: PlannedVariationUpdate[]) {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  const bucket = supabaseAdmin.storage.from(EXERCISE_MEDIA_BUCKET)
  const uniqueChanges = new Map<string, MediaPathChange>()
  for (const update of updates) {
    for (const change of update.changes) {
      uniqueChanges.set(`${change.previousPath}=>${change.nextPath}`, change)
    }
  }

  const changes = [...uniqueChanges.values()]
  let copied = 0
  let cursor = 0
  let skipped = 0

  async function worker() {
    while (cursor < changes.length) {
      const change = changes[cursor++]
      const downloaded = await bucket.download(change.previousPath)
      if (downloaded.error) throw downloaded.error
      const buffer = Buffer.from(await downloaded.data.arrayBuffer())
      const result = await uploadWithRetry(() => bucket.upload(change.nextPath, buffer, {
        cacheControl: "31536000",
        contentType: contentTypeForObjectPath(change.nextPath),
        upsert: false,
      }))
      if (result === "uploaded") copied += 1
      else skipped += 1

      const processed = copied + skipped
      if (processed % 100 === 0 || processed === changes.length) {
        console.error(`[exercise-media-merge] ${processed}/${changes.length} copied=${copied} skipped=${skipped}`)
      }
    }
  }

  await Promise.all(Array.from({
    length: Math.min(EXERCISE_MEDIA_UPLOAD_CONCURRENCY, changes.length || 1),
  }, () => worker()))

  return { copied, skipped, total: changes.length }
}

async function removeOldObjects(updates: PlannedVariationUpdate[]) {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  const oldPaths = [...new Set(updates.flatMap((update) => update.changes.map((change) => change.previousPath)))]
    .filter((path) => !path.startsWith(`${DEFAULT_TARGET_ROOT}/`))
  if (oldPaths.length === 0) return { removed: 0 }

  const { data, error } = await supabaseAdmin.storage.from(EXERCISE_MEDIA_BUCKET).remove(oldPaths)
  if (error) throw error
  return { removed: data?.length ?? oldPaths.length }
}

async function listNames(prefix: string) {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  const { data, error } = await supabaseAdmin.storage.from(EXERCISE_MEDIA_BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  return data.map((item) => item.name)
}

async function main() {
  const options = parseArgs()
  const prisma = new PrismaClient()

  try {
    const variations = await prisma.variation.findMany({
      include: {
        exercise: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ exercise: { name: "asc" } }, { name: "asc" }],
    })

    const updates = variations.flatMap((variation) => {
      const update = planMetadataUpdate({
        exerciseName: variation.exercise.name,
        metadata: variation.metadata,
        targetRoot: options.targetRoot,
        variationId: variation.id,
        variationName: variation.name,
      })
      return update ? [update] : []
    })
    assertNoDuplicateTargets(updates)

    const storage = options.apply ? await copyStorageObjects(updates) : { copied: 0, skipped: 0, total: updates.flatMap((update) => update.changes).length }

    let updatedVariations = 0
    let cleanup = { removed: 0 }
    if (options.apply && updates.length > 0) {
      const batchSize = 100
      for (let index = 0; index < updates.length; index += batchSize) {
        const batch = updates.slice(index, index + batchSize)
        const results = await prisma.$transaction(
          batch.map((update) =>
            prisma.variation.update({
              data: {
                metadata: update.metadata,
              },
              where: {
                id: update.variationId,
              },
            }),
          ),
        )
        updatedVariations += results.length
        console.error(`[exercise-media-merge] metadata ${updatedVariations}/${updates.length}`)
      }

      if (options.deleteOldObjects) cleanup = await removeOldObjects(updates)
    }

    const report = {
      applied: options.apply,
      cleanup,
      generatedAt: new Date().toISOString(),
      metrics: {
        plannedObjectMoves: updates.flatMap((update) => update.changes).length,
        plannedVariationUpdates: updates.length,
        updatedVariations,
      },
      storage,
      targetRoot: options.targetRoot,
      updates,
      verification: options.apply
        ? {
            targetImages: (await listNames(`${options.targetRoot}/images`)).length,
            targetVideos: (await listNames(`${options.targetRoot}/videos`)).length,
          }
        : undefined,
    }

    await mkdir(dirname(options.reportPath), { recursive: true })
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    console.log(JSON.stringify({
      applied: options.apply,
      cleanup,
      reportPath: options.reportPath,
      storage,
      targetRoot: options.targetRoot,
      ...report.metrics,
      verification: report.verification,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
