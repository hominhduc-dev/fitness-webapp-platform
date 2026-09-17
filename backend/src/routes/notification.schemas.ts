import { z } from "zod"

import { isValidTimeZone } from "../lib/time-zone"
import { CLOCK_TIME_PATTERN, WORKOUT_REMINDER_OFFSETS } from "../services/notifications/reminder-schedule"

const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  // Default keeps subscriptions from an older frontend valid during rolling deploys.
  locale: z.enum(["en", "vi"]).default("en"),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
})

const revokePushSubscriptionSchema = z.object({
  endpoint: z.url(),
})

const clockTime = z.string().regex(CLOCK_TIME_PATTERN, "Giờ nhắc phải có định dạng HH:mm.")
const weekday = z.number().int().min(0).max(6)

const timedReminder = z.object({
  enabled: z.boolean().optional(),
  time: clockTime.optional(),
})

/** Every field is optional: the settings screen saves one toggle at a time. */
const notificationPreferencesSchema = z.object({
  coachProgramUpdates: z.boolean().optional(),
  coachWeeklyReview: timedReminder.extend({ day: weekday.optional() }).optional(),
  dailyCheckIn: timedReminder.optional(),
  mealReminders: z
    .object({
      breakfast: timedReminder.optional(),
      dinner: timedReminder.optional(),
      lunch: timedReminder.optional(),
      snack: timedReminder.optional(),
    })
    .optional(),
  timeZone: z.string().refine(isValidTimeZone, "Múi giờ không hợp lệ.").optional(),
  weightReminder: timedReminder.extend({ days: z.array(weekday).max(7).optional() }).optional(),
  workoutReminder: timedReminder
    .extend({
      offsetMinutes: z
        .number()
        .int()
        .refine(
          (value) => (WORKOUT_REMINDER_OFFSETS as readonly number[]).includes(value),
          "Thời gian nhắc trước phải là 15, 30 hoặc 60 phút.",
        )
        .optional(),
    })
    .optional(),
  workoutSessionReminders: z.boolean().optional(),
})

const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const notificationIdParamsSchema = z.object({
  notificationId: z.uuid("Notification id không hợp lệ."),
})

export {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  revokePushSubscriptionSchema,
}
