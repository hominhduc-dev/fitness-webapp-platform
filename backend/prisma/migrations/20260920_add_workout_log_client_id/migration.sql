ALTER TABLE "WorkoutLog" ADD COLUMN "clientLogId" UUID;

-- NULLs never collide, so existing rows and online logs without a key are unaffected.
CREATE UNIQUE INDEX "WorkoutLog_userId_clientLogId_key" ON "WorkoutLog"("userId", "clientLogId");

-- Rollback:
--   DROP INDEX IF EXISTS "WorkoutLog_userId_clientLogId_key";
--   ALTER TABLE "WorkoutLog" DROP COLUMN IF EXISTS "clientLogId";
