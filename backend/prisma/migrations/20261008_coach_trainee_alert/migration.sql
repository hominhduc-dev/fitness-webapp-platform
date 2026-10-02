-- A coach is told when one of their trainees needs a look: a lift that has
-- stalled for three weeks, sessions missed against the plan, or several days
-- of low readiness. One notification type; the kind lives in its metadata.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'coach_trainee_alert';

-- DOWN (manual rollback):
--   -- Postgres cannot drop enum values. Delete the rows using it, then
--   -- recreate the enum without 'coach_trainee_alert'.
--   DELETE FROM "Notification" WHERE "type" = 'coach_trainee_alert';
