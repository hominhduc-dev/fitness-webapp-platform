import { CoachApprovalStatus, NotificationType, UserRole } from "@prisma/client"

import { logger } from "../../lib/logger"
import { prisma } from "../../lib/prisma"
import { COACH_SIGNUP_PENDING_KIND } from "./admin-notification-kinds"
import { buildNotificationData, queuePushForNotifications, type NotificationDraft } from "./notification-dispatch.service"

/**
 * Notices for admins about work waiting on them. Stored in English with a
 * `kind` in metadata; the push (localized-push.ts) and the in-app list
 * (lib/notifications/present.ts) translate from it.
 */

export { COACH_SIGNUP_PENDING_KIND, COACH_SIGNUP_PUSH_TAG } from "./admin-notification-kinds"

export function buildCoachSignupPendingDraft(input: {
  adminId: string
  applicantId: string
  applicantName: string
  pendingCount: number
}): NotificationDraft {
  const others = input.pendingCount - 1
  return {
    message:
      others > 0
        ? `${input.applicantName} applied to be a coach. ${others} more ${others === 1 ? "is" : "are"} waiting.`
        : `${input.applicantName} applied to be a coach. Tap to review.`,
    metadata: {
      applicantName: input.applicantName,
      kind: COACH_SIGNUP_PENDING_KIND,
      pendingCount: input.pendingCount,
    },
    relatedEntityId: input.applicantId,
    relatedEntityType: "user",
    title: "New coach application",
    type: NotificationType.general,
    url: `/admin?s=coach-signups&user=${input.applicantId}`,
    userId: input.adminId,
  }
}

/**
 * Tells every active admin a coach applied, with how many are waiting. Never
 * throws: a sign-up must not fail because a notice could not go out.
 */
export async function notifyAdminsOfCoachSignup(applicant: { id: string; name: string }) {
  if (!prisma) return
  try {
    const [admins, pendingCount] = await Promise.all([
      prisma.user.findMany({ select: { id: true }, where: { isActive: true, role: UserRole.admin } }),
      prisma.user.count({ where: { coachApprovalStatus: CoachApprovalStatus.pending, role: UserRole.coach } }),
    ])
    if (admins.length === 0) return

    const notifications = await prisma.notification.createManyAndReturn({
      data: admins.map((admin) =>
        buildNotificationData(
          buildCoachSignupPendingDraft({
            adminId: admin.id,
            applicantId: applicant.id,
            applicantName: applicant.name,
            pendingCount: Math.max(pendingCount, 1),
          }),
        ),
      ),
    })
    await queuePushForNotifications(notifications)
  } catch (error) {
    logger.warn("unable to notify admins of a coach signup", { error, userId: applicant.id })
  }
}
