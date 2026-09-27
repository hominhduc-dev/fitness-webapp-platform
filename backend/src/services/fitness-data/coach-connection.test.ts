import { CoachApprovalStatus, CoachRequestInitiator, CoachRequestStatus, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  requestCreate: vi.fn(),
  requestDeleteMany: vi.fn(),
  requestFindFirst: vi.fn(),
  requestFindUnique: vi.fn(),
  requestUpdate: vi.fn(),
  requestUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUniqueOrThrow: vi.fn(),
  userUpdate: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    coachRequest: {
      create: mocks.requestCreate,
      deleteMany: mocks.requestDeleteMany,
      findFirst: mocks.requestFindFirst,
      findUnique: mocks.requestFindUnique,
      update: mocks.requestUpdate,
      updateMany: mocks.requestUpdateMany,
    },
    user: { findFirst: mocks.userFindFirst, findUniqueOrThrow: mocks.userFindUniqueOrThrow, update: mocks.userUpdate },
  }
  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})
vi.mock("../notifications/notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createAndPushNotification: mocks.notify,
}))
vi.mock("../auth.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  invalidateProfileContextCache: vi.fn(),
}))

import {
  cancelCoachRequest,
  createCoachRequestForTrainee,
  inviteTraineeForCoach,
  respondToCoachInvite,
  updateCoachRequestStatus,
} from "./core"

const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const TRAINEE_ID = "00000000-0000-4000-8000-0000000000a0"
const REQUEST_ID = "00000000-0000-4000-8000-0000000000r1"

const coach = { id: COACH_ID, name: "Coach Khoa", role: UserRole.coach } as SerializedProfile
const trainee = { coachId: null, id: TRAINEE_ID, name: "Minh Duc", role: UserRole.trainee } as unknown as SerializedProfile
const traineeSummary = { avatar: null, email: "minh@example.com", fitnessGoals: [], id: TRAINEE_ID, name: "Minh Duc" }

const pending = (initiatedBy: CoachRequestInitiator) => ({
  coachId: COACH_ID,
  createdAt: new Date("2026-09-27T01:00:00Z"),
  id: REQUEST_ID,
  initiatedBy,
  status: CoachRequestStatus.pending,
  traineeId: TRAINEE_ID,
})

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.userFindUniqueOrThrow.mockResolvedValue({ coachId: null })
  mocks.requestUpdate.mockImplementation(async ({ data }: { data: object }) => ({
    ...pending(CoachRequestInitiator.trainee),
    ...data,
    trainee: traineeSummary,
  }))
})

describe("coach answering a request", () => {
  it("refuses to let a coach accept their own invitation", async () => {
    mocks.requestFindFirst.mockResolvedValue(pending(CoachRequestInitiator.coach))

    await expect(updateCoachRequestStatus(coach, REQUEST_ID, CoachRequestStatus.approved)).rejects.toMatchObject({ status: 403 })
    expect(mocks.userUpdate).not.toHaveBeenCalled()
  })

  it("connects on a trainee's request, closes their other requests and tells the trainee", async () => {
    mocks.requestFindFirst.mockResolvedValue(pending(CoachRequestInitiator.trainee))

    await updateCoachRequestStatus(coach, REQUEST_ID, CoachRequestStatus.approved)

    expect(mocks.userUpdate).toHaveBeenCalledWith({ data: { coachId: COACH_ID }, where: { id: TRAINEE_ID } })
    expect(mocks.requestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: CoachRequestStatus.rejected },
      where: expect.objectContaining({ id: { not: REQUEST_ID }, traineeId: TRAINEE_ID }),
    }))
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ accepterName: "Coach Khoa", kind: "coach_connection_accepted", opener: "trainee" }),
      userId: TRAINEE_ID,
    }))
  })
})

describe("trainee answering an invitation", () => {
  it("connects and tells the coach who invited", async () => {
    mocks.requestFindFirst.mockResolvedValue(pending(CoachRequestInitiator.coach))

    await respondToCoachInvite(trainee, REQUEST_ID, CoachRequestStatus.approved)

    expect(mocks.requestFindFirst).toHaveBeenCalledWith({
      where: { id: REQUEST_ID, initiatedBy: CoachRequestInitiator.coach, traineeId: TRAINEE_ID },
    })
    expect(mocks.userUpdate).toHaveBeenCalledWith({ data: { coachId: COACH_ID }, where: { id: TRAINEE_ID } })
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ kind: "coach_connection_accepted", opener: "coach" }),
      userId: COACH_ID,
    }))
  })

  it("finds nothing to answer on a request the trainee sent", async () => {
    mocks.requestFindFirst.mockResolvedValue(null)

    await expect(respondToCoachInvite(trainee, REQUEST_ID, CoachRequestStatus.approved)).rejects.toMatchObject({ status: 404 })
  })
})

describe("opening a request", () => {
  it("only lets a trainee ask an approved, active coach", async () => {
    mocks.userFindFirst.mockResolvedValue(null)

    await expect(createCoachRequestForTrainee(trainee, COACH_ID)).rejects.toMatchObject({ status: 404 })
    expect(mocks.userFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ coachApprovalStatus: CoachApprovalStatus.approved, isActive: true }),
    })
  })

  it("records a trainee request and tells the coach", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: COACH_ID })
    mocks.requestFindUnique.mockResolvedValue(null)
    mocks.requestCreate.mockResolvedValue(pending(CoachRequestInitiator.trainee))

    await createCoachRequestForTrainee(trainee, COACH_ID)

    expect(mocks.requestCreate).toHaveBeenCalledWith({
      data: { coachId: COACH_ID, initiatedBy: CoachRequestInitiator.trainee, traineeId: TRAINEE_ID },
    })
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ kind: "coach_request_received", requesterName: "Minh Duc" }),
      userId: COACH_ID,
    }))
  })

  it("connects straight away when a trainee asks the coach who already invited them", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: COACH_ID })
    mocks.requestFindUnique.mockResolvedValue(pending(CoachRequestInitiator.coach))

    const { request } = await createCoachRequestForTrainee(trainee, COACH_ID)

    expect(request.requestStatus).toBe(CoachRequestStatus.approved)
    expect(mocks.userUpdate).toHaveBeenCalledWith({ data: { coachId: COACH_ID }, where: { id: TRAINEE_ID } })
    expect(mocks.requestCreate).not.toHaveBeenCalled()
  })

  it("marks a coach invite as the coach's and tells the trainee", async () => {
    mocks.userFindFirst.mockResolvedValue({ coachId: null, id: TRAINEE_ID })
    mocks.requestFindUnique.mockResolvedValue(null)
    mocks.requestCreate.mockResolvedValue({ ...pending(CoachRequestInitiator.coach), trainee: traineeSummary })

    await inviteTraineeForCoach(coach, "minh@example.com")

    expect(mocks.requestCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: { coachId: COACH_ID, initiatedBy: CoachRequestInitiator.coach, traineeId: TRAINEE_ID },
    }))
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ kind: "coach_invite_received", requesterName: "Coach Khoa" }),
      userId: TRAINEE_ID,
    }))
  })
})

describe("withdrawing", () => {
  it("lets a coach cancel only invitations they sent", async () => {
    mocks.requestDeleteMany.mockResolvedValue({ count: 1 })

    await cancelCoachRequest(coach, REQUEST_ID)

    expect(mocks.requestDeleteMany).toHaveBeenCalledWith({
      where: { coachId: COACH_ID, id: REQUEST_ID, initiatedBy: CoachRequestInitiator.coach, status: CoachRequestStatus.pending },
    })
  })

  it("reports when there is nothing of theirs to cancel", async () => {
    mocks.requestDeleteMany.mockResolvedValue({ count: 0 })

    await expect(cancelCoachRequest(trainee, REQUEST_ID)).rejects.toMatchObject({ status: 404 })
  })
})
