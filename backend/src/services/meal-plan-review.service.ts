import { MealStatus, NotificationStatus, NotificationType } from "@prisma/client"

import { dateKeyInstant } from "../lib/ai/calendar"
import type { SerializedProfile } from "./auth.service"
import { NotFoundError } from "./errors"
import { assertCoach, assertCoachOwnsTrainee, ensurePrisma } from "./fitness-data/shared/guards"
import { deleteMealItemForOwner, listNutritionDayForUser, updateMealItemAmountForOwner } from "./nutrition.service"

/**
 * Coach review of a trainee's planned meals. Coaches may adjust or remove
 * planned items and leave a note; consumed meals stay the trainee's own record.
 */

async function requireCoachTrainee(coach: SerializedProfile, traineeId: string) {
  assertCoach(coach)
  return assertCoachOwnsTrainee(coach.id, traineeId)
}

async function getTraineeMealPlanForCoach(coach: SerializedProfile, traineeId: string, date: string) {
  const trainee = await requireCoachTrainee(coach, traineeId)
  return listNutritionDayForUser(trainee, date)
}

async function updateTraineePlannedItemForCoach(coach: SerializedProfile, traineeId: string, itemId: string, amountValue: number) {
  await requireCoachTrainee(coach, traineeId)
  return updateMealItemAmountForOwner(traineeId, itemId, amountValue, { plannedOnly: true })
}

async function deleteTraineePlannedItemForCoach(coach: SerializedProfile, traineeId: string, itemId: string) {
  await requireCoachTrainee(coach, traineeId)
  return deleteMealItemForOwner(traineeId, itemId, { plannedOnly: true })
}

async function reviewTraineeMealPlanForCoach(coach: SerializedProfile, traineeId: string, date: string, note?: string) {
  const trainee = await requireCoachTrainee(coach, traineeId)
  const db = ensurePrisma()
  const reviewedAt = new Date()
  const coachNote = note?.trim() || null

  await db.$transaction(async (tx) => {
    const { count } = await tx.meal.updateMany({
      data: { coachNote, coachReviewedAt: reviewedAt },
      where: { loggedDate: dateKeyInstant(date), status: MealStatus.planned, userId: trainee.id },
    })

    if (count === 0) {
      throw new NotFoundError("Trainee chưa có thực đơn dự kiến cho ngày này.")
    }

    await tx.notification.create({
      data: {
        channel: "in_app",
        message: coachNote ? `${coach.name}: ${coachNote}` : `${coach.name} đã duyệt thực đơn ngày ${date}.`,
        metadata: { coachId: coach.id, date, kind: "meal_plan_reviewed" },
        relatedEntityType: "meal_plan",
        scheduledFor: reviewedAt,
        sentAt: reviewedAt,
        status: NotificationStatus.sent,
        title: "Coach đã duyệt thực đơn",
        type: NotificationType.general,
        userId: trainee.id,
      },
    })
  })

  return listNutritionDayForUser(trainee, date)
}

export {
  deleteTraineePlannedItemForCoach,
  getTraineeMealPlanForCoach,
  reviewTraineeMealPlanForCoach,
  updateTraineePlannedItemForCoach,
}
