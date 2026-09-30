import { NotificationType, type Notification } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { localizedNotificationCopy } from "./localized-push"

function notification(type: NotificationType, metadata: Record<string, unknown>) {
  return { message: "fallback body", metadata, title: "fallback title", type } as Notification
}

describe("localizedNotificationCopy", () => {
  it("renders assigned programs in the subscription locale", () => {
    const row = notification(NotificationType.program_assigned, { programName: "Duc Bulking" })

    expect(localizedNotificationCopy(row, "en")).toEqual({
      body: "Your coach assigned Duc Bulking.",
      title: "New program assigned",
    })
    expect(localizedNotificationCopy(row, "vi")).toEqual({
      body: "Coach đã giao chương trình Duc Bulking.",
      title: "Chương trình mới",
    })
  })

  it("localizes meal labels", () => {
    const row = notification(NotificationType.meal_reminder, { mealType: "breakfast" })
    expect(localizedNotificationCopy(row, "vi")).toEqual({
      body: "Đừng quên ghi lại bữa sáng nhé.",
      title: "Nhắc bữa sáng",
    })
  })

  it("asks the coach to review a trainee's swap", () => {
    const row = notification(NotificationType.general, {
      kind: "trainee_swapped_exercise",
      newExerciseName: "Hack Squat",
      oldExerciseName: "Barbell Squat",
      programName: "Duc Bulking meso 4",
      traineeName: "Minh Duc",
    })

    expect(localizedNotificationCopy(row, "vi")).toEqual({
      body: "Minh Duc đổi Barbell Squat → Hack Squat trong Duc Bulking meso 4. Chạm để duyệt.",
      title: "Yêu cầu đổi bài tập",
    })
    expect(localizedNotificationCopy(row, "en")).toEqual({
      body: "Minh Duc swapped Barbell Squat → Hack Squat in Duc Bulking meso 4. Tap to review.",
      title: "Exercise swap request",
    })
  })

  it("carries the trainee's exercise notes with a finished workout", () => {
    const row = notification(NotificationType.workout_logged, {
      exerciseNotes: [{ exerciseName: "Leg Press", note: "Knee hurt on set 1" }, { exerciseName: "Curl", note: " " }],
      traineeName: "Minh Duc",
      workoutName: "Day 3",
    })

    expect(localizedNotificationCopy(row, "vi").body).toBe("Minh Duc đã hoàn thành Day 3. Ghi chú: Leg Press: Knee hurt on set 1")
    expect(localizedNotificationCopy(row, "en").body).toBe("Minh Duc completed Day 3. Notes: Leg Press: Knee hurt on set 1")
  })

  it("falls back to stored copy when structured metadata is incomplete", () => {
    const row = notification(NotificationType.workout_reminder, {})
    expect(localizedNotificationCopy(row, "vi")).toEqual({ body: "fallback body", title: "fallback title" })
  })
})
