import { z } from "zod"

import { ValidationError } from "../services/errors"

const EXERCISE_DATASET_SOURCE = "hasaneyldrm/exercises-dataset"
const EXERCISE_DATASET_REPOSITORY = "https://github.com/hasaneyldrm/exercises-dataset.git"
const EXERCISE_DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd"
const EXERCISE_DATASET_EXPECTED_RECORDS = 1324
const EXERCISE_DATASET_LANGUAGES = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"] as const

const languageTextSchema = z.object(Object.fromEntries(
  EXERCISE_DATASET_LANGUAGES.map((language) => [language, z.string()]),
) as Record<(typeof EXERCISE_DATASET_LANGUAGES)[number], z.ZodString>)

const languageStepsSchema = z.object(Object.fromEntries(
  EXERCISE_DATASET_LANGUAGES.map((language) => [language, z.array(z.string().min(1))]),
) as Record<(typeof EXERCISE_DATASET_LANGUAGES)[number], z.ZodArray<z.ZodString>>)

const exerciseDatasetRecordSchema = z.strictObject({
  attribution: z.string().min(1),
  body_part: z.enum(["back", "cardio", "chest", "lower arms", "lower legs", "neck", "shoulders", "upper arms", "upper legs", "waist"]),
  category: z.string().min(1),
  created_at: z.iso.datetime({ offset: true }),
  equipment: z.string().min(1),
  gif_url: z.string().regex(/^videos\/.+\.gif$/i),
  id: z.string().regex(/^\d{4}$/),
  image: z.string().regex(/^images\/.+\.(?:jpg|jpeg|png)$/i),
  instruction_steps: languageStepsSchema,
  instructions: languageTextSchema,
  media_id: z.string().min(1),
  muscle_group: z.string().min(1),
  name: z.string().min(1),
  secondary_muscles: z.array(z.string().min(1)),
  target: z.string().min(1),
})

const exerciseDatasetSchema = z.array(exerciseDatasetRecordSchema).length(EXERCISE_DATASET_EXPECTED_RECORDS)

type ExerciseDatasetRecord = z.infer<typeof exerciseDatasetRecordSchema>

type JsonRecord = Record<string, unknown>

type VariationCandidate = {
  equipment: string | null
  id: string
  isDefault: boolean
  source: string | null
  sourceId: string | null
}

const BODY_PART_TO_MUSCLE_GROUP: Record<ExerciseDatasetRecord["body_part"], string> = {
  back: "Back",
  cardio: "Cardio",
  chest: "Chest",
  "lower arms": "Arms",
  "lower legs": "Calves",
  neck: "Other",
  shoulders: "Shoulders",
  "upper arms": "Arms",
  "upper legs": "Legs",
  waist: "Core",
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

function normalizeExerciseName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}

function normalizeEquipment(value: string | null | undefined) {
  return value ? normalizeExerciseName(value) : ""
}

function mapBodyPartToMuscleGroup(bodyPart: ExerciseDatasetRecord["body_part"]) {
  return BODY_PART_TO_MUSCLE_GROUP[bodyPart]
}

function groupDatasetRecords(records: ExerciseDatasetRecord[]) {
  const groups = new Map<string, ExerciseDatasetRecord[]>()

  for (const record of records) {
    const key = normalizeExerciseName(record.name)
    const group = groups.get(key) ?? []
    group.push(record)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id))
  }

  return groups
}

function selectVariation(
  candidates: VariationCandidate[],
  record: Pick<ExerciseDatasetRecord, "equipment" | "id">,
  usedVariationIds = new Set<string>(),
) {
  const available = candidates.filter((candidate) => !usedVariationIds.has(candidate.id))
  const sourced = available.filter(
    (candidate) => candidate.source === EXERCISE_DATASET_SOURCE && candidate.sourceId === record.id,
  )
  if (sourced.length === 1) return sourced[0]
  if (sourced.length > 1) return undefined

  const defaults = available.filter((candidate) => candidate.isDefault)
  if (defaults.length === 1) return defaults[0]
  if (defaults.length > 1) return undefined

  const equipment = normalizeEquipment(record.equipment)
  const equipmentMatches = available.filter(
    (candidate) => normalizeEquipment(candidate.equipment) === equipment,
  )
  if (equipmentMatches.length === 1) return equipmentMatches[0]
  if (equipmentMatches.length > 1) return undefined

  return available.length === 1 ? available[0] : undefined
}

function buildExerciseDatasetMetadata(record: ExerciseDatasetRecord, sourceCommit: string) {
  return {
    bodyPart: record.body_part,
    category: record.category,
    createdAt: record.created_at,
    instructionSteps: record.instruction_steps,
    instructions: record.instructions,
    media: {
      animationObjectPath: `${sourceCommit}/${record.gif_url}`,
      thumbnailObjectPath: `${sourceCommit}/${record.image}`,
    },
    mediaId: record.media_id,
    secondaryMuscles: record.secondary_muscles,
    sourceCommit,
    target: record.target,
    upstreamMuscleGroup: record.muscle_group,
  }
}

function mergeExerciseDatasetMetadata(
  existingMetadata: unknown,
  record: ExerciseDatasetRecord,
  sourceCommit: string,
) {
  const existing = asRecord(existingMetadata)
  const existingDataset = asRecord(existing.exerciseDataset)

  return {
    ...existing,
    exerciseDataset: {
      ...existingDataset,
      ...buildExerciseDatasetMetadata(record, sourceCommit),
    },
  }
}

function parseExerciseDataset(input: unknown) {
  const records = exerciseDatasetSchema.parse(input)
  const ids = new Set(records.map((record) => record.id))
  if (ids.size !== records.length) {
    throw new ValidationError("Dataset contains duplicate source IDs.")
  }
  return records
}

export {
  EXERCISE_DATASET_COMMIT,
  EXERCISE_DATASET_EXPECTED_RECORDS,
  EXERCISE_DATASET_LANGUAGES,
  EXERCISE_DATASET_REPOSITORY,
  EXERCISE_DATASET_SOURCE,
  buildExerciseDatasetMetadata,
  exerciseDatasetRecordSchema,
  groupDatasetRecords,
  mapBodyPartToMuscleGroup,
  mergeExerciseDatasetMetadata,
  normalizeExerciseName,
  parseExerciseDataset,
  selectVariation,
}
export type { ExerciseDatasetRecord, VariationCandidate }
