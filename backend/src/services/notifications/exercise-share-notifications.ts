import { ExerciseShareStatus, NotificationType, UserRole } from "@prisma/client"

import { logger } from "../../lib/logger"
import { prisma } from "../../lib/prisma"
import { EXERCISE_SHARE_PENDING_KIND } from "./admin-notification-kinds"
import { buildNotificationData, createAndPushNotification, queuePushForNotifications, type NotificationDraft } from "./notification-dispatch.service"

/**
 * Notices for coach exercises offered to the shared library: admins hear that
 * one is waiting, the coach hears how it was decided. Stored in English with a
 * `kind` in metadata; the push (localized-push.ts) and the in-app list
 * (lib/notifications/present.ts) translate from it.
 */

export { EXERCISE_SHARE_PENDING_KIND } from "./admin-notification-kinds"
export const EXERCISE_SHARE_REVIEWED_KIND = "exercise_share_reviewed"

export type ExerciseShareDecision = "approved" | "merged" | "rejected"

export function buildExerciseSharePendingDraft(input: {
  adminId: string
  coachName: string
  exerciseId: string
  exerciseName: string
  pendingCount: number
}): NotificationDraft {
  const others = input.pendingCount - 1
  return {
    message:
      others > 0
        ? `${input.coachName} suggested ${input.exerciseName} for the shared library. ${others} more ${others === 1 ? "is" : "are"} waiting.`
        : `${input.coachName} suggested ${input.exerciseName} for the shared library. Tap to review.`,
    metadata: {
      coachName: input.coachName,
      exerciseName: input.exerciseName,
      kind: EXERCISE_SHARE_PENDING_KIND,
      pendingCount: input.pendingCount,
    },
    relatedEntityId: input.exerciseId,
    relatedEntityType: "exercise",
    title: "Exercise to review",
    type: NotificationType.general,
    url: `/admin?s=exercises&share=${input.exerciseId}`,
    userId: input.adminId,
  }
}

export function buildExerciseShareReviewedDraft(input: {
  coachId: string
  decision: ExerciseShareDecision
  exerciseId: string
  exerciseName: string
  note?: string | null
  /** The library exercise it was merged into. */
  targetName?: string
}): NotificationDraft {
  const message =
    input.decision === "approved"
      ? `${input.exerciseName} is now in the shared library.`
      : input.decision === "merged"
        ? `${input.exerciseName} was merged into ${input.targetName ?? "a library exercise"}; your programs now use it.`
        : `${input.exerciseName} stays in your own library.${input.note ? ` Note: ${input.note}` : ""}`
  return {
    message,
    metadata: {
      decision: input.decision,
      exerciseName: input.exerciseName,
      kind: EXERCISE_SHARE_REVIEWED_KIND,
      ...(input.note ? { note: input.note } : {}),
      ...(input.targetName ? { targetName: input.targetName } : {}),
    },
    relatedEntityId: input.exerciseId,
    relatedEntityType: "exercise",
    title: input.decision === "rejected" ? "Exercise not shared" : "Exercise shared",
    type: NotificationType.general,
    url: "/coach/exercises",
    userId: input.coachId,
  }
}

/**
 * Tells every active admin a coach offered exercises for the shared library.
 * Never throws: saving the exercise must not fail because a notice didn't go out.
 */
export async function notifyAdminsOfExerciseShare(input: { coachName: string; exercises: Array<{ id: string; name: string }> }) {
  const [first] = input.exercises
  if (!prisma || !first) return
  try {
    const [admins, pendingCount] = await Promise.all([
      prisma.user.findMany({ select: { id: true }, where: { isActive: true, role: UserRole.admin } }),
      prisma.exercise.count({ where: { shareStatus: ExerciseShareStatus.pending } }),
    ])
    if (admins.length === 0) return

    // One notice for a whole import: it names the first exercise and counts the rest.
    const notifications = await prisma.notification.createManyAndReturn({
      data: admins.map((admin) =>
        buildNotificationData(
          buildExerciseSharePendingDraft({
            adminId: admin.id,
            coachName: input.coachName,
            exerciseId: first.id,
            exerciseName: first.name,
            pendingCount: Math.max(pendingCount, input.exercises.length),
          }),
        ),
      ),
    })
    await queuePushForNotifications(notifications)
  } catch (error) {
    logger.warn("unable to notify admins of an exercise share request", { error })
  }
}

/** Tells the coach how their exercise was decided. Never throws. */
export async function notifyCoachOfExerciseShareReview(input: Parameters<typeof buildExerciseShareReviewedDraft>[0]) {
  try {
    await createAndPushNotification(buildExerciseShareReviewedDraft(input))
  } catch (error) {
    logger.warn("unable to notify a coach of an exercise share review", { error, exerciseId: input.exerciseId })
  }
}
