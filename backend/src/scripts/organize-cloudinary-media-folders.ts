import { env } from "../config/env"
import { cloudinarySignature } from "../lib/exercise-media-upload"

/**
 * On a dynamic-folder Cloudinary account the Media Library folder (`asset_folder`) is
 * stored separately from the `public_id` that delivery URLs use. Renaming a public_id
 * therefore leaves the asset filed under its old folder, which is how exercise GIFs and
 * their JPG thumbnails ended up mixed in one folder.
 *
 * This script files every asset of a source folder by format and touches nothing else:
 * URLs, database metadata and the assets themselves stay exactly as they are.
 *
 * Dry run: npx tsx src/scripts/organize-cloudinary-media-folders.ts
 * Apply:   npx tsx src/scripts/organize-cloudinary-media-folders.ts --apply
 */

type CliOptions = {
  apply: boolean
  gifFolder: string
  sourceFolder: string
  thumbnailFolder: string
}

type CloudinaryResource = {
  asset_folder?: string
  format: string
  public_id: string
  resource_type: string
}

const DEFAULT_SOURCE_FOLDER = "exercise-media/dataset"
const DEFAULT_GIF_FOLDER = "excercise-gif"
const DEFAULT_THUMBNAIL_FOLDER = "excercise-thumbnail"
/** The Upload API is not bound by the admin API's hourly quota, so moves can run at speed. */
const CONCURRENCY = 8
const MAX_ATTEMPTS = 4

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function normalizeFolder(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "")
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    gifFolder: DEFAULT_GIF_FOLDER,
    sourceFolder: DEFAULT_SOURCE_FOLDER,
    thumbnailFolder: DEFAULT_THUMBNAIL_FOLDER,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--source-folder") options.sourceFolder = takeValue(args, index++, arg)
    else if (arg === "--gif-folder") options.gifFolder = takeValue(args, index++, arg)
    else if (arg === "--thumbnail-folder") options.thumbnailFolder = takeValue(args, index++, arg)
    else throw new Error(`Unknown argument: ${arg}`)
  }

  options.sourceFolder = normalizeFolder(options.sourceFolder)
  options.gifFolder = normalizeFolder(options.gifFolder)
  options.thumbnailFolder = normalizeFolder(options.thumbnailFolder)
  return options
}

function requireCloudinaryConfig() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required.")
  }
  return { apiKey: env.cloudinaryApiKey, apiSecret: env.cloudinaryApiSecret, cloudName: env.cloudinaryCloudName }
}

function folderTarget(format: string, options: CliOptions) {
  const normalized = format.toLowerCase()
  if (normalized === "gif") return options.gifFolder
  if (normalized === "jpg" || normalized === "jpeg" || normalized === "png" || normalized === "webp") return options.thumbnailFolder
  return undefined
}

async function listFolder(sourceFolder: string) {
  const { apiKey, apiSecret, cloudName } = requireCloudinaryConfig()
  const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`, "utf8").toString("base64")}`
  const resources: CloudinaryResource[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/by_asset_folder`)
    url.searchParams.set("asset_folder", sourceFolder)
    url.searchParams.set("max_results", "500")
    if (cursor) url.searchParams.set("next_cursor", cursor)

    const response = await fetch(url, { headers: { Authorization: authorization } })
    if (!response.ok) {
      throw new Error(`Cloudinary listing failed (${response.status}): ${(await response.text()).slice(0, 200)}`)
    }
    const payload = await response.json() as { next_cursor?: string; resources?: CloudinaryResource[] }
    resources.push(...(payload.resources ?? []))
    cursor = payload.next_cursor
  } while (cursor)

  return resources
}

/**
 * `explicit` re-files an existing asset without re-uploading its bytes, so the delivery
 * URL (and every cached copy of it) survives the move.
 */
async function moveToFolder(resource: CloudinaryResource, assetFolder: string, attempt = 1): Promise<void> {
  const { apiKey, cloudName } = requireCloudinaryConfig()
  const signed = {
    asset_folder: assetFolder,
    public_id: resource.public_id,
    timestamp: Math.floor(Date.now() / 1000),
    type: "upload",
  }
  const body = new URLSearchParams({
    ...signed,
    timestamp: String(signed.timestamp),
    api_key: apiKey,
    signature: cloudinarySignature(signed),
  })

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resource.resource_type}/explicit`, {
    body,
    method: "POST",
  })
  if (response.ok) return

  const retryable = response.status === 420 || response.status === 429 || response.status >= 500
  if (retryable && attempt < MAX_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt))
    return moveToFolder(resource, assetFolder, attempt + 1)
  }
  throw new Error(`${resource.public_id} -> ${response.status} ${(await response.text()).slice(0, 160)}`)
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  const resources = await listFolder(options.sourceFolder)

  const jobs = resources.flatMap((resource) => {
    const target = folderTarget(resource.format, options)
    return target && target !== resource.asset_folder ? [{ resource, target }] : []
  })
  const unsupported = resources.filter((resource) => !folderTarget(resource.format, options))

  const summary = {
    apply: options.apply,
    inSourceFolder: resources.length,
    sourceFolder: options.sourceFolder,
    toGifFolder: jobs.filter((job) => job.target === options.gifFolder).length,
    toThumbnailFolder: jobs.filter((job) => job.target === options.thumbnailFolder).length,
    unsupportedFormats: unsupported.map((resource) => `${resource.public_id} [${resource.format}]`),
  }

  if (!options.apply) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    return
  }

  let moved = 0
  const failures: string[] = []
  let cursor = 0

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length || 1) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try {
        await moveToFolder(job.resource, job.target)
        moved += 1
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error))
      }
      const processed = moved + failures.length
      if (processed % 200 === 0 || processed === jobs.length) {
        process.stderr.write(`[folders] ${processed}/${jobs.length} moved=${moved} failed=${failures.length}\n`)
      }
    }
  }))

  process.stdout.write(`${JSON.stringify({ ...summary, moved, failures }, null, 2)}\n`)
  if (failures.length > 0) process.exitCode = 1
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
