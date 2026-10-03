import { formatDistance } from "date-fns"
import { enUS, vi } from "date-fns/locale"

import type { AppLocale } from "@/lib/i18n/config"
import type { AppMessages } from "@/lib/i18n/messages"
import type { AppNotification, NotificationMealType } from "@/lib/fitness/types"

/**
 * How a stored notification reads in the bell.
 *
 * The backend writes one English title/message (push copy cannot know the reader's
 * language), plus structured metadata. Known types are re-rendered from that
 * metadata in the viewer's locale; anything else falls back to the stored text.
 */

type NotificationPresentation = {
  href: string | null
  message: string
  title: string
}

const MEAL_TYPES: NotificationMealType[] = ["breakfast", "dinner", "lunch", "snack"]

function readString(notification: AppNotification, key: string) {
  const value = notification.metadata?.[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function readNumber(notification: AppNotification, key: string) {
  const value = notification.metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** In-app paths only, so metadata can never send the user off-site. */
function isInternalPath(value: string | undefined): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"))
}

function resolveNotificationHref(notification: AppNotification) {
  const url = readString(notification, "url")

  const traineeId = readString(notification, "traineeId")
  const kind = readString(notification, "kind")
  const mealType = readString(notification, "mealType") as NotificationMealType | undefined

  // An alert opens its own evidence. Older alerts stored the trainee page as
  // their url, so the detail link is rebuilt from what names the alert.
  const weekStart = readString(notification, "weekStart")
  if (notification.type === "coach_trainee_alert" && traineeId && kind && weekStart) {
    return `/coach/trainees/${traineeId}/alerts/${kind}?week=${weekStart}`
  }

  if (notification.type === "meal_reminder") {
    return mealType && MEAL_TYPES.includes(mealType) ? `/meals?meal=${mealType}` : "/meals"
  }

  if (isInternalPath(url)) return url

  switch (notification.type) {
    case "workout_logged":
      return traineeId ? `/coach/trainees/${traineeId}` : "/coach/trainees"
    case "program_assigned":
    case "program_updated":
      return "/workout"
    case "coach_request":
      return "/coach/trainees"
    case "general":
      if (kind === "coach_signup_pending") return "/admin?s=coach-signups"
      if (kind === "exercise_share_pending") return "/admin?s=exercises"
      if (kind === "exercise_share_reviewed") return "/coach/exercises"
      if (kind === "trainee_swapped_exercise" && traineeId) return `/coach/trainees/${traineeId}`
      if (kind === "meal_plan_reviewed") return "/meals"
      return null
    default:
      return null
  }
}

function formatClockTime(time: string, locale: AppLocale) {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return time

  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2]))))
}

function localizeCopy(
  notification: AppNotification,
  messages: AppMessages,
  locale: AppLocale,
  now: Date,
): Pick<NotificationPresentation, "message" | "title"> | null {
  const copy = messages.notificationCenter.copy

  switch (notification.type) {
    case "program_assigned": {
      const program = readString(notification, "programName")
      return program ? { message: copy.programAssigned.message(program), title: copy.programAssigned.title } : null
    }
    case "program_updated": {
      const target = readString(notification, "adjustedTarget")
      return target ? { message: copy.programUpdated.message(target), title: copy.programUpdated.title } : null
    }
    case "workout_session_open": {
      const workout = readString(notification, "workoutName")
      const startedAt = readString(notification, "startedAt")
      if (!workout || !startedAt) return null

      const elapsed = formatDistance(new Date(startedAt), now, { addSuffix: true, locale: locale === "vi" ? vi : enUS })
      return { message: copy.workoutSessionOpen.message(workout, elapsed), title: copy.workoutSessionOpen.title }
    }
    case "weight_reminder":
      return copy.weightReminder
    case "check_in_reminder":
      return copy.checkInReminder
    case "meal_reminder": {
      const mealType = readString(notification, "mealType") as NotificationMealType | undefined
      if (!mealType || !MEAL_TYPES.includes(mealType)) return null

      const meal = messages.notificationCenter.mealLabels[mealType]
      return { message: copy.mealReminder.message(meal), title: copy.mealReminder.title(meal) }
    }
    case "workout_reminder": {
      const workout = readString(notification, "workoutName")
      const time = readString(notification, "time")
      return workout && time
        ? { message: copy.workoutReminder.message(workout, formatClockTime(time, locale)), title: copy.workoutReminder.title }
        : null
    }
    case "coach_weekly_review": {
      const trainees = readNumber(notification, "traineeCount")
      const workouts = readNumber(notification, "workoutTotal")
      if (trainees === undefined || workouts === undefined) return null

      const rows = Array.isArray(notification.metadata?.trainees)
        ? (notification.metadata.trainees as Array<{ name?: unknown; workouts?: unknown }>)
        : []
      const idleNames = rows
        .filter((row) => row.workouts === 0 && typeof row.name === "string")
        .map((row) => row.name as string)
      const namedIdle = idleNames.length > 3 ? `${idleNames.slice(0, 3).join(", ")} +${idleNames.length - 3}` : idleNames.join(", ")

      return {
        message: `${copy.coachWeeklyReview.message(trainees, workouts)}${idleNames.length > 0 ? copy.coachWeeklyReview.idle(idleNames.length, namedIdle) : ""}${copy.coachWeeklyReview.suffix}`,
        title: copy.coachWeeklyReview.title,
      }
    }
    case "coach_trainee_alert": {
      const trainee = readString(notification, "traineeName")
      if (!trainee) return null
      const alert = copy.coachTraineeAlert
      const title = alert.title(trainee)
      switch (readString(notification, "kind")) {
        case "missed_workouts": {
          const completed = readNumber(notification, "completed")
          const planned = readNumber(notification, "planned")
          return completed !== undefined && planned !== undefined ? { message: alert.missedWorkouts(completed, planned), title } : null
        }
        case "low_readiness": {
          const days = readNumber(notification, "days")
          const average = readNumber(notification, "averageReadiness")
          return days !== undefined && average !== undefined ? { message: alert.lowReadiness(days, average), title } : null
        }
        case "plateau": {
          const exercises = Array.isArray(notification.metadata?.exercises)
            ? (notification.metadata.exercises as unknown[]).filter((entry): entry is string => typeof entry === "string")
            : []
          return exercises.length > 0 ? { message: alert.plateau(exercises.join(", ")), title } : null
        }
        default:
          return null
      }
    }
    case "coach_request": {
      const kind = readString(notification, "kind")
      const requester = readString(notification, "requesterName")
      const accepter = readString(notification, "accepterName")
      const connection = copy.coachConnection
      if (kind === "coach_request_received" && requester) return { message: connection.requestReceived.message(requester), title: connection.requestReceived.title }
      if (kind === "coach_invite_received" && requester) return { message: connection.inviteReceived.message(requester), title: connection.inviteReceived.title }
      if (kind === "coach_connection_accepted" && accepter) {
        return { message: connection.accepted.message(accepter, readString(notification, "opener") === "coach"), title: connection.accepted.title }
      }
      return null
    }
    case "general": {
      const applicant = readString(notification, "applicantName")
      if (readString(notification, "kind") === "coach_signup_pending" && applicant) {
        const pending = Number(notification.metadata?.pendingCount ?? 1)
        return { message: copy.coachSignupPending.message(applicant, Math.max(pending - 1, 0)), title: copy.coachSignupPending.title }
      }
      const coach = readString(notification, "coachName")
      const exercise = readString(notification, "exerciseName")
      if (readString(notification, "kind") === "exercise_share_pending" && coach && exercise) {
        const pending = Number(notification.metadata?.pendingCount ?? 1)
        return { message: copy.exerciseSharePending.message(coach, exercise, Math.max(pending - 1, 0)), title: copy.exerciseSharePending.title }
      }
      if (readString(notification, "kind") === "exercise_share_reviewed" && exercise) {
        const reviewed = copy.exerciseShareReviewed
        const decision = readString(notification, "decision")
        if (decision === "approved") return { message: reviewed.approved(exercise), title: reviewed.sharedTitle }
        if (decision === "merged") return { message: reviewed.merged(exercise, readString(notification, "targetName")), title: reviewed.sharedTitle }
        return { message: reviewed.rejected(exercise, readString(notification, "note")), title: reviewed.notSharedTitle }
      }
      const trainee = readString(notification, "traineeName")
      const from = readString(notification, "oldExerciseName")
      const to = readString(notification, "newExerciseName")
      const where = readString(notification, "workoutName") ?? readString(notification, "programName")
      if (readString(notification, "kind") === "trainee_swapped_exercise" && trainee && from && to && where) {
        return { message: copy.exerciseSwap.message(trainee, from, to, where), title: copy.exerciseSwap.title }
      }
      return null
    }
    case "workout_logged": {
      const trainee = readString(notification, "traineeName")
      const workout = readString(notification, "workoutName")
      if (!trainee || !workout) return null

      // Notes the trainee left on exercises, sent with the finished session.
      const notes = Array.isArray(notification.metadata?.exerciseNotes)
        ? (notification.metadata.exerciseNotes as Array<{ exerciseName?: unknown; note?: unknown }>)
            .flatMap((entry) => typeof entry.exerciseName === "string" && typeof entry.note === "string"
              ? [`${entry.exerciseName}: ${entry.note}`]
              : [])
        : []
      return {
        message: `${copy.workoutLogged.message(trainee, workout)}${notes.length > 0 ? copy.workoutLogged.notes(notes.join("; ")) : ""}`,
        title: copy.workoutLogged.title(trainee),
      }
    }
    default:
      return null
  }
}

function presentNotification(
  notification: AppNotification,
  messages: AppMessages,
  locale: AppLocale,
  now = new Date(),
): NotificationPresentation {
  const localized = localizeCopy(notification, messages, locale, now)

  return {
    href: resolveNotificationHref(notification),
    message: localized?.message ?? notification.message,
    title: localized?.title ?? notification.title,
  }
}

export { presentNotification, resolveNotificationHref }
export type { NotificationPresentation }
