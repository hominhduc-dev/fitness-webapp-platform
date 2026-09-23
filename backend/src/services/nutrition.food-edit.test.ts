import { FoodReviewStatus, FoodSource } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SerializedProfile } from "./auth.service"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  notificationCreateMany: vi.fn(),
  update: vi.fn(),
  userFindMany: vi.fn(),
}))

vi.mock("../lib/prisma", () => {
  const db = {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
    food: { findFirst: mocks.findFirst, update: mocks.update },
    notification: { createMany: mocks.notificationCreateMany },
    user: { findMany: mocks.userFindMany },
  }
  return { prisma: db }
})

import { updateFoodForUser } from "./nutrition.service"

const owner = { id: "00000000-0000-4000-8000-000000000002", name: "Trainee" } as SerializedProfile
const foodId = "00000000-0000-4000-8000-000000000003"
const edit = { calories: 300, carbs: 40, category: "dish", fat: 8, name: "Bún riêu", protein: 18, servingLabel: "1 tô (500 g)" }

describe("owner editing a custom food", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }])
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: foodId,
      slug: "user-x-bun-rieu",
      ...data,
    }))
  })

  it("saves the corrected numbers and sends the food back for review", async () => {
    mocks.findFirst.mockResolvedValue({ reviewStatus: FoodReviewStatus.pending })

    const food = await updateFoodForUser(owner, foodId, edit)

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdById: owner.id, id: foodId, source: FoodSource.user },
    }))
    expect(food).toMatchObject({ calories: 300, name: "Bún riêu", reviewStatus: FoodReviewStatus.pending, servingAmount: 500, servingUnit: "g" })
    // Already in the admins' queue, so no second notification.
    expect(mocks.notificationCreateMany).not.toHaveBeenCalled()
  })

  it("clears a rejection and tells the admins it was resubmitted", async () => {
    mocks.findFirst.mockResolvedValue({ reviewStatus: FoodReviewStatus.rejected })

    await updateFoodForUser(owner, foodId, edit)

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewNote: null, reviewStatus: FoodReviewStatus.pending }),
    }))
    expect(mocks.notificationCreateMany).toHaveBeenCalledTimes(1)
  })

  it("does not reach foods the caller does not own or that are already approved", async () => {
    mocks.findFirst.mockResolvedValue(null)

    await expect(updateFoodForUser(owner, foodId, edit)).rejects.toMatchObject({ status: 404 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
