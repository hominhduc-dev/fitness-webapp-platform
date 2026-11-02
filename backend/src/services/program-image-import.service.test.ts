import { ExerciseShareStatus, UserRole } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "./auth.service"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  importProgramFromImages: vi.fn(),
}))

vi.mock("./fitness-data/shared/guards", () => ({
  assertCoach: vi.fn(),
  ensurePrisma: () => ({ exercise: { findMany: mocks.findMany } }),
}))
vi.mock("../lib/ai/ai-client", () => ({ getAIProvider: () => ({}) }))
vi.mock("./ai/program-image-import", () => ({ importProgramFromImages: mocks.importProgramFromImages }))

import { importCoachProgramFromImages } from "./program-image-import.service"

const coach = { id: "coach-1", role: UserRole.coach } as SerializedProfile

describe("importCoachProgramFromImages", () => {
  it("matches against everything the coach's exercise picker shows, by its display names", async () => {
    mocks.findMany.mockResolvedValue([
      {
        name: "Cable Chest Fly",
        variations: [{ displayMetadata: null, equipment: "Cable", id: "v-fly", isDefault: false, name: "High to Low" }],
      },
    ])
    mocks.importProgramFromImages.mockResolvedValue({
      programName: null,
      promptVersion: "x",
      tokenUsage: 1,
      unmatchedCount: 0,
      workouts: [{ exercises: [], name: "Buổi 1", scheduledDay: 1 }],
    })

    await importCoachProgramFromImages(coach, { images: [{ data: "abc", mediaType: "image/jpeg" }] })

    // Shared exercises from other coaches are in the picker, so they must be matchable too.
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ createdById: null }, { shareStatus: ExerciseShareStatus.shared }, { createdById: "coach-1" }],
    })
    const { library } = mocks.importProgramFromImages.mock.calls[0][1]
    expect(library).toEqual([
      expect.objectContaining({ displayName: "High to Low Cable Chest Fly", exerciseName: "Cable Chest Fly", variationId: "v-fly" }),
    ])
  })
})
