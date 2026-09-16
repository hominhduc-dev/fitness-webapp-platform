import type { NotificationPreference } from "@prisma/client"

import { getRequestTimeZone, isValidTimeZone } from "../../lib/time-zone"
import type { SerializedProfile } from "../auth.service"
import { ensurePrisma } from "../fitness-data/shared/guards"

type NotificationPreferenceSettings = Omit<NotificationPreference, "createdAt" | "id" | "updatedAt" | "userId">

type NotificationPreferenceInput = Partial<NotificationPreferenceSettings>

const MEAL_REMINDER_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const
type MealReminderType = (typeof MEAL_REMINDER_TYPES)[number]

/** Mirrors the column defaults, for users who never saved preferences. */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceSettings = {
  breakfastReminderEnabled: false,
  breakfastReminderTime: "07:30",
  coachProgramUpdates: true,
  coachWeeklyReviewDay: 0,
  coachWeeklyReviewEnabled: true,
  coachWeeklyReviewTime: "18:00",
  dailyCheckInEnabled: false,
  dailyCheckInTime: "07:00",
  dinnerReminderEnabled: false,
  dinnerReminderTime: "18:30",
  lunchReminderEnabled: false,
  lunchReminderTime: "12:00",
  snackReminderEnabled: false,
  snackReminderTime: "15:30",
  timeZone: "Asia/Ho_Chi_Minh",
  weightReminderDays: [0, 1, 2, 3, 4, 5, 6],
  weightReminderEnabled: false,
  weightReminderTime: "07:00",
  workoutReminderEnabled: false,
  workoutReminderOffsetMinutes: 30,
  workoutReminderTime: "18:00",
  workoutSessionReminders: true,
}

/** The `<meal>ReminderEnabled` / `<meal>ReminderTime` columns for one meal. */
function mealReminderColumns(meal: MealReminderType) {
  return {
    enabled: `${meal}ReminderEnabled` as const,
    time: `${meal}ReminderTime` as const,
  }
}

function serializeNotificationPreferences(preference: NotificationPreferenceSettings | null) {
  const source = preference ?? DEFAULT_NOTIFICATION_PREFERENCES

  return {
    coachProgramUpdates: source.coachProgramUpdates,
    coachWeeklyReview: {
      day: source.coachWeeklyReviewDay,
      enabled: source.coachWeeklyReviewEnabled,
      time: source.coachWeeklyReviewTime,
    },
    dailyCheckIn: {
      enabled: source.dailyCheckInEnabled,
      time: source.dailyCheckInTime,
    },
    mealReminders: Object.fromEntries(MEAL_REMINDER_TYPES.map((meal) => {
      const columns = mealReminderColumns(meal)
      return [meal, { enabled: source[columns.enabled], time: source[columns.time] }]
    })) as Record<MealReminderType, { enabled: boolean; time: string }>,
    timeZone: source.timeZone,
    weightReminder: {
      days: [...source.weightReminderDays].sort((left, right) => left - right),
      enabled: source.weightReminderEnabled,
      time: source.weightReminderTime,
    },
    workoutReminder: {
      enabled: source.workoutReminderEnabled,
      offsetMinutes: source.workoutReminderOffsetMinutes,
      time: source.workoutReminderTime,
    },
    workoutSessionReminders: source.workoutSessionReminders,
  }
}

type SerializedNotificationPreferences = ReturnType<typeof serializeNotificationPreferences>

type NestedNotificationPreferenceInput = {
  coachProgramUpdates?: boolean
  coachWeeklyReview?: Partial<SerializedNotificationPreferences["coachWeeklyReview"]>
  dailyCheckIn?: Partial<SerializedNotificationPreferences["dailyCheckIn"]>
  mealReminders?: Partial<Record<MealReminderType, Partial<{ enabled: boolean; time: string }>>>
  timeZone?: string
  weightReminder?: Partial<SerializedNotificationPreferences["weightReminder"]>
  workoutReminder?: Partial<SerializedNotificationPreferences["workoutReminder"]>
  workoutSessionReminders?: boolean
}

/** The API's grouped shape → column names. Omitted fields stay undefined. */
function flattenNotificationPreferenceInput(input: NestedNotificationPreferenceInput): NotificationPreferenceInput {
  const meals: NotificationPreferenceInput = {}

  for (const meal of MEAL_REMINDER_TYPES) {
    const columns = mealReminderColumns(meal)
    meals[columns.enabled] = input.mealReminders?.[meal]?.enabled
    meals[columns.time] = input.mealReminders?.[meal]?.time
  }

  return {
    ...meals,
    coachProgramUpdates: input.coachProgramUpdates,
    coachWeeklyReviewDay: input.coachWeeklyReview?.day,
    coachWeeklyReviewEnabled: input.coachWeeklyReview?.enabled,
    coachWeeklyReviewTime: input.coachWeeklyReview?.time,
    dailyCheckInEnabled: input.dailyCheckIn?.enabled,
    dailyCheckInTime: input.dailyCheckIn?.time,
    timeZone: input.timeZone,
    weightReminderDays: input.weightReminder?.days,
    weightReminderEnabled: input.weightReminder?.enabled,
    weightReminderTime: input.weightReminder?.time,
    workoutReminderEnabled: input.workoutReminder?.enabled,
    workoutReminderOffsetMinutes: input.workoutReminder?.offsetMinutes,
    workoutReminderTime: input.workoutReminder?.time,
    workoutSessionReminders: input.workoutSessionReminders,
  }
}

async function getNotificationPreferencesForUser(profile: SerializedProfile) {
  const db = ensurePrisma()
  const preference = await db.notificationPreference.findUnique({ where: { userId: profile.id } })

  // First read for this user: report the browser's zone so the settings screen
  // shows where reminders would fire before anything is saved.
  return serializeNotificationPreferences(preference ?? { ...DEFAULT_NOTIFICATION_PREFERENCES, timeZone: getRequestTimeZone() })
}

async function updateNotificationPreferencesForUser(profile: SerializedProfile, input: NestedNotificationPreferenceInput) {
  const db = ensurePrisma()
  const flat = flattenNotificationPreferenceInput(input)
  // Reminders follow the device the user last saved settings from; a stale
  // zone after travelling is corrected by saving again.
  const timeZone = isValidTimeZone(flat.timeZone) ? flat.timeZone : getRequestTimeZone()
  // Drop omitted fields so a partial save neither resets nor overrides defaults.
  const provided = Object.fromEntries(
    Object.entries(flat).filter(([, value]) => value !== undefined),
  ) as NotificationPreferenceInput
  const data = {
    ...provided,
    timeZone,
    ...(provided.weightReminderDays ? { weightReminderDays: Array.from(new Set(provided.weightReminderDays)) } : {}),
  }

  const preference = await db.notificationPreference.upsert({
    create: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...data, userId: profile.id },
    update: data,
    where: { userId: profile.id },
  })

  return serializeNotificationPreferences(preference)
}

/** Preferences for many users at once; users without a row get the defaults. */
async function loadNotificationPreferences(userIds: readonly string[]) {
  const db = ensurePrisma()
  const uniqueIds = Array.from(new Set(userIds))
  const rows = uniqueIds.length > 0
    ? await db.notificationPreference.findMany({ where: { userId: { in: uniqueIds } } })
    : []
  const byUserId = new Map<string, NotificationPreferenceSettings>(rows.map((row) => [row.userId, row]))

  return (userId: string) => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...byUserId.get(userId) })
}

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  flattenNotificationPreferenceInput,
  getNotificationPreferencesForUser,
  loadNotificationPreferences,
  MEAL_REMINDER_TYPES,
  mealReminderColumns,
  serializeNotificationPreferences,
  updateNotificationPreferencesForUser,
}
export type {
  MealReminderType,
  NestedNotificationPreferenceInput,
  NotificationPreferenceInput,
  NotificationPreferenceSettings,
}
