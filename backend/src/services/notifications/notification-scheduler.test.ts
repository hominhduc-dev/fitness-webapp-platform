import { NotificationType, Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  bodyMetricFindMany: vi.fn(),
  draftFindMany: vi.fn(),
  findTodayScheduleEntryForTrainee: vi.fn(),
  mealFindMany: vi.fn(),
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationFindMany: vi.fn(),
  preferenceFindMany: vi.fn(),
  recoveryFindMany: vi.fn(),
  sendPushToUser: vi.fn(),
  workoutLogFindMany: vi.fn(),
}))

vi.mock("../../lib/prisma", () => ({
  prisma: {
    bodyMetricEntry: { findMany: mocks.bodyMetricFindMany },
    meal: { findMany: mocks.mealFindMany },
    notification: { create: mocks.notificationCreate, findMany: mocks.notificationFindMany },
    notificationPreference: { findMany: mocks.preferenceFindMany },
    recoveryCheckIn: { findMany: mocks.recoveryFindMany },
    user: { findMany: mocks.userFindMany },
    workoutLog: { findMany: mocks.workoutLogFindMany },
    workoutSessionDraft: { findMany: mocks.draftFindMany },
  },
}))
vi.mock("../push-notification.service", () => ({ sendPushToUser: mocks.sendPushToUser }))
vi.mock("../fitness-data/core", () => ({ findTodayScheduleEntryForTrainee: mocks.findTodayScheduleEntryForTrainee }))

import { getRequestTimeZone } from "../../lib/time-zone"
import {
  runCoachWeeklyReviewJob,
  runDailyCheckInJob,
  runMealReminderJob,
  runOpenWorkoutSessionJob,
  runWeightReminderJob,
  runWorkoutReminderJob,
} from "./notification-scheduler"

// Monday 2026-09-21 07:10 in Vietnam.
const NOW = new Date("2026-09-21T00:10:00.000Z")
const USER_ID = "00000000-0000-4000-8000-000000000001"

function weightPreference(overrides: Record<string, unknown> = {}) {
  return {
    timeZone: "Asia/Ho_Chi_Minh",
    userId: USER_ID,
    weightReminderDays: [0, 1, 2, 3, 4, 5, 6],
    weightReminderTime: "07:00",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.notificationFindMany.mockResolvedValue([])
  mocks.bodyMetricFindMany.mockResolvedValue([])
  mocks.recoveryFindMany.mockResolvedValue([])
  mocks.workoutLogFindMany.mockResolvedValue([])
  mocks.mealFindMany.mockResolvedValue([])
  mocks.draftFindMany.mockResolvedValue([])
  mocks.notificationCreate.mockImplementation(async ({ data }) => ({ id: "notification-1", ...data }))
  mocks.sendPushToUser.mockResolvedValue({ failed: 0, sent: 1 })
})

describe("runWeightReminderJob", () => {
  it("stores and pushes one reminder keyed by the user's local day", async () => {
    // Called once for the job's own query and once when checking push preferences.
    mocks.preferenceFindMany
      .mockResolvedValueOnce([weightPreference()])
      .mockResolvedValueOnce([{ ...weightPreference(), weightReminderEnabled: true }])

    await expect(runWeightReminderJob(NOW)).resolves.toEqual({ candidates: 1, sent: 1 })

    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: `weight_reminder:${USER_ID}:2026-09-21`,
        title: "Time to log your weight",
        type: NotificationType.weight_reminder,
      }),
    })
    expect(mocks.sendPushToUser).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ url: "/trackweight" }))
  })

  it("skips a day not selected, and a user who already logged today", async () => {
    mocks.preferenceFindMany.mockResolvedValueOnce([weightPreference({ weightReminderDays: [0] })])
    await expect(runWeightReminderJob(NOW)).resolves.toEqual({ candidates: 0, sent: 0 })

    mocks.preferenceFindMany.mockResolvedValueOnce([weightPreference()])
    mocks.bodyMetricFindMany.mockResolvedValueOnce([{ recordedAt: new Date("2026-09-20T23:30:00.000Z"), traineeId: USER_ID }])
    await expect(runWeightReminderJob(NOW)).resolves.toEqual({ candidates: 0, sent: 0 })

    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })

  it("does not resend when the dedupe key is already stored or loses a race", async () => {
    mocks.preferenceFindMany.mockResolvedValueOnce([weightPreference()])
    mocks.notificationFindMany.mockResolvedValueOnce([{ dedupeKey: `weight_reminder:${USER_ID}:2026-09-21` }])
    await expect(runWeightReminderJob(NOW)).resolves.toEqual({ candidates: 1, sent: 0 })
    expect(mocks.notificationCreate).not.toHaveBeenCalled()

    mocks.preferenceFindMany.mockResolvedValueOnce([weightPreference()])
    mocks.notificationCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { clientVersion: "6", code: "P2002" }),
    )
    await expect(runWeightReminderJob(NOW)).resolves.toEqual({ candidates: 1, sent: 0 })
    expect(mocks.sendPushToUser).not.toHaveBeenCalled()
  })
})

describe("runDailyCheckInJob", () => {
  it("skips users who already checked in today", async () => {
    mocks.preferenceFindMany.mockResolvedValueOnce([{ dailyCheckInTime: "07:00", timeZone: "Asia/Ho_Chi_Minh", userId: USER_ID }])
    mocks.recoveryFindMany.mockResolvedValueOnce([{ checkInDate: new Date("2026-09-21T00:00:00.000Z"), userId: USER_ID }])

    await expect(runDailyCheckInJob(NOW)).resolves.toEqual({ candidates: 0, sent: 0 })
  })
})

describe("runOpenWorkoutSessionJob", () => {
  const draft = {
    id: "draft-1",
    startedAt: new Date(NOW.getTime() - 2.5 * 60 * 60 * 1000),
    updatedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    userId: USER_ID,
    workout: { name: "Chest Day" },
    workoutId: "workout-1",
    workoutName: null,
  }

  it("notifies once per session with the elapsed time", async () => {
    mocks.draftFindMany.mockResolvedValueOnce([draft])
    mocks.preferenceFindMany.mockResolvedValue([])

    await expect(runOpenWorkoutSessionJob(NOW)).resolves.toEqual({ candidates: 1, sent: 1 })
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: `workout_session_open:draft-1:${draft.startedAt.getTime()}`,
        message: "You started Chest Day 2 hours ago. Finish or resume it?",
        title: "Workout still open",
      }),
    })
    expect(mocks.sendPushToUser).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ url: "/workout/workout-1/start" }))
  })

  it("ignores a session already logged and users who turned the reminder off", async () => {
    mocks.draftFindMany.mockResolvedValueOnce([draft])
    mocks.preferenceFindMany.mockResolvedValueOnce([])
    mocks.workoutLogFindMany.mockResolvedValueOnce([{ createdAt: NOW, userId: USER_ID, workoutId: "workout-1" }])
    await expect(runOpenWorkoutSessionJob(NOW)).resolves.toEqual({ candidates: 0, sent: 0 })

    mocks.draftFindMany.mockResolvedValueOnce([draft])
    mocks.preferenceFindMany.mockResolvedValueOnce([{ userId: USER_ID, workoutSessionReminders: false }])
    await expect(runOpenWorkoutSessionJob(NOW)).resolves.toEqual({ candidates: 0, sent: 0 })

    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })
})

describe("runMealReminderJob", () => {
  // Monday 2026-09-21 12:10 in Vietnam.
  const NOON = new Date("2026-09-21T05:10:00.000Z")
  const lunchPreference = {
    breakfastReminderEnabled: true,
    breakfastReminderTime: "07:30",
    dinnerReminderEnabled: false,
    dinnerReminderTime: "18:30",
    lunchReminderEnabled: true,
    lunchReminderTime: "12:00",
    snackReminderEnabled: false,
    snackReminderTime: "15:30",
    timeZone: "Asia/Ho_Chi_Minh",
    userId: USER_ID,
  }
  const today = new Date("2026-09-21T00:00:00.000Z")

  it("reminds for the meal whose window is open and not yet logged", async () => {
    mocks.preferenceFindMany.mockResolvedValueOnce([lunchPreference])

    await expect(runMealReminderJob(NOON)).resolves.toEqual({ candidates: 1, sent: 1 })
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: `meal_reminder:${USER_ID}:2026-09-21:lunch`,
        message: "Don't forget to log your lunch.",
        title: "Lunch reminder",
        type: NotificationType.meal_reminder,
      }),
    })
  })

  it("skips a meal that already has calories, but not a zero-calorie placeholder", async () => {
    mocks.preferenceFindMany.mockResolvedValueOnce([lunchPreference])
    mocks.mealFindMany.mockResolvedValueOnce([
      { calories: 0, loggedDate: today, type: "lunch", userId: USER_ID },
      { calories: 540, loggedDate: today, type: "lunch", userId: USER_ID },
    ])
    await expect(runMealReminderJob(NOON)).resolves.toEqual({ candidates: 0, sent: 0 })

    mocks.preferenceFindMany.mockResolvedValueOnce([lunchPreference])
    mocks.mealFindMany.mockResolvedValueOnce([{ calories: 0, loggedDate: today, type: "lunch", userId: USER_ID }])
    await expect(runMealReminderJob(NOON)).resolves.toEqual({ candidates: 1, sent: 1 })
  })
})

describe("runWorkoutReminderJob", () => {
  // Monday 2026-09-21 17:40 in Vietnam, 20 minutes before an 18:00 session.
  const EVENING = new Date("2026-09-21T10:40:00.000Z")
  const preference = {
    timeZone: "Asia/Ho_Chi_Minh",
    userId: USER_ID,
    workoutReminderOffsetMinutes: 30,
    workoutReminderTime: "18:00",
  }

  it("reminds about today's scheduled workout, resolved in the user's zone", async () => {
    mocks.preferenceFindMany.mockResolvedValue([preference])
    mocks.findTodayScheduleEntryForTrainee.mockImplementationOnce(async () => {
      expect(getRequestTimeZone()).toBe("Asia/Ho_Chi_Minh")
      return { isCompleted: false, workoutId: "workout-1", workoutName: "Chest Day" }
    })

    await expect(runWorkoutReminderJob(EVENING)).resolves.toEqual({ candidates: 1, sent: 1 })
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: `workout_reminder:${USER_ID}:2026-09-21`,
        message: "Chest Day is scheduled at 6:00 PM.",
        title: "Workout starts soon",
      }),
    })
  })

  it("stays quiet on rest days, finished workouts and sessions already started", async () => {
    mocks.preferenceFindMany.mockResolvedValue([preference])

    mocks.findTodayScheduleEntryForTrainee.mockResolvedValueOnce(null)
    await expect(runWorkoutReminderJob(EVENING)).resolves.toEqual({ candidates: 1, sent: 0 })

    mocks.findTodayScheduleEntryForTrainee.mockResolvedValueOnce({ isCompleted: true, workoutId: "w", workoutName: "Chest Day" })
    await expect(runWorkoutReminderJob(EVENING)).resolves.toEqual({ candidates: 1, sent: 0 })

    mocks.draftFindMany.mockResolvedValueOnce([{ startedAt: new Date("2026-09-21T10:00:00.000Z"), userId: USER_ID }])
    await expect(runWorkoutReminderJob(EVENING)).resolves.toEqual({ candidates: 1, sent: 0 })

    expect(mocks.findTodayScheduleEntryForTrainee).toHaveBeenCalledTimes(2)
    expect(mocks.notificationCreate).not.toHaveBeenCalled()
  })
})

describe("runCoachWeeklyReviewJob", () => {
  // Sunday 2026-09-27 18:05 in Vietnam.
  const SUNDAY_EVENING = new Date("2026-09-27T11:05:00.000Z")
  const coach = (notificationPreference: Record<string, unknown> | null = null) => ({
    id: "coach-1",
    notificationPreference,
    trainees: [{ id: "t1", name: "An" }, { id: "t2", name: "Bình" }],
  })

  it("sends coaches without saved settings a Sunday-evening summary of this week", async () => {
    mocks.userFindMany.mockResolvedValueOnce([coach()])
    mocks.workoutLogFindMany.mockResolvedValueOnce([
      { startedAt: new Date("2026-09-22T01:00:00.000Z"), userId: "t1" },
      { startedAt: new Date("2026-09-24T01:00:00.000Z"), userId: "t1" },
      // The previous week's Sunday does not count.
      { startedAt: new Date("2026-09-20T01:00:00.000Z"), userId: "t2" },
    ])

    await expect(runCoachWeeklyReviewJob(SUNDAY_EVENING)).resolves.toEqual({ candidates: 1, sent: 1 })
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: "coach_weekly_review:coach-1:2026-09-21",
        message: "Your 2 trainees logged 2 workouts this week. 1 hasn't trained yet: Bình. Review their progress.",
      }),
    })
  })

  it("respects a disabled review and a different chosen day", async () => {
    mocks.userFindMany.mockResolvedValueOnce([coach({ coachWeeklyReviewEnabled: false })])
    await expect(runCoachWeeklyReviewJob(SUNDAY_EVENING)).resolves.toEqual({ candidates: 0, sent: 0 })

    mocks.userFindMany.mockResolvedValueOnce([coach({ coachWeeklyReviewDay: 6, coachWeeklyReviewEnabled: true })])
    await expect(runCoachWeeklyReviewJob(SUNDAY_EVENING)).resolves.toEqual({ candidates: 0, sent: 0 })
  })
})
