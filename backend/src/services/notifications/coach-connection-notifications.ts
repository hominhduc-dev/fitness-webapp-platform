import { NotificationType } from "@prisma/client"

import type { NotificationDraft } from "./notification-dispatch.service"

/**
 * Notifications for the coach–trainee connection flow. Either side can open a
 * request (a trainee asking a coach, a coach inviting a trainee); the other
 * side hears about it, and the opener hears back once it is accepted.
 *
 * Stored in English with a `kind` in metadata; the push (localized-push.ts)
 * and the in-app list (lib/notifications/present.ts) translate from it.
 */

export const COACH_CONNECTION_KINDS = {
  accepted: "coach_connection_accepted",
  inviteReceived: "coach_invite_received",
  requestReceived: "coach_request_received",
} as const

/** A trainee asked this coach to coach them. */
export function buildCoachRequestReceivedDraft(input: { coachId: string; requestId: string; traineeName: string }): NotificationDraft {
  return {
    message: `${input.traineeName} wants you as their coach. Tap to answer.`,
    metadata: { kind: COACH_CONNECTION_KINDS.requestReceived, requesterName: input.traineeName },
    relatedEntityId: input.requestId,
    relatedEntityType: "coach_request",
    title: "New trainee request",
    type: NotificationType.coach_request,
    url: "/coach/trainees",
    userId: input.coachId,
  }
}

/** A coach invited this trainee. */
export function buildCoachInviteReceivedDraft(input: { coachName: string; requestId: string; traineeId: string }): NotificationDraft {
  return {
    message: `${input.coachName} wants to be your coach. Tap to answer.`,
    metadata: { kind: COACH_CONNECTION_KINDS.inviteReceived, requesterName: input.coachName },
    relatedEntityId: input.requestId,
    relatedEntityType: "coach_request",
    title: "Coach invitation",
    type: NotificationType.coach_request,
    url: "/dashboard",
    userId: input.traineeId,
  }
}

/** The other side accepted: tells whoever opened the request. */
export function buildCoachConnectionAcceptedDraft(input: {
  accepterName: string
  requestId: string
  /** Who opened the request, and so who is told. */
  opener: "coach" | "trainee"
  openerId: string
  traineeId: string
}): NotificationDraft {
  return {
    message: `${input.accepterName} accepted your ${input.opener === "coach" ? "invitation" : "request"}.`,
    metadata: { accepterName: input.accepterName, kind: COACH_CONNECTION_KINDS.accepted, opener: input.opener, traineeId: input.traineeId },
    relatedEntityId: input.requestId,
    relatedEntityType: "coach_request",
    title: "You're connected",
    type: NotificationType.coach_request,
    url: input.opener === "coach" ? `/coach/trainees/${input.traineeId}` : "/dashboard",
    userId: input.openerId,
  }
}
