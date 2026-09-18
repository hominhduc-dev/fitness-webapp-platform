import { Prisma } from "@prisma/client"

import { env } from "../config/env"
import { EXERCISE_DATASET_SOURCE } from "../domain/exercise-dataset"
import { CDN_EXERCISE_MEDIA_METADATA_KEY } from "../lib/exercise-media"
import { cloudinarySignature } from "../lib/exercise-media-upload"
import { prisma } from "../lib/prisma"

type CliOptions = {
  apply: boolean
  databaseOnly: boolean
  fromPrefix: string
  gifPrefix: string
  thumbnailPrefix: string
  updateDatabase: boolean
}

type CloudinaryResource = {
  format?: string
  public_id: string
  resource_type: string
  type: string
  version?: number
}

type CloudinaryListResponse = {
  next_cursor?: string
  resources?: CloudinaryResource[]
}

type CloudinaryRenameResponse = {
  public_id?: string
  resource_type?: string
  version?: number
}

type Relocation = {
  fromPublicId: string
  format: string
  kind: "animation" | "thumbnail"
  resourceType: string
  toPublicId: string
  version?: number
}

const DEFAULT_FROM_PREFIX = "exercise-media/dataset"
const DEFAULT_GIF_PREFIX = "excercise-gif"
const DEFAULT_THUMBNAIL_PREFIX = "excercise-thumbnail"

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    databaseOnly: false,
    fromPrefix: DEFAULT_FROM_PREFIX,
    gifPrefix: DEFAULT_GIF_PREFIX,
    thumbnailPrefix: DEFAULT_THUMBNAIL_PREFIX,
    updateDatabase: true,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--db-only") options.databaseOnly = true
    else if (arg === "--from-prefix") options.fromPrefix = takeValue(args, index++, arg)
    else if (arg === "--gif-prefix") options.gifPrefix = takeValue(args, index++, arg)
    else if (arg === "--thumbnail-prefix") options.thumbnailPrefix = takeValue(args, index++, arg)
    else if (arg === "--skip-db") options.updateDatabase = false
    else throw new Error(`Unknown argument: ${arg}`)
  }

  options.fromPrefix = normalizePrefix(options.fromPrefix)
  options.gifPrefix = normalizePrefix(options.gifPrefix)
  options.thumbnailPrefix = normalizePrefix(options.thumbnailPrefix)
  return options
}

function normalizePrefix(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "")
}

function requireCloudinaryConfig() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required.")
  }
  return {
    apiKey: env.cloudinaryApiKey,
    cloudName: env.cloudinaryCloudName,
  }
}

function cloudinaryAdminUrl(pathname: string, params: Record<string, string | number | undefined> = {}) {
  const { cloudName } = requireCloudinaryConfig()
  const url = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}${pathname}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value))
  }
  return url
}

function cloudinaryAuthorizationHeader() {
  const { apiKey } = requireCloudinaryConfig()
  const token = Buffer.from(`${apiKey}:${env.cloudinaryApiSecret}`, "utf8").toString("base64")
  return `Basic ${token}`
}

async function cloudinaryRequest<T>(url: URL, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: cloudinaryAuthorizationHeader(),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Cloudinary request failed (${response.status}): ${detail.slice(0, 500)}`)
  }
  return await response.json() as T
}

async function listCloudinaryResources(prefix: string) {
  const resources: CloudinaryResource[] = []
  let nextCursor: string | undefined

  do {
    const url = cloudinaryAdminUrl("/resources/image/upload", {
      max_results: 500,
      next_cursor: nextCursor,
      prefix: `${prefix}/`,
    })
    const page = await cloudinaryRequest<CloudinaryListResponse>(url)
    resources.push(...(page.resources ?? []))
    nextCursor = page.next_cursor
  } while (nextCursor)

  return resources
}

function destinationFor(resource: CloudinaryResource, options: CliOptions): Relocation | undefined {
  const format = resource.format?.toLowerCase()
  if (!format) return undefined

  const suffix = resource.public_id.slice(`${options.fromPrefix}/`.length)
  if (!suffix || suffix === resource.public_id) return undefined

  if (format === "gif") {
    return {
      fromPublicId: resource.public_id,
      format,
      kind: "animation",
      resourceType: resource.resource_type,
      toPublicId: `${options.gifPrefix}/${suffix}`,
      version: resource.version,
    }
  }

  if (["jpg", "jpeg", "png", "webp"].includes(format)) {
    return {
      fromPublicId: resource.public_id,
      format,
      kind: "thumbnail",
      resourceType: resource.resource_type,
      toPublicId: `${options.thumbnailPrefix}/${suffix}`,
      version: resource.version,
    }
  }

  return undefined
}

async function renameCloudinaryResource(relocation: Relocation) {
  const { apiKey } = requireCloudinaryConfig()
  const timestamp = Math.floor(Date.now() / 1000)
  const params = {
    from_public_id: relocation.fromPublicId,
    invalidate: "true",
    overwrite: "true",
    timestamp,
    to_public_id: relocation.toPublicId,
  }
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    signature: cloudinarySignature(params),
  })

  const url = cloudinaryAdminUrl(`/${encodeURIComponent(relocation.resourceType)}/rename`)
  const renamed = await cloudinaryRequest<CloudinaryRenameResponse>(url, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  })

  return {
    ...relocation,
    toPublicId: renamed.public_id ?? relocation.toPublicId,
    version: renamed.version ?? relocation.version,
  }
}

function asMetadataObject(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Prisma.JsonObject) }
    : {}
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function migratedPublicId(publicId: string | undefined, sourcePrefix: string, destinationPrefix: string) {
  if (!publicId?.startsWith(`${sourcePrefix}/`)) return undefined
  return `${destinationPrefix}/${publicId.slice(`${sourcePrefix}/`.length)}`
}

async function updateVariationMetadata(options: CliOptions) {
  if (!prisma) throw new Error("DATABASE_URL is required to update variation metadata.")

  const variations = await prisma.variation.findMany({
    select: { id: true, metadata: true },
    where: { source: EXERCISE_DATASET_SOURCE },
  })

  let updated = 0
  for (const variation of variations) {
    const metadata = asMetadataObject(variation.metadata)
    const cdn = asObject(metadata[CDN_EXERCISE_MEDIA_METADATA_KEY])
    let changed = false

    const animationPublicId = typeof cdn.animationPublicId === "string" ? cdn.animationPublicId : undefined
    const thumbnailPublicId = typeof cdn.thumbnailPublicId === "string" ? cdn.thumbnailPublicId : undefined
    const nextAnimation = migratedPublicId(animationPublicId, options.fromPrefix, options.gifPrefix)
    const nextThumbnail = migratedPublicId(thumbnailPublicId, options.fromPrefix, options.thumbnailPrefix)

    if (nextAnimation) {
      cdn.animationPublicId = nextAnimation
      cdn.animationResourceType = "image"
      changed = true
    }
    if (nextThumbnail) {
      cdn.thumbnailPublicId = nextThumbnail
      cdn.thumbnailResourceType = "image"
      changed = true
    }

    if (!changed) continue

    await prisma.variation.update({
      data: { metadata: { ...metadata, [CDN_EXERCISE_MEDIA_METADATA_KEY]: cdn } as Prisma.InputJsonValue },
      where: { id: variation.id },
    })
    updated += 1
  }

  return updated
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  if (options.databaseOnly) {
    const updatedVariations = options.updateDatabase ? await updateVariationMetadata(options) : 0
    console.log(JSON.stringify({ databaseOnly: true, updatedVariations }, null, 2))
    return
  }
  const resources = await listCloudinaryResources(options.fromPrefix)
  const relocations = resources
    .map((resource) => destinationFor(resource, options))
    .filter((relocation): relocation is Relocation => Boolean(relocation))
    .filter((relocation) => relocation.fromPublicId !== relocation.toPublicId)

  const skipped = resources.length - relocations.length
  const summary = {
    apply: options.apply,
    fromPrefix: options.fromPrefix,
    gifPrefix: options.gifPrefix,
    resources: resources.length,
    skipped,
    thumbnailPrefix: options.thumbnailPrefix,
    toMove: relocations.length,
    toMoveByKind: {
      animation: relocations.filter((relocation) => relocation.kind === "animation").length,
      thumbnail: relocations.filter((relocation) => relocation.kind === "thumbnail").length,
    },
    updateDatabase: options.updateDatabase,
  }

  if (!options.apply) {
    console.log(JSON.stringify({ ...summary, sample: relocations.slice(0, 10) }, null, 2))
    return
  }

  const moved: Relocation[] = []
  for (const relocation of relocations) {
    moved.push(await renameCloudinaryResource(relocation))
  }

  const updatedVariations = options.updateDatabase ? await updateVariationMetadata(options) : 0
  console.log(JSON.stringify({ ...summary, moved: moved.length, updatedVariations }, null, 2))
}

if (require.main === module) {
  void main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma?.$disconnect()
    })
}
