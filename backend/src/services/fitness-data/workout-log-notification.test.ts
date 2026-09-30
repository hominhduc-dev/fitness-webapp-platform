import { NotificationType, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  logCreate: vi.fn(),
  notificationCreate: vi.fn(),
  queuePush: vi.fn(),
  workoutFindFirst: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    notification: { create: mocks.notificationCreate },
    traineeExerciseOverride: { findMany: vi.fn(async () => []) },
    workout: { findFirst: mocks.workoutFindFirst },
    workoutLog: { create: mocks.logCreate, findUnique: vi.fn(async () => null) },
  }

  return { prisma: db, retryTransaction: (fn: () => Promise<unknown>) => fn() }
})

vi.mock("../notifications/notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queuePushForNotifications: mocks.queuePush,
}))

import { createWorkoutLogForTrainee } from "./core"

const TRAINEE_ID = "00000000-0000-4000-8000-0000000000a0"
const COACH_ID = "00000000-0000-4000-8000-0000000000c0"
const WORKOUT_ID = "00000000-0000-4000-8000-0000000000c1"
const LOG_ID = "00000000-0000-4000-8000-0000000000f1"

const trainee = { coachId: COACH_ID, id: TRAINEE_ID, name: "Minh Duc", role: UserRole.trainee } as SerializedProfile

describe("the coach's notice of a finished workout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workoutFindFirst.mockResolvedValue({
      duration: null,
      exercises: [],
      id: WORKOUT_ID,
      kind: null,
      name: "Day 3",
      notes: null,
      program: null,
      programId: null,
      scheduledDate: null,
      scheduledDay: 3,
      weekIndex: 0,
    })
    const now = new Date("2026-09-30T10:00:00.000Z")
    mocks.logCreate.mockResolvedValue({
      comments: [],
      completedAt: now,
      createdAt: now,
      exerciseSnapshot: [],
      id: LOG_ID,
      notes: null,
      plannedDate: now,
      programId: null,
      startedAt: now,
      totalVolume: 0,
      updatedAt: now,
      userId: TRAINEE_ID,
      workoutId: WORKOUT_ID,
      workoutSnapshot: { name: "Day 3" },
    })
    mocks.notificationCreate.mockResolvedValue({ id: "logged-notification" })
  })

  it("is pushed to the coach's devices and opens the trainee", async () => {
    await createWorkoutLogForTrainee(trainee, WORKOUT_ID, { exercises: [] })
    // The notice is sent after the response, so let it settle.
    await vi.waitFor(() => expect(mocks.queuePush).toHaveBeenCalled())

    expect(mocks.queuePush).toHaveBeenCalledWith([{ id: "logged-notification" }])
    expect(mocks.notificationCreate.mock.calls[0][0].data).toMatchObject({
      metadata: { traineeId: TRAINEE_ID, url: `/coach/trainees/${TRAINEE_ID}`, workoutName: "Day 3" },
      type: NotificationType.workout_logged,
      userId: COACH_ID,
    })
  })
})
