-- Phase 2 of scheduled notifications:
--   * meal reminders per meal window (breakfast / lunch / dinner / snack), sent
--     only while that meal has no logged calories for the day
--   * workout reminder shortly before the user's usual training time, on days
--     their schedule has a workout
--   * weekly trainee review for coaches at the end of the week
--
-- Meal and workout reminders stay off until the user opts in. The coach weekly
-- review is on by default (Sunday 18:00 in the coach's zone).

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'coach_weekly_review';

ALTER TABLE "NotificationPreference"
ADD COLUMN IF NOT EXISTS "breakfastReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "breakfastReminderTime" TEXT NOT NULL DEFAULT '07:30',
ADD COLUMN IF NOT EXISTS "lunchReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lunchReminderTime" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN IF NOT EXISTS "dinnerReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dinnerReminderTime" TEXT NOT NULL DEFAULT '18:30',
ADD COLUMN IF NOT EXISTS "snackReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "snackReminderTime" TEXT NOT NULL DEFAULT '15:30',
ADD COLUMN IF NOT EXISTS "workoutReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "workoutReminderTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS "workoutReminderOffsetMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "coachWeeklyReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "coachWeeklyReviewDay" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "coachWeeklyReviewTime" TEXT NOT NULL DEFAULT '18:00';

-- The workout-reminder job scans only users who opted in.
CREATE INDEX IF NOT EXISTS "NotificationPreference_workoutReminderEnabled_idx"
ON "NotificationPreference"("workoutReminderEnabled");

-- The notification bell lists a user's newest notifications.
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");

-- DOWN (manual rollback):
--   DROP INDEX IF EXISTS "Notification_userId_createdAt_idx";
--   DROP INDEX IF EXISTS "NotificationPreference_workoutReminderEnabled_idx";
--   ALTER TABLE "NotificationPreference"
--     DROP COLUMN IF EXISTS "breakfastReminderEnabled", DROP COLUMN IF EXISTS "breakfastReminderTime",
--     DROP COLUMN IF EXISTS "lunchReminderEnabled", DROP COLUMN IF EXISTS "lunchReminderTime",
--     DROP COLUMN IF EXISTS "dinnerReminderEnabled", DROP COLUMN IF EXISTS "dinnerReminderTime",
--     DROP COLUMN IF EXISTS "snackReminderEnabled", DROP COLUMN IF EXISTS "snackReminderTime",
--     DROP COLUMN IF EXISTS "workoutReminderEnabled", DROP COLUMN IF EXISTS "workoutReminderTime",
--     DROP COLUMN IF EXISTS "workoutReminderOffsetMinutes",
--     DROP COLUMN IF EXISTS "coachWeeklyReviewEnabled", DROP COLUMN IF EXISTS "coachWeeklyReviewDay",
--     DROP COLUMN IF EXISTS "coachWeeklyReviewTime";
--   -- Postgres cannot drop the 'coach_weekly_review' enum value in place.
