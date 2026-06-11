-- Denormalize the owning program onto WorkoutLog so program-scoped exports
-- survive program edits. Coach program edits delete & recreate Workout rows,
-- and WorkoutLog.workoutId is ON DELETE SET NULL, so the workout -> program
-- join breaks for historical logs. Storing programId directly keeps the link.
--
-- No FK is added on purpose: the column is a durable denormalized reference
-- that must survive both workout deletion and program deletion.
ALTER TABLE "WorkoutLog" ADD COLUMN "programId" UUID;

-- Backfill from the live workout -> program relationship for logs whose workout
-- still exists. Already-orphaned logs (workoutId set to NULL by prior program
-- edits) cannot be recovered and remain NULL.
UPDATE "WorkoutLog" wl
SET "programId" = w."programId"
FROM "Workout" w
WHERE wl."workoutId" = w."id"
  AND wl."programId" IS NULL;

CREATE INDEX "WorkoutLog_programId_idx" ON "WorkoutLog"("programId");

-- DOWN (manual rollback):
--   DROP INDEX "WorkoutLog_programId_idx";
--   ALTER TABLE "WorkoutLog" DROP COLUMN "programId";
