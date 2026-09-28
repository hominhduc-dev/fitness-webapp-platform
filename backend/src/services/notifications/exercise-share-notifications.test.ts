import { ExerciseShareStatus, NotificationType, UserRole, type Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createManyAndReturn: vi.fn(),
  exerciseCount: vi.fn(),
  findMany: vi.fn(),
  queuePush: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    exercise: { count: mocks.exerciseCount },
    notification: { createManyAndReturn: mocks.createManyAndReturn },
    user: { findMany: mocks.findMany },
  },
}))
vi.mock("./notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queuePushForNotifications: mocks.queuePush,
}))

import { buildExerciseShareReviewedDraft, notifyAdminsOfExerciseShare } from "./exercise-share-notifications"
import { localizedNotificationCopy } from "./localized-push"
import { notificationPushTag } from "./push-delivery.service"

const exercise = { id: "00000000-0000-4000-8000-0000000000e1", name: "Tempo Hack Squat" }

describe("notifyAdminsOfExerciseShare", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.createManyAndReturn.mockImplementation(async ({ data }: { data: unknown[] }) => data)
  })

  it("tells every active admin, linking to the exercise and counting the queue", async () => {
    mocks.findMany.mockResolvedValue([{ id: "admin-1" }])
    mocks.exerciseCount.mockResolvedValue(3)

    await notifyAdminsOfExerciseShare({ coachName: "Coach Khoa", exercises: [exercise] })

    expect(mocks.findMany).toHaveBeenCalledWith({ select: { id: true }, where: { isActive: true, role: UserRole.admin } })
    expect(mocks.exerciseCount).toHaveBeenCalledWith({ where: { shareStatus: ExerciseShareStatus.pending } })
    const [{ data }] = mocks.createManyAndReturn.mock.calls[0]
    expect(data[0]).toMatchObject({
      message: "Coach Khoa suggested Tempo Hack Squat for the shared library. 2 more are waiting.",
      userId: "admin-1",
    })
    expect(data[0].metadata).toMatchObject({ kind: "exercise_share_pending", url: `/admin?s=exercises&share=${exercise.id}` })
    expect(mocks.queuePush).toHaveBeenCalledWith(data)
  })

  it("sends nothing for an import that created nothing", async () => {
    await notifyAdminsOfExerciseShare({ coachName: "Coach Khoa", exercises: [] })

    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it("never fails the save that triggered it", async () => {
    mocks.findMany.mockRejectedValue(new Error("db down"))
    mocks.exerciseCount.mockResolvedValue(1)

    await expect(notifyAdminsOfExerciseShare({ coachName: "Coach Khoa", exercises: [exercise] })).resolves.toBeUndefined()
  })
})

describe("exercise share notices", () => {
  it("keeps one pending-review notice per admin device", () => {
    const tag = (id: string) =>
      notificationPushTag({ id, metadata: { kind: "exercise_share_pending" }, relatedEntityId: null, type: NotificationType.general })

    expect(tag("n1")).toBe("exercise-shares")
    expect(tag("n2")).toBe(tag("n1"))
  })

  it("tells the coach about a merge in their language", () => {
    const draft = buildExerciseShareReviewedDraft({
      coachId: "coach-1",
      decision: "merged",
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetName: "Hack Squat",
    })
    const notification = { message: draft.message, metadata: draft.metadata as Prisma.JsonObject, title: draft.title, type: draft.type }

    expect(localizedNotificationCopy(notification, "vi")).toEqual({
      body: "Tempo Hack Squat đã được gộp vào Hack Squat; giáo án của bạn giờ dùng bài đó.",
      title: "Bài tập đã được dùng chung",
    })
    expect(localizedNotificationCopy(notification, "en").body).toBe(
      "Tempo Hack Squat was merged into Hack Squat; your programs now use it.",
    )
  })

  it("passes an admin's note on a declined exercise to the coach", () => {
    const draft = buildExerciseShareReviewedDraft({
      coachId: "coach-1",
      decision: "rejected",
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      note: "Trùng Hack Squat",
    })
    const notification = { message: draft.message, metadata: draft.metadata as Prisma.JsonObject, title: draft.title, type: draft.type }

    expect(localizedNotificationCopy(notification, "vi")).toEqual({
      body: "Tempo Hack Squat vẫn nằm trong thư viện riêng của bạn. Ghi chú: Trùng Hack Squat",
      title: "Bài tập chưa được dùng chung",
    })
  })
})
