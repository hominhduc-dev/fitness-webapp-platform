import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  assignmentFindFirst: vi.fn(),
  assignmentFindUnique: vi.fn(),
  programFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    program: { findFirst: mocks.programFindFirst },
    programAssignment: { findFirst: mocks.assignmentFindFirst, findUnique: mocks.assignmentFindUnique },
    user: { findFirst: mocks.userFindFirst },
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
