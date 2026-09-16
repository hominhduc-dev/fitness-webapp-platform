import { NotificationType } from "@prisma/client"

import type { NotificationDraft } from "./notification-dispatch.service"

/**
 * End-of-week nudge for a coach to review their trainees. One summary per coach
 * per week rather than one per trainee, so a coach with twenty clients gets a
 * single notification that points at who needs attention.
 */

type TraineeWeek = {
  id: string
  name: string
  workouts: number
}

const MAX_NAMED_TRAINEES = 3

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function listNames(names: readonly string[]) {
  const shown = names.slice(0, MAX_NAMED_TRAINEES).join(", ")
  const rest = names.length - MAX_NAMED_TRAINEES
  return rest > 0 ? `${shown} +${rest}` : shown
}

function buildCoachWeeklyReviewDraft(input: {
  coachId: string
  trainees: readonly TraineeWeek[]
  weekStartKey: string
}): NotificationDraft {
  const workoutTotal = input.trainees.reduce((sum, trainee) => sum + trainee.workouts, 0)
  const idle = input.trainees.filter((trainee) => trainee.workouts === 0)
  const subject = input.trainees.length === 1 ? "Your trainee" : `Your ${input.trainees.length} trainees`

  const summary = `${subject} logged ${plural(workoutTotal, "workout")} this week.`
  const attention = idle.length === 0
    ? ""
    : input.trainees.length === 1
      ? " They haven't trained yet."
      : ` ${idle.length === 1 ? "1 hasn't" : `${idle.length} haven't`} trained yet: ${listNames(idle.map((trainee) => trainee.name))}.`

  return {
    dedupeKey: `coach_weekly_review:${input.coachId}:${input.weekStartKey}`,
    message: `${summary}${attention} Review their progress.`,
    metadata: {
      idleTraineeIds: idle.map((trainee) => trainee.id),
      traineeCount: input.trainees.length,
      trainees: input.trainees.slice(0, 50),
      weekStart: input.weekStartKey,
      workoutTotal,
    },
    title: "Weekly trainee review",
    type: NotificationType.coach_weekly_review,
    url: "/coach/trainees",
    userId: input.coachId,
  }
}

export { buildCoachWeeklyReviewDraft }
export type { TraineeWeek }
