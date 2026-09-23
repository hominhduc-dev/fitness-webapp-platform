import {
  FoodReviewStatus,
  FoodSource,
  NotificationStatus,
  NotificationType,
  UserRole,
  type Prisma,
} from "@prisma/client"

import { invalidateSystemFoodCatalog } from "../../lib/library-cache"
import type { SerializedProfile } from "../auth.service"
import { ConflictError, ForbiddenError, NotFoundError } from "../errors"
import { ensurePrisma } from "../fitness-data/shared/guards"
import { parseFoodDetails } from "../nutrition.service"

type CustomFoodReviewStatus = FoodReviewStatus | "all"

function assertAdmin(profile: SerializedProfile) {
  if (profile.role !== UserRole.admin) {
    throw new ForbiddenError("Chỉ admin mới có quyền duyệt món ăn.")
  }
}

function serializeCustomFood(food: {
  id: string
  name: string
  nameEn?: string | null
  category: string
  servingAmount: number
  servingUnit: string
  servingLabel: string
  calories: number
  protein: number | null
  carbs: number | null
  fat: number | null
  reviewStatus: FoodReviewStatus
  reviewNote: string | null
  source: FoodSource
  createdAt: Date
  updatedAt: Date
  reviewedAt: Date | null
  createdBy: { id: string; name: string; email: string } | null
  reviewedBy: { id: string; name: string; email: string } | null
}) {
  return {
    ...food,
    carbs: food.carbs ?? 0,
    fat: food.fat ?? 0,
    protein: food.protein ?? 0,
  }
}

async function listAdminCustomFoods(
  profile: SerializedProfile,
  options?: { search?: string; status?: CustomFoodReviewStatus },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const search = options?.search?.trim()

  const foods = await db.food.findMany({
    include: {
      createdBy: { select: { email: true, id: true, name: true } },
      reviewedBy: { select: { email: true, id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    where: {
      createdById: { not: null },
      ...(options?.status && options.status !== "all" ? { reviewStatus: options.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { createdBy: { email: { contains: search, mode: "insensitive" } } },
              { createdBy: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
  })

  return foods.map(serializeCustomFood)
}

async function reviewAdminCustomFood(
  profile: SerializedProfile,
  foodId: string,
  input: { decision: "approved" | "rejected"; reviewNote?: string },
) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const reviewedAt = new Date()
  const reviewNote = input.reviewNote?.trim() || null
  const reviewStatus = input.decision === "approved" ? FoodReviewStatus.approved : FoodReviewStatus.rejected
  const source = input.decision === "approved" ? FoodSource.system : FoodSource.user

  const result = await db.$transaction(async (tx) => {
    const current = await tx.food.findFirst({
      include: { createdBy: { select: { email: true, id: true, name: true } } },
      where: { createdById: { not: null }, id: foodId },
    })

    if (!current || !current.createdBy) {
      throw new NotFoundError("Không tìm thấy món ăn tuỳ chỉnh.")
    }

    const food = await tx.food.update({
      data: {
        isVerified: input.decision === "approved",
        reviewNote,
        reviewedAt,
        reviewedById: profile.id,
        reviewStatus,
        source,
      },
      include: {
        createdBy: { select: { email: true, id: true, name: true } },
        reviewedBy: { select: { email: true, id: true, name: true } },
      },
      where: { id: foodId },
    })

    await tx.adminAuditLog.create({
      data: {
        action: `food.${input.decision}`,
        adminId: profile.id,
        entityId: food.id,
        entityLabel: food.name,
        entityType: "food",
        metadata: { reviewNote, status: reviewStatus } as Prisma.InputJsonObject,
      },
    })

    await tx.notification.create({
      data: {
        channel: "in_app",
        message:
          input.decision === "approved"
            ? `Món “${food.name}” đã được duyệt và hiện có trong thư viện chung.`
            : `Món “${food.name}” chưa được duyệt.${reviewNote ? ` Lý do: ${reviewNote}` : " Bạn có thể chỉnh sửa và gửi lại."}`,
        metadata: { foodId: food.id, kind: "custom_food_review_result", url: "/meals" },
        relatedEntityId: food.id,
        relatedEntityType: "food_review",
        scheduledFor: reviewedAt,
        sentAt: reviewedAt,
        status: NotificationStatus.sent,
        title: input.decision === "approved" ? "Món ăn đã được duyệt" : "Món ăn cần chỉnh sửa",
        type: NotificationType.general,
        userId: current.createdBy.id,
      },
    })

    return food
  })

  invalidateSystemFoodCatalog()
  return serializeCustomFood(result)
}

/**
 * An admin correcting a submitted food before deciding on it — a typo in the
 * name, a serving without grams, macros that do not add up. Only foods still
 * waiting on a decision (pending or rejected) can change here; the review
 * status is left alone so approval stays a separate, deliberate step.
 */
async function updateAdminCustomFood(profile: SerializedProfile, foodId: string, input: Record<string, unknown>) {
  assertAdmin(profile)
  const db = ensurePrisma()
  const details = parseFoodDetails(input)

  const food = await db.$transaction(async (tx) => {
    const current = await tx.food.findFirst({ where: { createdById: { not: null }, id: foodId } })
    if (!current) {
      throw new NotFoundError("Không tìm thấy món ăn tuỳ chỉnh.")
    }
    if (current.source !== FoodSource.user) {
      throw new ConflictError("Món đã được duyệt vào thư viện chung, không sửa ở hàng chờ duyệt được nữa.")
    }

    const saved = await tx.food.update({
      data: details,
      include: {
        createdBy: { select: { email: true, id: true, name: true } },
        reviewedBy: { select: { email: true, id: true, name: true } },
      },
      where: { id: foodId },
    })

    const changed = (Object.keys(details) as Array<keyof typeof details>).filter((key) => current[key] !== saved[key])
    await tx.adminAuditLog.create({
      data: {
        action: "food.edited",
        adminId: profile.id,
        entityId: saved.id,
        entityLabel: saved.name,
        entityType: "food",
        metadata: {
          changed,
          before: Object.fromEntries(changed.map((key) => [key, current[key]])),
        } as Prisma.InputJsonObject,
      },
    })

    return saved
  })

  return serializeCustomFood(food)
}

export { listAdminCustomFoods, reviewAdminCustomFood, updateAdminCustomFood }
