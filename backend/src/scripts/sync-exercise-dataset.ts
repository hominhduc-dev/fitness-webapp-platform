import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"
import { promisify } from "node:util"

import { Prisma } from "@prisma/client"

import {
  EXERCISE_DATASET_COMMIT,
  EXERCISE_DATASET_REPOSITORY,
  EXERCISE_DATASET_SOURCE,
  groupDatasetRecords,
  mapBodyPartToMuscleGroup,
  mergeExerciseDatasetMetadata,
  normalizeExerciseName,
  parseExerciseDataset,
  selectVariation,
  type ExerciseDatasetRecord,
} from "../domain/exercise-dataset"
import { EXERCISE_MEDIA_BUCKET } from "../lib/exercise-media"
import {
  EXERCISE_MEDIA_MAX_FILE_SIZE,
  EXERCISE_MEDIA_UPLOAD_CONCURRENCY,
  assertMediaUploadFlags,
  buildMediaUploadEntries,
  uploadWithRetry,
} from "../lib/exercise-media-upload"
import { prisma } from "../lib/prisma"
import { supabaseAdmin } from "../lib/supabase"

const execFileAsync = promisify(execFile)
const BACKEND_DIRECTORY = resolve(__dirname, "../..")
const REPORT_DIRECTORY = resolve(BACKEND_DIRECTORY, "../.exercise-sync-reports")

type ExerciseWithVariations = Prisma.ExerciseGetPayload<{ include: { variations: true } }>

type CliOptions = {
  apply: boolean
  confirmMediaRights: boolean
  datasetDirectory?: string
  reportPath: string
  sourceCommit: string
  uploadMedia: boolean
}

type ExistingRecordAction = {
  kind: "create-variation" | "update-variation"
  record: ExerciseDatasetRecord
  variationId?: string
}

type ExistingExerciseAction = {
  exercise: ExerciseWithVariations
  recordActions: ExistingRecordAction[]
}

type NewExerciseAction = {
  records: ExerciseDatasetRecord[]
}

type SyncPlan = {
  conflicts: string[]
  existingExerciseActions: ExistingExerciseAction[]
  metrics: {
    coachOnlyMatches: number
    createExercises: number
    createVariations: number
    datasetDuplicateGroups: number
    enrichVariations: number
    sourceUpdates: number
    systemMatches: number
  }
  newExerciseActions: NewExerciseAction[]
}

function defaultReportPath() {
  return join(REPORT_DIRECTORY, `exercise-dataset-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
}

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    confirmMediaRights: false,
    reportPath: defaultReportPath(),
    sourceCommit: EXERCISE_DATASET_COMMIT,
    uploadMedia: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--upload-media") options.uploadMedia = true
    else if (arg === "--confirm-media-rights") options.confirmMediaRights = true
    else if (arg === "--dataset-dir") options.datasetDirectory = resolve(takeValue(args, index++, arg))
    else if (arg === "--ref") options.sourceCommit = takeValue(args, index++, arg)
    else if (arg === "--report") options.reportPath = resolve(takeValue(args, index++, arg))
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!/^[a-f0-9]{40}$/i.test(options.sourceCommit)) {
    throw new Error("--ref must be a full 40-character Git commit SHA.")
  }
  assertMediaUploadFlags(options)
  return options
}

async function runGit(args: string[]) {
  const { stdout } = await execFileAsync("git", args, { maxBuffer: 10 * 1024 * 1024 })
  return stdout.trim()
}

async function prepareDataset(options: CliOptions) {
  if (options.datasetDirectory) {
    const head = await runGit(["-C", options.datasetDirectory, "rev-parse", "HEAD"])
    if (head !== options.sourceCommit) {
      throw new Error(`Dataset directory is at ${head}; expected ${options.sourceCommit}.`)
    }
    return { cleanup: false, directory: options.datasetDirectory }
  }

  const directory = await mkdtemp(join(tmpdir(), "fitness-exercise-dataset-"))
  await runGit(["clone", "--filter=blob:none", "--no-checkout", EXERCISE_DATASET_REPOSITORY, directory])
  await runGit(["-C", directory, "fetch", "--depth", "1", "origin", options.sourceCommit])
  await runGit(["-C", directory, "checkout", "--detach", "FETCH_HEAD"])
  const head = await runGit(["-C", directory, "rev-parse", "HEAD"])
  if (head !== options.sourceCommit) throw new Error(`Checked out ${head}; expected ${options.sourceCommit}.`)
  return { cleanup: true, directory }
}

function resolveDatasetAsset(datasetDirectory: string, relativePath: string) {
  const resolved = resolve(datasetDirectory, relativePath)
  const traversal = relative(datasetDirectory, resolved)
  if (traversal.startsWith("..") || isAbsolute(traversal)) {
    throw new Error(`Unsafe dataset asset path: ${relativePath}`)
  }
  return resolved
}

async function loadAndValidateDataset(datasetDirectory: string) {
  const raw = JSON.parse(await readFile(join(datasetDirectory, "data/exercises.json"), "utf8")) as unknown
  const records = parseExerciseDataset(raw)

  await Promise.all(records.flatMap((record) => [record.image, record.gif_url].map(async (assetPath) => {
    const file = await stat(resolveDatasetAsset(datasetDirectory, assetPath))
    if (!file.isFile()) throw new Error(`Dataset asset is not a file: ${assetPath}`)
    if (file.size > EXERCISE_MEDIA_MAX_FILE_SIZE) {
      throw new Error(`Dataset asset exceeds 1 MiB: ${assetPath} (${file.size} bytes)`)
    }
  })))

  return records
}

function addToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  map.set(key, [...(map.get(key) ?? []), value])
}

function buildSyncPlan(records: ExerciseDatasetRecord[], exercises: ExerciseWithVariations[]): SyncPlan {
  const groups = groupDatasetRecords(records)
  const systemByName = new Map<string, ExerciseWithVariations[]>()
  const coachNames = new Set<string>()
  const sourceById = new Map<string, { exercise: ExerciseWithVariations; variationId: string }>()

  for (const exercise of exercises) {
    const key = normalizeExerciseName(exercise.name)
    if (exercise.createdById === null) addToMap(systemByName, key, exercise)
    else coachNames.add(key)
    for (const variation of exercise.variations) {
      if (variation.source === EXERCISE_DATASET_SOURCE && variation.sourceId) {
        sourceById.set(variation.sourceId, { exercise, variationId: variation.id })
      }
    }
  }

  const plan: SyncPlan = {
    conflicts: [],
    existingExerciseActions: [],
    metrics: {
      coachOnlyMatches: 0,
      createExercises: 0,
      createVariations: 0,
      datasetDuplicateGroups: [...groups.values()].filter((group) => group.length > 1).length,
      enrichVariations: 0,
      sourceUpdates: 0,
      systemMatches: 0,
    },
    newExerciseActions: [],
  }

  for (const [normalizedName, group] of groups) {
    const sourcedTargets = new Map<string, ExerciseWithVariations>()
    for (const record of group) {
      const sourced = sourceById.get(record.id)
      if (sourced) sourcedTargets.set(sourced.exercise.id, sourced.exercise)
    }

    const systemMatches = systemByName.get(normalizedName) ?? []
    if (sourcedTargets.size > 1) {
      plan.conflicts.push(`${group[0].name}: sourced variations span multiple exercises.`)
      continue
    }
    if (sourcedTargets.size === 0 && systemMatches.length > 1) {
      plan.conflicts.push(`${group[0].name}: ${systemMatches.length} system exercises share the normalized name.`)
      continue
    }

    const targetExercise = [...sourcedTargets.values()][0] ?? systemMatches[0]
    if (!targetExercise) {
      plan.newExerciseActions.push({ records: group })
      plan.metrics.createExercises += 1
      plan.metrics.createVariations += group.length
      if (coachNames.has(normalizedName)) plan.metrics.coachOnlyMatches += group.length
      continue
    }

    if (sourcedTargets.size === 0) plan.metrics.systemMatches += group.length
    const usedVariationIds = new Set<string>()
    const recordActions: ExistingRecordAction[] = []

    for (const record of group) {
      const sourced = sourceById.get(record.id)
      if (sourced) {
        if (sourced.exercise.id !== targetExercise.id) {
          plan.conflicts.push(`${record.name} (${record.id}): source identity points at another exercise.`)
          continue
        }
        usedVariationIds.add(sourced.variationId)
        recordActions.push({ kind: "update-variation", record, variationId: sourced.variationId })
        plan.metrics.sourceUpdates += 1
        continue
      }

      const selected = selectVariation(targetExercise.variations, record, usedVariationIds)
      if (selected) {
        usedVariationIds.add(selected.id)
        recordActions.push({ kind: "update-variation", record, variationId: selected.id })
        plan.metrics.enrichVariations += 1
        continue
      }

      const remaining = targetExercise.variations.filter((variation) => !usedVariationIds.has(variation.id))
      if (remaining.length > 0) {
        plan.conflicts.push(`${record.name} (${record.id}): variation selection is ambiguous.`)
        continue
      }

      recordActions.push({ kind: "create-variation", record })
      plan.metrics.createVariations += 1
    }

    plan.existingExerciseActions.push({ exercise: targetExercise, recordActions })
  }

  return plan
}

function toJsonInput(value: unknown) {
  return value as Prisma.InputJsonValue
}

function nextAlternativeName(existingNames: Set<string>) {
  let index = 2
  while (existingNames.has(`Alternative ${index}`)) index += 1
  const name = `Alternative ${index}`
  existingNames.add(name)
  return name
}

async function applySyncPlan(plan: SyncPlan, sourceCommit: string) {
  if (!prisma) throw new Error("Database is not configured.")
  const createdExerciseIds: string[] = plan.newExerciseActions.map(() => randomUUID())
  const exerciseRows: Prisma.ExerciseCreateManyInput[] = []
  const variationRows: Prisma.VariationCreateManyInput[] = []
  const variationUpdates: Array<{
    metadata: Prisma.InputJsonValue
    sourceId: string
    variationId: string
  }> = []

  for (const action of plan.existingExerciseActions) {
    const names = new Set(action.exercise.variations.map((variation) => variation.name))
    let nextSortOrder = Math.max(-1, ...action.exercise.variations.map((variation) => variation.sortOrder)) + 1
    for (const recordAction of action.recordActions) {
      if (recordAction.kind === "update-variation" && recordAction.variationId) {
        const variation = action.exercise.variations.find((item) => item.id === recordAction.variationId)
        if (!variation) throw new Error(`Missing planned variation ${recordAction.variationId}.`)
        variationUpdates.push({
          metadata: toJsonInput(mergeExerciseDatasetMetadata(variation.metadata, recordAction.record, sourceCommit)),
          sourceId: recordAction.record.id,
          variationId: variation.id,
        })
      } else {
        const isFirstVariation = action.exercise.variations.length === 0 && variationRows.every((row) => row.exerciseId !== action.exercise.id)
        const name = isFirstVariation ? "Default" : nextAlternativeName(names)
        names.add(name)
        variationRows.push({
          activityType: recordAction.record.body_part === "cardio" ? "cardio" : "strength",
          equipment: recordAction.record.equipment,
          exerciseId: action.exercise.id,
          id: randomUUID(),
          isDefault: isFirstVariation,
          metadata: toJsonInput(mergeExerciseDatasetMetadata(undefined, recordAction.record, sourceCommit)),
          name,
          sortOrder: nextSortOrder++,
          source: EXERCISE_DATASET_SOURCE,
          sourceId: recordAction.record.id,
        })
      }
    }
  }

  plan.newExerciseActions.forEach((action, actionIndex) => {
    const exerciseId = createdExerciseIds[actionIndex]
    exerciseRows.push({
      id: exerciseId,
      muscleGroup: mapBodyPartToMuscleGroup(action.records[0].body_part),
      name: action.records[0].name,
    })
    variationRows.push(...action.records.map((record, index) => ({
      activityType: record.body_part === "cardio" ? "cardio" as const : "strength" as const,
      equipment: record.equipment,
      exerciseId,
      id: randomUUID(),
      isDefault: index === 0,
      metadata: toJsonInput(mergeExerciseDatasetMetadata(undefined, record, sourceCommit)),
      name: index === 0 ? "Default" : `Alternative ${index + 1}`,
      sortOrder: index,
      source: EXERCISE_DATASET_SOURCE,
      sourceId: record.id,
    })))
  })

  await prisma.$transaction(async (transaction) => {
    for (const update of variationUpdates) {
      await transaction.variation.update({
        data: {
          metadata: update.metadata,
          source: EXERCISE_DATASET_SOURCE,
          sourceId: update.sourceId,
        },
        where: { id: update.variationId },
      })
    }
    if (exerciseRows.length > 0) await transaction.exercise.createMany({ data: exerciseRows })
    if (variationRows.length > 0) await transaction.variation.createMany({ data: variationRows })
  }, { maxWait: 30_000, timeout: 180_000 })

  return { createdExerciseIds }
}

function isNotFoundMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes("not found") || normalized.includes("does not exist")
}

async function ensureExerciseMediaBucket() {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  const configuration = {
    allowedMimeTypes: ["image/jpeg", "image/gif"],
    fileSizeLimit: EXERCISE_MEDIA_MAX_FILE_SIZE,
    public: true,
  }
  const { error } = await supabaseAdmin.storage.getBucket(EXERCISE_MEDIA_BUCKET)
  if (error && isNotFoundMessage(error.message)) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(EXERCISE_MEDIA_BUCKET, configuration)
    if (createError && !createError.message.toLowerCase().includes("already exists")) throw createError
    return
  }
  if (error) throw error
  const { error: updateError } = await supabaseAdmin.storage.updateBucket(EXERCISE_MEDIA_BUCKET, configuration)
  if (updateError) throw updateError
}

async function uploadMedia(records: ExerciseDatasetRecord[], datasetDirectory: string, sourceCommit: string) {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  await ensureExerciseMediaBucket()
  const bucket = supabaseAdmin.storage.from(EXERCISE_MEDIA_BUCKET)
  const entries = buildMediaUploadEntries(records, datasetDirectory, sourceCommit)
  let cursor = 0
  let uploaded = 0
  let skipped = 0

  async function worker() {
    while (cursor < entries.length) {
      const entry = entries[cursor++]
      const buffer = await readFile(resolveDatasetAsset(datasetDirectory, relative(datasetDirectory, resolve(entry.localPath))))
      const result = await uploadWithRetry(() => bucket.upload(entry.objectPath, buffer, {
        cacheControl: "31536000",
        contentType: entry.contentType,
        upsert: false,
      }))
      if (result === "uploaded") uploaded += 1
      else skipped += 1
      const processed = uploaded + skipped
      if (processed % 250 === 0 || processed === entries.length) {
        console.error(`[exercise-media] ${processed}/${entries.length} uploaded=${uploaded} skipped=${skipped}`)
      }
    }
  }

  await Promise.all(Array.from({ length: EXERCISE_MEDIA_UPLOAD_CONCURRENCY }, () => worker()))
  return { skipped, uploaded }
}

async function listStorageNames(prefix: string) {
  if (!supabaseAdmin) throw new Error("Supabase service-role client is not configured.")
  const names: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.storage.from(EXERCISE_MEDIA_BUCKET).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    })
    if (error) throw error
    names.push(...data.map((item) => item.name))
    if (data.length < 1000) return names
  }
}

async function verifyRollout(records: ExerciseDatasetRecord[], sourceCommit: string) {
  if (!prisma) throw new Error("Database is not configured.")
  const [sourcedVariations, imageNames, videoNames] = await Promise.all([
    prisma.variation.count({ where: { source: EXERCISE_DATASET_SOURCE } }),
    listStorageNames(`${sourceCommit}/images`),
    listStorageNames(`${sourceCommit}/videos`),
  ])
  const expectedImages = new Set(records.map((record) => basename(record.image)))
  const expectedVideos = new Set(records.map((record) => basename(record.gif_url)))
  const missingImages = [...expectedImages].filter((name) => !imageNames.includes(name))
  const missingVideos = [...expectedVideos].filter((name) => !videoNames.includes(name))

  return {
    imageObjects: imageNames.length,
    missingImages,
    missingVideos,
    sourcedVariations,
    storageObjects: imageNames.length + videoNames.length,
    videoObjects: videoNames.length,
  }
}

function serializePlan(plan: SyncPlan) {
  return {
    conflicts: plan.conflicts,
    metrics: plan.metrics,
    rollback: {
      restoreVariations: plan.existingExerciseActions.flatMap((action) => action.recordActions
        .filter((recordAction) => recordAction.kind === "update-variation")
        .map((recordAction) => action.exercise.variations.find((variation) => variation.id === recordAction.variationId))
        .filter(Boolean)),
    },
  }
}

async function writeReport(reportPath: string, report: unknown) {
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const prepared = await prepareDataset(options)

  try {
    console.error(`[exercise-dataset] validating ${options.sourceCommit}`)
    const records = await loadAndValidateDataset(prepared.directory)
    const exercises = await prisma.exercise.findMany({ include: { variations: true } })
    const plan = buildSyncPlan(records, exercises)
    const report: Record<string, unknown> = {
      applied: false,
      dataset: { records: records.length, repository: EXERCISE_DATASET_REPOSITORY, source: EXERCISE_DATASET_SOURCE, sourceCommit: options.sourceCommit },
      generatedAt: new Date().toISOString(),
      media: { requested: options.uploadMedia },
      ...serializePlan(plan),
    }

    await writeReport(options.reportPath, report)
    if (plan.conflicts.length > 0) {
      throw new Error(`Sync has ${plan.conflicts.length} conflict(s). Review ${options.reportPath}.`)
    }
    if (!options.apply) {
      console.log(JSON.stringify({ dryRun: true, reportPath: options.reportPath, ...plan.metrics }, null, 2))
      return
    }

    if (options.uploadMedia) {
      report.media = { requested: true, ...(await uploadMedia(records, prepared.directory, options.sourceCommit)) }
    }

    const applyResult = await applySyncPlan(plan, options.sourceCommit)
    const verification = options.uploadMedia ? await verifyRollout(records, options.sourceCommit) : undefined
    Object.assign(report, {
      applied: true,
      appliedAt: new Date().toISOString(),
      rollback: {
        ...(report.rollback as object),
        createdExerciseIds: applyResult.createdExerciseIds,
      },
      verification,
    })
    await writeReport(options.reportPath, report)
    console.log(JSON.stringify({ applied: true, reportPath: options.reportPath, verification, ...plan.metrics }, null, 2))
  } finally {
    if (prepared.cleanup) {
      const tempRoot = resolve(tmpdir())
      const datasetPath = resolve(prepared.directory)
      if (datasetPath.startsWith(`${tempRoot}\\`) || datasetPath.startsWith(`${tempRoot}/`)) {
        await rm(datasetPath, { force: true, recursive: true })
      }
    }
  }
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

export { buildSyncPlan, loadAndValidateDataset, parseCliOptions }
