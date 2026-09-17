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

  it("falls back to stored copy when structured metadata is incomplete", () => {
    const row = notification(NotificationType.workout_reminder, {})
    expect(localizedNotificationCopy(row, "vi")).toEqual({ body: "fallback body", title: "fallback title" })
  })
})
