ALTER TABLE "WorkoutLog" ADD COLUMN "plannedDate" DATE;

UPDATE "WorkoutLog"
SET "plannedDate" = ("startedAt" AT TIME ZONE 'UTC')::date
WHERE "plannedDate" IS NULL;

CREATE INDEX "WorkoutLog_userId_plannedDate_idx" ON "WorkoutLog"("userId", "plannedDate");

-- DOWN (manual rollback):
--   DROP INDEX "WorkoutLog_userId_plannedDate_idx";
--   ALTER TABLE "WorkoutLog" DROP COLUMN "plannedDate";
