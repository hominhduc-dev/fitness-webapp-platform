import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import { Prisma, PrismaClient } from "@prisma/client"
import xlsx from "xlsx"

import {
  EXTERNAL_SOURCE_METADATA_KEY,
  readExternalSourceMetadata,
} from "../lib/exercise-media"
import {
  assertMediaUploadFlags,
} from "../lib/exercise-media-upload"

type WorkbookRow = {
  Image?: string
  "Video Link"?: string
  exercise_id?: string
  exercise_name?: string
  equipment?: string
  local_image_url?: string
  local_video_url?: string
  muscle_group?: string
  variation_name?: string
}

type NormalizedRow = {
  animationUrl: string
  equipment?: string
  exerciseId: string
  exerciseName: string
  localAnimationUrl?: string
  localThumbnailUrl?: string
  muscleGroup: string
  rowNumber: number
  thumbnailUrl: string
  variationName: string
}

type VariationRecord = Prisma.VariationGetPayload<{ include: { exercise: true } }>

type PlannedUpdate = {
  currentExerciseName: string
  currentMetadata: Prisma.JsonValue | null
  currentVariationName: string
  exerciseId: string
  metadata: Prisma.InputJsonValue
  row: NormalizedRow
  targetExerciseName: string
  targetVariationName: string
  variationId: string
}

type CliOptions = {
  apply: boolean
  confirmMediaRights: boolean
  reportPath: string
  sheetName: string
  uploadMedia: boolean
  workbookPath: string
}

type VariationChoice =
  | { conflict: "ambiguous_variation" | "multiple_variation_name_matches" | "no_equipment_match" | "no_variation_match" }
  | { variation: VariationRecord }

const DEFAULT_SHEET = "Exercises want to insert"
const REPORT_DIRECTORY = resolve(__dirname, "../../../.exercise-sync-reports")

const MUSCLE_GROUP_MAP: Record<string, string> = {
  abdominals: "Core",
  abductors: "Legs",
  adductors: "Legs",
  biceps: "Arms",
  calves: "Calves",
  cardio: "Cardio",
  chest: "Chest",
  forearms: "Arms",
  "full body": "Other",
  glutes: "Legs",
  hamstrings: "Legs",
  lats: "Back",
  "lower back": "Back",
  quadriceps: "Legs",
  shoulders: "Shoulders",
  traps: "Back",
  triceps: "Arms",
  "upper back": "Back",
}

const EQUIPMENT_MAP: Record<string, string> = {
  "": "",
  band: "resistance band",
  barbell: "barbell",
  bodyweight: "",
  cable: "cable",
  dumbbell: "dumbbell",
  kettlebell: "kettlebell",
  machine: "machine",
  none: "",
  other: "other",
  plate: "plate",
  "resistance band": "resistance band",
  trapbar: "trap bar",
}

function takeValue(args: string[], index: number, flag: string) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`)
  return value
}

function parseArgs(args = process.argv.slice(2)): CliOptions {
  const options: CliOptions = {
    apply: false,
    confirmMediaRights: false,
    reportPath: join(REPORT_DIRECTORY, `external-media-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`),
    sheetName: DEFAULT_SHEET,
    uploadMedia: false,
    workbookPath: "",
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--apply") options.apply = true
    else if (arg === "--upload-media") options.uploadMedia = true
    else if (arg === "--confirm-media-rights") options.confirmMediaRights = true
    else if (arg === "--workbook") options.workbookPath = resolve(takeValue(args, index++, arg))
    else if (arg === "--sheet") options.sheetName = takeValue(args, index++, arg)
    else if (arg === "--report") options.reportPath = resolve(takeValue(args, index++, arg))
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!options.workbookPath) throw new Error("--workbook is required.")
  assertMediaUploadFlags(options)
  return options
}

function normalizeText(value: string | null | undefined) {
  return value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US") ?? ""
}

function normalizeEquipment(value: string | null | undefined) {
  return EQUIPMENT_MAP[normalizeText(value)] ?? normalizeText(value)
}

function buildDisplayName(row: Pick<NormalizedRow, "exerciseName" | "variationName">) {
  const exerciseParenthesisMatch = row.exerciseName.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  const exerciseNameWithoutEquipment = exerciseParenthesisMatch?.[1]?.trim() || row.exerciseName
  const exerciseEquipment = exerciseParenthesisMatch?.[2]?.trim() || ""
  const dashMatch = exerciseNameWithoutEquipment.match(/^(.*?)\s+-\s+(.+)$/)
  const baseExerciseName = dashMatch?.[1]?.trim() || exerciseNameWithoutEquipment
  const exerciseModifier = dashMatch?.[2]?.trim() || ""
  const variationName = row.variationName.trim() || "Default"

  if (variationName === "Default") {
    return [exerciseEquipment, exerciseModifier, baseExerciseName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  }

  const variationParenthesisMatch = variationName.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  const variationModifier = variationParenthesisMatch?.[1]?.trim() || variationName
  const equipment = variationParenthesisMatch?.[2]?.trim() || ""

  if (equipment) {
    const modifier = normalizeText(exerciseModifier) === normalizeText(variationModifier)
      ? exerciseModifier
      : [exerciseModifier, variationModifier].filter(Boolean).join(" ")
    return [equipment, modifier, baseExerciseName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  }

  return [variationName, exerciseModifier, baseExerciseName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
}

function mapMuscleGroup(value: string) {
  return MUSCLE_GROUP_MAP[normalizeText(value)] ?? value.trim()
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

function requireHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function readRows(workbookPath: string, sheetName: string) {
  const workbook = xlsx.readFile(workbookPath)
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}. Available sheets: ${workbook.SheetNames.join(", ")}`)

  return xlsx.utils.sheet_to_json<WorkbookRow>(sheet, { defval: "", raw: false })
    .map((row, index): NormalizedRow | null => {
      const exerciseName = sanitizeText(row.exercise_name)
      const muscleGroup = sanitizeText(row.muscle_group)
      const exerciseId = sanitizeText(row.exercise_id)
      const thumbnailUrl = requireHttpsUrl(sanitizeText(row.Image))
      const animationUrl = requireHttpsUrl(sanitizeText(row["Video Link"]))

      if (!exerciseName || !muscleGroup || !exerciseId || !thumbnailUrl || !animationUrl) return null

      return {
        animationUrl,
        equipment: sanitizeText(row.equipment) || undefined,
        exerciseId,
        exerciseName,
        localAnimationUrl: sanitizeText(row.local_video_url) || undefined,
        localThumbnailUrl: sanitizeText(row.local_image_url) || undefined,
        muscleGroup,
        rowNumber: index + 2,
        thumbnailUrl,
        variationName: sanitizeText(row.variation_name) || "Default",
      }
    })
    .filter((row): row is NormalizedRow => row !== null)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function buildMetadata(existingMetadata: Prisma.JsonValue | null, row: NormalizedRow) {
  const existing = asRecord(existingMetadata)
  const media: Record<string, Prisma.InputJsonValue> = {
    animationType: "video",
    animationUrl: row.animationUrl,
    thumbnailUrl: row.thumbnailUrl,
  }
  if (row.localAnimationUrl) media.localAnimationUrl = row.localAnimationUrl
  if (row.localThumbnailUrl) media.localThumbnailUrl = row.localThumbnailUrl

  return {
    ...existing,
    [EXTERNAL_SOURCE_METADATA_KEY]: {
      ...asRecord(readExternalSourceMetadata(existingMetadata)),
      displayName: buildDisplayName(row),
      exerciseId: row.exerciseId,
      media,
      syncedAt: new Date().toISOString(),
    },
  } satisfies Prisma.InputJsonObject
}

function chooseVariation(candidates: VariationRecord[], row: NormalizedRow): VariationChoice {
  const targetEquipment = normalizeEquipment(row.equipment)
  const targetVariation = normalizeText(row.variationName)
  const equipmentMatches = candidates.filter((variation) => normalizeEquipment(variation.equipment) === targetEquipment)

  if (targetVariation !== "default") {
    const variationMatches = candidates.filter((variation) => normalizeText(variation.name) === targetVariation)
    const scopedVariationMatches = targetEquipment
      ? variationMatches.filter((variation) => normalizeEquipment(variation.equipment) === targetEquipment)
      : variationMatches

    if (scopedVariationMatches.length === 1) return { variation: scopedVariationMatches[0] }
    if (scopedVariationMatches.length > 1) return { conflict: "multiple_variation_name_matches" as const }
    if (variationMatches.length === 1) return { variation: variationMatches[0] }
    if (variationMatches.length > 1) return { conflict: "multiple_variation_name_matches" as const }
  }

  if (targetEquipment && equipmentMatches.length === 0) {
    return { conflict: "no_equipment_match" as const }
  }

  const scoped = equipmentMatches.length > 0 ? equipmentMatches : candidates
  const defaults = scoped.filter((variation) => variation.isDefault || normalizeText(variation.name) === "default")
  if (defaults.length === 1) return { variation: defaults[0] }
  if (scoped.length === 1) return { variation: scoped[0] }
  return { conflict: scoped.length > 1 ? "ambiguous_variation" as const : "no_variation_match" as const }
}

function buildPlan(rows: NormalizedRow[], variations: VariationRecord[]) {
  const exerciseGroups = new Map<string, VariationRecord[]>()
  const conflicts: Array<Record<string, unknown>> = []
  const unmatched: Array<Record<string, unknown>> = []
  const updates: PlannedUpdate[] = []

  for (const variation of variations) {
    const key = `${normalizeText(variation.exercise.name)}::${normalizeText(variation.exercise.muscleGroup)}`
    const group = exerciseGroups.get(key) ?? []
    group.push(variation)
    exerciseGroups.set(key, group)
  }

  const seenVariationIds = new Set<string>()

  for (const row of rows) {
    const dbMuscleGroup = mapMuscleGroup(row.muscleGroup)
    const key = `${normalizeText(row.exerciseName)}::${normalizeText(dbMuscleGroup)}`
    const candidates = exerciseGroups.get(key) ?? []

    if (candidates.length === 0) {
      unmatched.push({ reason: "no_exercise_match", row })
      continue
    }

    const selected = chooseVariation(candidates, row)
    if (!("variation" in selected)) {
      unmatched.push({ reason: selected.conflict, row })
      continue
    }

    const variation = selected.variation
    if (seenVariationIds.has(variation.id)) {
      conflicts.push({ reason: "duplicate_workbook_rows_target_same_variation", row, variationId: variation.id })
      continue
    }

    const targetVariationName = row.variationName
    const duplicateName = candidates.some((candidate) =>
      candidate.id !== variation.id && normalizeText(candidate.name) === normalizeText(targetVariationName),
    )
    if (duplicateName) {
      conflicts.push({ reason: "target_variation_name_exists", row, variationId: variation.id, targetVariationName })
      continue
    }

    seenVariationIds.add(variation.id)
    updates.push({
      currentExerciseName: variation.exercise.name,
      currentMetadata: variation.metadata,
      currentVariationName: variation.name,
      exerciseId: variation.exerciseId,
      metadata: buildMetadata(variation.metadata, row),
      row,
      targetExerciseName: row.exerciseName,
      targetVariationName,
      variationId: variation.id,
    })
  }

  return { conflicts, unmatched, updates }
}

async function uploadMatchedMedia(updates: PlannedUpdate[]) {
  void updates
  throw new Error("--upload-media to Supabase Storage has been removed. Backfill external exercise media through Cloudinary instead.")
}

async function main() {
  const options = parseArgs()
  const prisma = new PrismaClient()

  try {
    const rows = readRows(options.workbookPath, options.sheetName)
    const variations = await prisma.variation.findMany({ include: { exercise: true } })
    const plan = buildPlan(rows, variations)
    if (options.uploadMedia) await uploadMatchedMedia(plan.updates)
    const media = { requested: false }

    if (options.apply) {
      await prisma.$transaction(async (tx) => {
        for (const update of plan.updates) {
          if (update.currentExerciseName !== update.targetExerciseName) {
            await tx.exercise.update({
              data: { name: update.targetExerciseName },
              where: { id: update.exerciseId },
            })
          }

          await tx.variation.update({
            data: {
              metadata: update.metadata,
              name: update.targetVariationName,
              isDefault: update.targetVariationName === "Default",
            },
            where: { id: update.variationId },
          })
        }
      }, { maxWait: 30_000, timeout: 180_000 })
    }

    const report = {
      applied: options.apply,
      generatedAt: new Date().toISOString(),
      input: {
        rows: rows.length,
        sheetName: options.sheetName,
        workbookPath: options.workbookPath,
      },
      metrics: {
        conflicts: plan.conflicts.length,
        matchedUpdates: plan.updates.length,
        unmatched: plan.unmatched.length,
      },
      media,
      conflicts: plan.conflicts,
      unmatched: plan.unmatched,
      updates: plan.updates.map((update) => ({
        currentExerciseName: update.currentExerciseName,
        currentMetadata: update.currentMetadata,
        currentVariationName: update.currentVariationName,
        row: update.row,
        targetExerciseName: update.targetExerciseName,
        targetVariationName: update.targetVariationName,
        variationId: update.variationId,
      })),
    }

    await mkdir(dirname(options.reportPath), { recursive: true })
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
    console.log(JSON.stringify({ applied: options.apply, reportPath: options.reportPath, ...report.metrics }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
