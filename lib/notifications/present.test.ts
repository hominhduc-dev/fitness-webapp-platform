import { describe, expect, it } from "vitest"

import type { AppNotification } from "@/lib/fitness/types"
import { getMessages } from "@/lib/i18n/messages"
import { presentNotification } from "./present"

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    createdAt: new Date("2026-09-21T10:00:00.000Z"),
    id: "n1",
    message: "Stored message",
    scheduledFor: new Date("2026-09-21T10:00:00.000Z"),
    status: "sent",
    title: "Stored title",
    type: "general",
    ...overrides,
  }
}

describe("presentNotification", () => {
  it("re-renders known types in the viewer's language", () => {
    const updated = notification({
      metadata: { adjustedTarget: "Chest Day", url: "/workout" },
      type: "program_updated",
    })

    expect(presentNotification(updated, getMessages("en"), "en")).toEqual({
      href: "/workout",
      message: "Chest Day has been adjusted by your coach.",
      title: "Coach updated your program",
    })
    expect(presentNotification(updated, getMessages("vi"), "vi")).toMatchObject({
      message: "Coach đã điều chỉnh Chest Day.",
      title: "Coach đã cập nhật chương trình",
    })
  })

  it("formats meal, workout-time and weekly review copy from metadata", () => {
    const en = getMessages("en")

    expect(presentNotification(notification({ metadata: { mealType: "lunch" }, type: "meal_reminder" }), en, "en"))
      .toMatchObject({ href: "/meals?meal=lunch", message: "Don't forget to log your lunch.", title: "Lunch reminder" })
    expect(presentNotification(notification({ metadata: { mealType: "snack", url: "/meals" }, type: "meal_reminder" }), en, "en").href)
      .toBe("/meals?meal=snack")

    expect(presentNotification(
      notification({ metadata: { time: "18:00", workoutName: "Chest Day" }, type: "workout_reminder" }),
      en,
      "en",
    ).message).toBe("Chest Day is scheduled at 6:00 PM.")

    expect(presentNotification(
      notification({
        metadata: {
          traineeCount: 2,
          trainees: [{ name: "An", workouts: 3 }, { name: "Bình", workouts: 0 }],
          url: "/coach/trainees",
          workoutTotal: 3,
        },
        type: "coach_weekly_review",
      }),
      getMessages("vi"),
      "vi",
    )).toEqual({
      href: "/coach/trainees",
      message: "2 học viên đã ghi 3 buổi tập trong tuần này. 1 học viên chưa tập: Bình. Xem lại số liệu của học viên nhé.",
      title: "Tổng kết tuần của học viên",
    })
  })

  it("falls back to stored text and derives links for older notifications", () => {
    const logged = notification({ metadata: { traineeId: "t1" }, type: "workout_logged" })

    expect(presentNotification(logged, getMessages("en"), "en")).toEqual({
      href: "/coach/trainees/t1",
      message: "Stored message",
      title: "Stored title",
    })
  })

  it("ignores links that leave the app", () => {
    const external = notification({ metadata: { url: "//evil.example" }, type: "general" })
    expect(presentNotification(external, getMessages("en"), "en").href).toBeNull()
  })
})
