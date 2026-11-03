import type { PrismaClient } from "@prisma/client"

import { env } from "../config/env"
import { hasPreviousMetadata, METADATA_WRITING_ACTIONS, undoableTransfers } from "../domain/metadata-transfer-undo"
import { EXERCISE_MEDIA_BUCKET } from "./exercise-media"
import { cloudinarySignature, removeStorageObjects } from "./exercise-media-upload"
import { logger } from "./logger"

type MediaDb = Pick<PrismaClient, "variation" | "adminAuditLog">
type Asset = { provider: "storage"; path: string } | { provider: "cloudinary"; publicId: string; resourceType: "image" | "video" }

let mutationTail: Promise<unknown> = Promise.resolve()

/** Serialize metadata copies and cleanup in this backend process, including their initial reads. */
export function serializeExerciseMediaMutation<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
  return (...args: Args): Promise<Result> => {
    const result = mutationTail.then(() => operation(...args))
    mutationTail = result.catch(() => undefined)
    return result
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function safePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("..")
}

function strings(value: unknown): string[] {
  if (typeof value === "string") {
    try { return [value, decodeURIComponent(value)] } catch { return [value] }
  }
  if (Array.isArray(value)) return value.flatMap(strings)
  return Object.values(record(value)).flatMap(strings)
}

/** Only explicit identities in our exercise bucket / configured Cloudinary account are deletable. */
export function exerciseMediaAssets(metadata: unknown): Asset[] {
  const root = record(metadata)
  const assets: Asset[] = []
  for (const key of ["media", "storage", "cdn"]) {
    const block = record(root[key])
    if ((block.bucket ?? EXERCISE_MEDIA_BUCKET) === EXERCISE_MEDIA_BUCKET) {
      for (const field of ["animationPath", "thumbnailPath"]) {
        if (safePath(block[field])) assets.push({ provider: "storage", path: block[field] })
      }
    }
    if (key === "storage" || !env.cloudinaryCloudName || (block.deliveryType ?? "upload") !== "upload") continue
    if (key === "media" && [block.animationCloudName, block.thumbnailCloudName].some((cloud) => typeof cloud === "string" && cloud !== env.cloudinaryCloudName)) continue
    for (const slot of ["animation", "thumbnail"]) {
      const publicId = block[`${slot}PublicId`]
      const cloud: unknown = block[`${slot}CloudName`] ?? env.cloudinaryCloudName
      const resourceType = block[`${slot}ResourceType`] ?? (slot === "thumbnail" ? "image" : key === "cdn" || block.animationType === "video" ? "video" : "image")
      if (cloud === env.cloudinaryCloudName && safePath(publicId) && (resourceType === "image" || resourceType === "video")) {
        assets.push({ provider: "cloudinary", publicId, resourceType })
      }
    }
  }
  return [...new Map(assets.map((asset) => [JSON.stringify(asset), asset])).values()]
}

export async function snapshotExerciseMedia(db: MediaDb, variationIds: string[]): Promise<unknown[]> {
  if (!variationIds.length) return []
  const rows = await db.variation.findMany({ where: { id: { in: variationIds } }, select: { metadata: true } })
  const audits = await db.adminAuditLog.findMany({
    where: { entityType: "exercise", entityId: { in: variationIds }, action: { in: [...METADATA_WRITING_ACTIONS] } },
    select: { id: true, entityId: true, action: true, createdAt: true, metadata: true },
  })
  const undoable = undoableTransfers(audits)
  return [...rows.map((row) => row.metadata), ...audits
    .filter((audit) => audit.entityId && undoable.get(audit.entityId) === audit.id && hasPreviousMetadata(audit.metadata))
    .map((audit) => record(audit.metadata).previousMetadata)]
}

/**
 * Call only after the database mutation commits. Every provider block (including
 * inactive fallbacks), legacy URL and still-undoable transfer snapshot protects
 * its assets. Failure retains an orphan instead of failing an already committed
 * deletion. Callers serialize mutations in this process; this check and external
 * delete are NOT atomic with metadata writes from other processes or scripts.
 */
export async function cleanupUnreferencedExerciseMedia(db: MediaDb, previousMetadata: unknown[]): Promise<void> {
  const candidates = [...new Map(previousMetadata.flatMap(exerciseMediaAssets).map((asset) => [JSON.stringify(asset), asset])).values()]
  if (!candidates.length) return
  try {
    const live = await db.variation.findMany({ select: { id: true, metadata: true } })
    const audits = await db.adminAuditLog.findMany({
      where: { entityType: "exercise", entityId: { in: live.map((row) => row.id) }, action: { in: [...METADATA_WRITING_ACTIONS] } },
      select: { id: true, entityId: true, action: true, createdAt: true, metadata: true },
    })
    const undoable = undoableTransfers(audits)
    const references = [
      ...live.flatMap((row) => strings(row.metadata)),
      ...audits.filter((audit) => audit.entityId && undoable.get(audit.entityId) === audit.id && hasPreviousMetadata(audit.metadata))
        .flatMap((audit) => strings(record(audit.metadata).previousMetadata)),
    ]
    const orphaned = candidates.filter((asset) => !references.some((value) => value.includes(asset.provider === "storage" ? asset.path : asset.publicId)))
    const paths = orphaned.filter((asset): asset is Extract<Asset, { provider: "storage" }> => asset.provider === "storage").map((asset) => asset.path)
    for (let index = 0; index < paths.length; index += 1000) await removeStorageObjects(EXERCISE_MEDIA_BUCKET, paths.slice(index, index + 1000))
    if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) return
    for (const asset of orphaned) {
      if (asset.provider !== "cloudinary") continue
      const timestamp = Math.floor(Date.now() / 1000)
      const body = new URLSearchParams({ api_key: env.cloudinaryApiKey, public_id: asset.publicId, timestamp: String(timestamp), signature: cloudinarySignature({ public_id: asset.publicId, timestamp }) })
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinaryCloudName)}/${asset.resourceType}/destroy`, { body, method: "POST", signal: AbortSignal.timeout(10_000) })
      if (!response.ok) logger.warn("unable to remove unreferenced exercise media", { provider: asset.provider, status: response.status })
    }
  } catch (error) {
    logger.warn("exercise media cleanup deferred after database mutation", { error })
  }
}
