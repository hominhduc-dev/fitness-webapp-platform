-- Notifications split into two groups:
--   * event-based: a coach assigns or updates a program (sent right away)
--   * scheduled:   an unfinished workout session, a weight-log reminder and the
--                  morning check-in, produced by the backend scheduler
--
-- Scheduled reminders fire from a polling job, and more than one backend
-- instance may run it. "dedupeKey" makes each reminder at-most-once: the job
-- inserts with a deterministic key (e.g. weight_reminder:<user>:2026-09-20) and
-- a unique violation means another tick already sent it.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'program_updated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'workout_session_open';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'weight_reminder';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "coachProgramUpdates" BOOLEAN NOT NULL DEFAULT true,
    "workoutSessionReminders" BOOLEAN NOT NULL DEFAULT true,
    "weightReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weightReminderTime" TEXT NOT NULL DEFAULT '07:00',
    "weightReminderDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "dailyCheckInEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyCheckInTime" TEXT NOT NULL DEFAULT '07:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
-- The scheduler scans only users who opted into a reminder.
CREATE INDEX IF NOT EXISTS "NotificationPreference_weightReminderEnabled_idx" ON "NotificationPreference"("weightReminderEnabled");
CREATE INDEX IF NOT EXISTS "NotificationPreference_dailyCheckInEnabled_idx" ON "NotificationPreference"("dailyCheckInEnabled");

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The stale-session job filters drafts by age.
CREATE INDEX IF NOT EXISTS "WorkoutSessionDraft_startedAt_idx" ON "WorkoutSessionDraft"("startedAt");

-- Preferences are read and written by the backend only.
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "NotificationPreference" FROM anon, authenticated;

-- DOWN (manual rollback):
--   DROP TABLE IF EXISTS "NotificationPreference";
--   DROP INDEX IF EXISTS "WorkoutSessionDraft_startedAt_idx";
--   DROP INDEX IF EXISTS "Notification_dedupeKey_key";
--   ALTER TABLE "Notification" DROP COLUMN IF EXISTS "dedupeKey";
--   -- Postgres cannot drop enum values. Rows using the new types must be
--   -- deleted or retyped first, then the enum recreated without them.
