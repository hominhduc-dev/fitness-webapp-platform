import { FoodReviewStatus, FoodSource, UserRole } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "../auth.service"

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  notificationCreate: vi.fn(),
  update: vi.fn(),
}))

vi.mock("../../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    adminAuditLog: { create: mocks.auditCreate },
    food: { findFirst: mocks.findFirst, findMany: mocks.findMany, update: mocks.update },
    notification: { create: mocks.notificationCreate },
  }

  return { prisma: db }
})

import { listAdminCustomFoods, reviewAdminCustomFood } from "./foods"

const admin = { id: "00000000-0000-4000-8000-000000000001", name: "Admin", role: UserRole.admin } as SerializedProfile
const creator = { email: "trainee@example.com", id: "00000000-0000-4000-8000-000000000002", name: "Trainee" }
const food = {
  calories: 420,
  carbs: 50,
  category: "dish",
  createdAt: new Date("2026-09-20T00:00:00.000Z"),
  createdBy: creator,
  fat: 12,
  id: "00000000-0000-4000-8000-000000000003",
  name: "Cơm nhà",
  protein: 20,
  reviewNote: null,
  reviewedAt: null,
  reviewedBy: null,
  reviewStatus: FoodReviewStatus.pending,
  servingAmount: 1,
  servingLabel: "1 phần",
  servingUnit: "serving",
  source: FoodSource.user,
  updatedAt: new Date("2026-09-20T00:00:00.000Z"),
}

describe("custom food moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditCreate.mockResolvedValue({})
    mocks.notificationCreate.mockResolvedValue({})
    mocks.findFirst.mockResolvedValue(food)
  })

  it("lists only creator-owned foods with the requested review status", async () => {
    mocks.findMany.mockResolvedValue([food])

    const result = await listAdminCustomFoods(admin, { search: "Cơm", status: "pending" })

    expect(result).toHaveLength(1)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdById: { not: null }, reviewStatus: FoodReviewStatus.pending }),
    }))
  })

  it("promotes an approved food into the system catalog and notifies its creator", async () => {
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...food,
      ...data,
      reviewedBy: { email: "admin@example.com", id: admin.id, name: admin.name },
    }))

    const result = await reviewAdminCustomFood(admin, food.id, { decision: "approved" })

    expect(result.source).toBe(FoodSource.system)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isVerified: true,
        reviewStatus: FoodReviewStatus.approved,
        source: FoodSource.system,
      }),
    }))
    expect(mocks.notificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: creator.id }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "food.approved", entityType: "food" }),
    }))
  })

  it("keeps a rejected food private and available for later resubmission", async () => {
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...food,
      ...data,
      reviewedBy: { email: "admin@example.com", id: admin.id, name: admin.name },
    }))

    const result = await reviewAdminCustomFood(admin, food.id, { decision: "rejected", reviewNote: "Thiếu khẩu phần" })

    expect(result.source).toBe(FoodSource.user)
    expect(result.reviewStatus).toBe(FoodReviewStatus.rejected)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isVerified: false, reviewNote: "Thiếu khẩu phần" }),
    }))
  })
})
