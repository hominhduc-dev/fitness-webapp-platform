import { NotificationType } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { buildCoachWeeklyReviewDraft } from "./coach-weekly-review"

const trainee = (id: string, name: string, workouts: number) => ({ id, name, workouts })

describe("buildCoachWeeklyReviewDraft", () => {
  it("summarises the week and keys it once per coach per week", () => {
    const draft = buildCoachWeeklyReviewDraft({
      coachId: "coach-1",
      trainees: [trainee("t1", "An", 3), trainee("t2", "Bình", 1)],
      weekStartKey: "2026-09-21",
    })

    expect(draft).toMatchObject({
      dedupeKey: "coach_weekly_review:coach-1:2026-09-21",
      message: "Your 2 trainees logged 4 workouts this week. Review their progress.",
      title: "Weekly trainee review",
      type: NotificationType.coach_weekly_review,
      url: "/coach/trainees",
      userId: "coach-1",
    })
  })

  it("names trainees who have not trained, capped at three", () => {
    const draft = buildCoachWeeklyReviewDraft({
      coachId: "coach-1",
      trainees: [
        trainee("t1", "An", 2),
        trainee("t2", "Bình", 0),
        trainee("t3", "Chi", 0),
        trainee("t4", "Dũng", 0),
        trainee("t5", "Em", 0),
      ],
      weekStartKey: "2026-09-21",
    })

    expect(draft.message).toBe(
      "Your 5 trainees logged 2 workouts this week. 4 haven't trained yet: Bình, Chi, Dũng +1. Review their progress.",
    )
    expect(draft.metadata).toMatchObject({ idleTraineeIds: ["t2", "t3", "t4", "t5"], traineeCount: 5, workoutTotal: 2 })
  })

  it("uses singular copy for a single trainee", () => {
    expect(buildCoachWeeklyReviewDraft({
      coachId: "coach-1",
      trainees: [trainee("t1", "An", 0)],
      weekStartKey: "2026-09-21",
    }).message).toBe("Your trainee logged 0 workouts this week. They haven't trained yet. Review their progress.")

    expect(buildCoachWeeklyReviewDraft({
      coachId: "coach-1",
      trainees: [trainee("t1", "An", 1)],
      weekStartKey: "2026-09-21",
    }).message).toBe("Your trainee logged 1 workout this week. Review their progress.")
  })
})
