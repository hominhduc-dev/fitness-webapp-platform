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

  it("words coach connection notices for each side in the viewer's language", () => {
    const invite = notification({
      metadata: { kind: "coach_invite_received", requesterName: "Coach Khoa", url: "/dashboard" },
      type: "coach_request",
    })
    const accepted = notification({
      metadata: { accepterName: "Minh", kind: "coach_connection_accepted", opener: "coach", url: "/coach/trainees/t1" },
      type: "coach_request",
    })

    expect(presentNotification(invite, getMessages("vi"), "vi")).toEqual({
      href: "/dashboard",
      message: "Coach Khoa muốn làm coach của bạn. Chạm để trả lời.",
      title: "Lời mời kết nối từ coach",
    })
    expect(presentNotification(accepted, getMessages("en"), "en")).toEqual({
      href: "/coach/trainees/t1",
      message: "Minh accepted your invitation.",
      title: "You're connected",
    })
  })

  it("tells admins about a new coach application and opens the review queue", () => {
    const pending = notification({
      metadata: { applicantName: "Khoa", kind: "coach_signup_pending", pendingCount: 3, url: "/admin?s=coach-signups&user=u1" },
      type: "general",
    })

    expect(presentNotification(pending, getMessages("vi"), "vi")).toEqual({
      href: "/admin?s=coach-signups&user=u1",
      message: "Khoa vừa đăng ký làm coach. Còn 2 hồ sơ khác đang chờ.",
      title: "Hồ sơ coach mới cần duyệt",
    })
  })

  it("tells admins about a coach exercise to review and opens it", () => {
    const pending = notification({
      metadata: { coachName: "Khoa", exerciseName: "Tempo Hack Squat", kind: "exercise_share_pending", pendingCount: 1, url: "/admin?s=exercises&share=e1" },
      type: "general",
    })

    expect(presentNotification(pending, getMessages("vi"), "vi")).toEqual({
      href: "/admin?s=exercises&share=e1",
      message: "Khoa đề xuất Tempo Hack Squat vào thư viện chung. Chạm để duyệt.",
      title: "Bài tập cần duyệt",
    })
  })

  it("tells the coach an exercise was declined, with the admin's note", () => {
    const reviewed = notification({
      metadata: { decision: "rejected", exerciseName: "Tempo Hack Squat", kind: "exercise_share_reviewed", note: "Trùng Hack Squat", url: "/coach/exercises" },
      type: "general",
    })

    expect(presentNotification(reviewed, getMessages("en"), "en")).toEqual({
      href: "/coach/exercises",
      message: "Tempo Hack Squat stays in your own library. Note: Trùng Hack Squat",
      title: "Exercise not shared",
    })
  })

  it("names the swap and the session it happened in", () => {
    const swap = notification({
      metadata: {
        kind: "trainee_swapped_exercise",
        newExerciseName: "Hack Squat",
        oldExerciseName: "Barbell Squat",
        programName: "Meso 4",
        traineeId: "t1",
        traineeName: "Linh",
        workoutName: "Leg Day",
      },
      type: "general",
    })

    expect(presentNotification(swap, getMessages("vi"), "vi")).toEqual({
      href: "/coach/trainees/t1",
      message: "Linh đã đổi Barbell Squat → Hack Squat trong Leg Day.",
      title: "Yêu cầu đổi bài cần duyệt",
    })
    // Requests sent before the session was recorded fall back to the program.
    const { workoutName: _workoutName, ...older } = swap.metadata ?? {}
    expect(presentNotification({ ...swap, metadata: older }, getMessages("en"), "en").message)
      .toBe("Linh swapped Barbell Squat → Hack Squat in Meso 4.")
  })
})
