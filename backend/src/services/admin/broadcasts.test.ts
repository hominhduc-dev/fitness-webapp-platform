import { PushDeliveryStatus, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  broadcastCreate: vi.fn(),
  broadcastFindMany: vi.fn(),
  notificationCreateMany: vi.fn(),
  notificationFindMany: vi.fn(),
  queuePush: vi.fn(),
  userFindMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    adminAuditLog: { create: mocks.auditCreate },
    adminBroadcast: { create: mocks.broadcastCreate, findMany: mocks.broadcastFindMany },
    notification: { createManyAndReturn: mocks.notificationCreateMany, findMany: mocks.notificationFindMany },
    user: { findMany: mocks.userFindMany },
  },
}))
vi.mock("../notifications/notification-dispatch.service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  queuePushForNotifications: mocks.queuePush,
}))

import { listAdminBroadcasts, sendAdminBroadcast } from "./broadcasts"

const admin = { id: "admin-1", name: "Admin", role: UserRole.admin } as SerializedProfile
const coach = { id: "coach-1", name: "Coach", role: UserRole.coach } as SerializedProfile

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.notificationCreateMany.mockImplementation(async ({ data }: { data: unknown[] }) => data)
})

describe("sendAdminBroadcast", () => {
  it("sends every active trainee and coach a copy that links back to the broadcast", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }])
    mocks.broadcastCreate.mockResolvedValue({ id: "b1" })

    const result = await sendAdminBroadcast(admin, { message: "  Vuốt để hoàn tất buổi tập.  ", target: "/workout", title: "Cập nhật mới" })

    expect(result).toEqual({ id: "b1", recipientCount: 2 })
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      select: { id: true },
      where: { isActive: true, role: { in: [UserRole.trainee, UserRole.coach] } },
    })
    expect(mocks.broadcastCreate).toHaveBeenCalledWith({
      data: { adminId: "admin-1", message: "Vuốt để hoàn tất buổi tập.", recipientCount: 2, title: "Cập nhật mới", url: "/workout" },
    })
    const [{ data }] = mocks.notificationCreateMany.mock.calls[0]
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ relatedEntityId: "b1", relatedEntityType: "admin_broadcast", title: "Cập nhật mới", userId: "u1" })
    expect(data[0].metadata).toMatchObject({ kind: "admin_broadcast", url: "/workout" })
    expect(mocks.queuePush).toHaveBeenCalledWith(data)
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "notification.broadcast", entityId: "b1" }),
    }))
  })

  it("links to the app root when no page is chosen", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "u1" }])
    mocks.broadcastCreate.mockResolvedValue({ id: "b2" })

    await sendAdminBroadcast(admin, { message: "Bảo trì 23:00", title: "Bảo trì" })

    const [{ data }] = mocks.notificationCreateMany.mock.calls[0]
    expect(data[0].metadata.url).toBe("/")
  })

  it("refuses anyone but an admin", async () => {
    await expect(sendAdminBroadcast(coach, { message: "x", title: "x" })).rejects.toMatchObject({ status: 403 })
    expect(mocks.broadcastCreate).not.toHaveBeenCalled()
  })
})

describe("listAdminBroadcasts", () => {
  it("counts reads and push outcomes per broadcast", async () => {
    mocks.broadcastFindMany.mockResolvedValue([
      { admin: { name: "Admin" }, createdAt: new Date("2026-09-27T02:00:00Z"), id: "b1", message: "m", recipientCount: 3, title: "t", url: null },
    ])
    mocks.notificationFindMany.mockResolvedValue([
      { pushDeliveries: [{ status: PushDeliveryStatus.sent }, { status: PushDeliveryStatus.failed }], readAt: new Date(), relatedEntityId: "b1" },
      { pushDeliveries: [{ status: PushDeliveryStatus.retrying }], readAt: null, relatedEntityId: "b1" },
      { pushDeliveries: [], readAt: new Date(), relatedEntityId: "b1" },
    ])

    const [broadcast] = await listAdminBroadcasts(admin)

    expect(broadcast).toMatchObject({ push: { failed: 1, pending: 1, sent: 1 }, read: 2, recipientCount: 3, sentBy: "Admin" })
  })
})
