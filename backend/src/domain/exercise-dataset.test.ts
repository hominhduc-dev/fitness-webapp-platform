import { describe, expect, it } from "vitest"

import {
  EXERCISE_DATASET_SOURCE,
  exerciseDatasetRecordSchema,
  groupDatasetRecords,
  mapBodyPartToMuscleGroup,
  mergeExerciseDatasetMetadata,
  normalizeExerciseName,
  selectVariation,
} from "./exercise-dataset"

const LANGUAGES = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"]

function record(overrides: Record<string, unknown> = {}) {
  return exerciseDatasetRecordSchema.parse({
    attribution: "© Gym visual",
    body_part: "chest",
    category: "chest",
    created_at: "2026-03-18T19:31:32.854798+07:00",
    equipment: "barbell",
    gif_url: "videos/0001-media.gif",
    id: "0001",
    image: "images/0001-media.jpg",
    instruction_steps: Object.fromEntries(LANGUAGES.map((language) => [language, ["Step"]])),
    instructions: Object.fromEntries(LANGUAGES.map((language) => [language, "Step"])),
    media_id: "media",
    muscle_group: "pectorals",
    name: "Bench Press",
    secondary_muscles: ["triceps"],
    target: "pectorals",
    ...overrides,
  })
}

describe("exercise dataset domain", () => {
  it("normalizes names with NFKC, whitespace collapse, trim and lowercase only", () => {
    expect(normalizeExerciseName("  Ｂench\t  Press! ")).toBe("bench press!")
    expect(normalizeExerciseName("Bench-Press")).not.toBe(normalizeExerciseName("Bench Press"))
  })

  it("maps every upstream body part to a canonical muscle group", () => {
    expect(mapBodyPartToMuscleGroup("lower arms")).toBe("Arms")
    expect(mapBodyPartToMuscleGroup("lower legs")).toBe("Calves")
    expect(mapBodyPartToMuscleGroup("waist")).toBe("Core")
    expect(mapBodyPartToMuscleGroup("neck")).toBe("Other")
  })

  it("selects source identity, then default, then equipment, then a sole variation", () => {
    const candidates = [
      { equipment: "cable", id: "a", isDefault: false, source: EXERCISE_DATASET_SOURCE, sourceId: "0001" },
      { equipment: "barbell", id: "b", isDefault: true, source: null, sourceId: null },
    ]
    expect(selectVariation(candidates, record())?.id).toBe("a")
    expect(selectVariation(candidates, record({ id: "0002" }))?.id).toBe("b")
    expect(selectVariation(candidates.map((candidate) => ({ ...candidate, isDefault: false, source: null, sourceId: null })), record())?.id).toBe("b")
  })

  it("returns a conflict for ambiguous candidates", () => {
    expect(selectVariation([
      { equipment: "barbell", id: "a", isDefault: false, source: null, sourceId: null },
      { equipment: "barbell", id: "b", isDefault: false, source: null, sourceId: null },
    ], record())).toBeUndefined()
  })

  it("groups duplicate names under one exercise in stable source-id order", () => {
    const groups = groupDatasetRecords([
      record({ id: "0002", name: " Same  Name " }),
      record({ id: "0001", name: "same name" }),
    ])
    expect(groups.size).toBe(1)
    expect([...groups.values()][0].map((item) => item.id)).toEqual(["0001", "0002"])
  })

  it("merges into a namespace without overwriting unrelated metadata", () => {
    const merged = mergeExerciseDatasetMetadata({ custom: { keep: true }, exerciseDataset: { keep: true } }, record(), "commit")
    expect((merged as Record<string, unknown>).custom).toEqual({ keep: true })
    expect((merged.exerciseDataset as Record<string, unknown>).keep).toBe(true)
    expect((merged.exerciseDataset as Record<string, unknown>).media).toEqual({
      animationObjectPath: "commit/videos/0001-media.gif",
      thumbnailObjectPath: "commit/images/0001-media.jpg",
    })
    expect(JSON.stringify(merged)).not.toContain("Gym visual")
  })
})
