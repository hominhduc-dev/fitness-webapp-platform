import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  assignmentFindFirst: vi.fn(),
  assignmentFindUnique: vi.fn(),
  generationUpdateMany: vi.fn(),
  programCreate: vi.fn(),
  programFindFirst: vi.fn(),
  userCount: vi.fn(),
  userFindFirst: vi.fn(),
  variationCount: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    aIGeneration: { updateMany: mocks.generationUpdateMany },
    program: { create: mocks.programCreate, findFirst: mocks.programFindFirst },
    programAssignment: { findFirst: mocks.assignmentFindFirst, findUnique: mocks.assignmentFindUnique },
    user: { count: mocks.userCount, findFirst: mocks.userFindFirst },
    variation: { count: mocks.variationCount },
  }
  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})

import { assignCoachProgramToTrainee, createCoachProgram } from "./core"

const coach = { id: "coach-1", name: "Coach", role: UserRole.coach } as SerializedProfile

describe("a program belongs to one trainee", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuses to create a program for two trainees", async () => {
    await expect(createCoachProgram(coach, {
      assignToUserIds: ["trainee-1", "trainee-2"],
      difficulty: "intermediate",
      duration: 4,
      name: "Meso 4",
      workouts: [{ exercises: [{ reps: 8, sets: 3, variationId: "v1" }], name: "Day 1" }],
    })).rejects.toThrow(/một học viên/)
  })

  it("refuses a second trainee on a program that already has one, Sheets or not", async () => {
    mocks.programFindFirst.mockResolvedValue({ archivedAt: null, googleSpreadsheetId: null, id: "program-1" })
    mocks.userFindFirst.mockResolvedValue({ id: "trainee-2" })
    mocks.assignmentFindFirst.mockResolvedValue({ user: { name: "Linh" } })

    await expect(assignCoachProgramToTrainee(coach, "program-1", "trainee-2")).rejects.toThrow(/đang gán cho Linh/)
    expect(mocks.assignmentFindUnique).not.toHaveBeenCalled()
  })
})

describe("saving a program edited from an AI draft", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userCount.mockResolvedValue(1)
    mocks.variationCount.mockResolvedValue(1)
  })

  it("claims the draft before writing, and refuses one already used", async () => {
    mocks.generationUpdateMany.mockResolvedValue({ count: 0 })

    await expect(createCoachProgram(coach, {
      aiGenerationId: "generation-1",
      assignToUserIds: ["trainee-1"],
      difficulty: "intermediate",
      duration: 4,
      name: "AI meso",
      workouts: [{ exercises: [{ reps: 8, sets: 3, variationId: "v1" }], name: "Day 1" }],
    })).rejects.toMatchObject({ code: "AI_ALREADY_ACCEPTED" })

    // Only a draft of this coach's, still waiting, can be claimed.
    expect(mocks.generationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "generation-1", status: "completed", userId: "coach-1" }),
    }))
    expect(mocks.programCreate).not.toHaveBeenCalled()
  })
})
