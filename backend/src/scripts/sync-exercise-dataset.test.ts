import type { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { EXERCISE_DATASET_SOURCE, exerciseDatasetRecordSchema } from "../domain/exercise-dataset"
import { buildSyncPlan } from "./sync-exercise-dataset"

const languages = { en: "x", es: "x", it: "x", tr: "x", ru: "x", zh: "x", hi: "x", pl: "x", ko: "x", fr: "x" }
const steps = Object.fromEntries(Object.keys(languages).map((language) => [language, ["x"]]))

function datasetRecord(id = "0001", name = "Row") {
  return exerciseDatasetRecordSchema.parse({
    attribution: "© Gym visual", body_part: "back", category: "back", created_at: "2026-01-01T00:00:00Z",
    equipment: "barbell", gif_url: `videos/${id}-media.gif`, id, image: `images/${id}-media.jpg`,
    instruction_steps: steps, instructions: languages, media_id: "media", muscle_group: "back",
    name, secondary_muscles: [], target: "lats",
  })
}

type ExerciseFixture = Prisma.ExerciseGetPayload<{ include: { variations: true } }>

function exercise(id: string, name: string, createdById: string | null, variations: Array<Record<string, unknown>> = []): ExerciseFixture {
  return {
    createdAt: new Date(), createdById, id, muscleGroup: "Back", name, updatedAt: new Date(),
    variations: variations.map((variation, index) => ({
      activityType: null, createdAt: new Date(), equipment: null, exerciseId: id, id: `${id}-v${index}`,
      isDefault: index === 0, metadata: null, muscleProfileConfidence: null, muscleProfileRationale: null,
      muscleProfileReviewedAt: null, muscleProfileReviewedById: null, muscleProfileSource: null,
      muscleProfileStatus: "pending", name: "Default", sortOrder: index, source: null, sourceId: null,
      updatedAt: new Date(), ...variation,
    })),
  }
}

describe("exercise dataset sync planning", () => {
  it("enriches a matching system exercise but never a coach exercise", () => {
    const systemPlan = buildSyncPlan([datasetRecord()], [exercise("system", " row ", null, [{}])])
    expect(systemPlan.metrics).toMatchObject({ createExercises: 0, enrichVariations: 1, systemMatches: 1 })

    const coachPlan = buildSyncPlan([datasetRecord()], [exercise("coach", "ROW", "coach-id", [{}])])
    expect(coachPlan.metrics).toMatchObject({ coachOnlyMatches: 1, createExercises: 1, createVariations: 1 })
  })

  it("plans an idempotent source update on rerun", () => {
    const existing = exercise("system", "Different display name", null, [{
      id: "sourced", source: EXERCISE_DATASET_SOURCE, sourceId: "0001",
    }])
    const plan = buildSyncPlan([datasetRecord()], [existing])
    expect(plan.metrics).toMatchObject({ createExercises: 0, createVariations: 0, enrichVariations: 0, sourceUpdates: 1 })
    expect(plan.conflicts).toEqual([])
  })

  it("creates two variations for a duplicate-name source group", () => {
    const plan = buildSyncPlan([datasetRecord("0002", "Same name"), datasetRecord("0001", " same  name ")], [])
    expect(plan.metrics).toMatchObject({ createExercises: 1, createVariations: 2, datasetDuplicateGroups: 1 })
    expect(plan.newExerciseActions[0].records.map((record) => record.id)).toEqual(["0001", "0002"])
  })
})
