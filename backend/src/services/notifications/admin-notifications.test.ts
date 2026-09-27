import { NotificationType, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  createManyAndReturn: vi.fn(),
  findMany: vi.fn(),
  queuePush: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    notification: { createManyAndReturn: mocks.createManyAndReturn },
    user: { count: mocks.count, findMany: mocks.findMany },
  },
}))
vi.mock("./notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queuePushForNotifications: mocks.queuePush,
}))

import { notifyAdminsOfCoachSignup } from "./admin-notifications"
import { notificationPushTag } from "./push-delivery.service"

const applicant = { id: "00000000-0000-4000-8000-0000000000c1", name: "Trần Minh Khoa" }

describe("notifyAdminsOfCoachSignup", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset()
    mocks.createManyAndReturn.mockImplementation(async ({ data }: { data: unknown[] }) => data)
  })

  it("tells every active admin, with how many applications are waiting", async () => {
    mocks.findMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }])
    mocks.count.mockResolvedValue(3)

    await notifyAdminsOfCoachSignup(applicant)

    expect(mocks.findMany).toHaveBeenCalledWith({ select: { id: true }, where: { isActive: true, role: UserRole.admin } })
    const [{ data }] = mocks.createManyAndReturn.mock.calls[0]
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      message: "Trần Minh Khoa applied to be a coach. 2 more are waiting.",
      type: NotificationType.general,
      userId: "admin-1",
    })
    expect(data[0].metadata).toMatchObject({
      applicantName: "Trần Minh Khoa",
      kind: "coach_signup_pending",
      pendingCount: 3,
      url: `/admin?s=coach-signups&user=${applicant.id}`,
    })
    expect(mocks.queuePush).toHaveBeenCalledWith(data)
  })

  it("does nothing without an active admin", async () => {
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(1)

    await notifyAdminsOfCoachSignup(applicant)

    expect(mocks.createManyAndReturn).not.toHaveBeenCalled()
  })

  it("never fails the sign-up that triggered it", async () => {
    mocks.findMany.mockRejectedValue(new Error("db down"))
    mocks.count.mockResolvedValue(1)

    await expect(notifyAdminsOfCoachSignup(applicant)).resolves.toBeUndefined()
  })
})

describe("coach signup push tag", () => {
  it("lets a newer application notice replace the last on the device", () => {
    const tag = (id: string) =>
      notificationPushTag({ id, metadata: { kind: "coach_signup_pending" }, relatedEntityId: null, type: NotificationType.general })

    expect(tag("n1")).toBe("coach-signups")
    expect(tag("n2")).toBe(tag("n1"))
    expect(notificationPushTag({ id: "n3", metadata: null, relatedEntityId: null, type: NotificationType.general })).toBe("notification:n3")
  })
})
