-- Huawei Health background sync: back off on failed attempts and remember the
-- trainee's UTC offset from their last manual sync.
-- AlterTable
ALTER TABLE "HealthConnection" ADD COLUMN     "lastSyncAttemptAt" TIMESTAMP(3),
ADD COLUMN     "syncTimezoneOffset" TEXT;

-- CreateIndex
CREATE INDEX "HealthConnection_provider_lastSyncAttemptAt_idx" ON "HealthConnection"("provider", "lastSyncAttemptAt");


-- DOWN (manual):
--   DROP INDEX "HealthConnection_provider_lastSyncAttemptAt_idx";
--   ALTER TABLE "HealthConnection" DROP COLUMN "syncTimezoneOffset", DROP COLUMN "lastSyncAttemptAt";
