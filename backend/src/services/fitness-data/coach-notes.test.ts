import { UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  noteCreate: vi.fn(),
  noteDelete: vi.fn(),
  noteFindFirst: vi.fn(),
  noteUpdate: vi.fn(),
  userFindFirst: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    coachNote: { create: mocks.noteCreate, delete: mocks.noteDelete, findFirst: mocks.noteFindFirst, update: mocks.noteUpdate },
    user: { findFirst: mocks.userFindFirst },
  },
}))

import { createCoachNote, deleteCoachNote, updateCoachNote } from "./coach-notes"

const coach = { id: "coach-1", name: "Thành Huỳnh", role: UserRole.coach } as SerializedProfile
const trainee = { id: "trainee-1", name: "Linh", role: UserRole.trainee } as SerializedProfile
const stored = { body: "Deload next week", createdAt: new Date("2026-10-01T08:00:00Z"), id: "note-1", updatedAt: new Date("2026-10-01T08:00:00Z") }

describe("coach notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes a note for the coach's own trainee, signed with the coach's name", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "trainee-1" })
    mocks.noteCreate.mockResolvedValue(stored)

    const note = await createCoachNote(coach, "trainee-1", "Deload next week")

    expect(mocks.userFindFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ coachId: "coach-1", id: "trainee-1" }) })
    expect(mocks.noteCreate.mock.calls[0][0].data).toEqual({ body: "Deload next week", coachId: "coach-1", traineeId: "trainee-1" })
    expect(note).toEqual({ body: "Deload next week", coachName: "Thành Huỳnh", createdAt: "2026-10-01T08:00:00.000Z", id: "note-1", updatedAt: "2026-10-01T08:00:00.000Z" })
  })

  it("refuses a trainee who is not the coach's", async () => {
    mocks.userFindFirst.mockResolvedValue(null)

    await expect(createCoachNote(coach, "someone-else", "Hi")).rejects.toThrow()
    expect(mocks.noteCreate).not.toHaveBeenCalled()
  })

  it("only touches the coach's own note about that trainee", async () => {
    mocks.noteFindFirst.mockResolvedValue(null)

    await expect(updateCoachNote(coach, "trainee-1", "note-1", "Edited")).rejects.toThrow(/Không tìm thấy ghi chú/)
    await expect(deleteCoachNote(coach, "trainee-1", "note-1")).rejects.toThrow(/Không tìm thấy ghi chú/)
    expect(mocks.noteFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { coachId: "coach-1", id: "note-1", traineeId: "trainee-1" } }))
    expect(mocks.noteUpdate).not.toHaveBeenCalled()
    expect(mocks.noteDelete).not.toHaveBeenCalled()
  })

  it("is for coaches only", async () => {
    await expect(createCoachNote(trainee, "trainee-1", "Hi")).rejects.toThrow()
    expect(mocks.noteCreate).not.toHaveBeenCalled()
  })
})
