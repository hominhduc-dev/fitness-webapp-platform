-- Weight synced from a wearable lands in the weight log; source/externalId mark it
-- so a re-sync updates the same day's entry instead of adding another.
-- AlterTable
ALTER TABLE "BodyMetricEntry" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "HealthProvider";

-- CreateIndex
CREATE UNIQUE INDEX "BodyMetricEntry_traineeId_externalId_key" ON "BodyMetricEntry"("traineeId", "externalId");


-- DOWN (manual):
--   DROP INDEX "BodyMetricEntry_traineeId_externalId_key";
--   ALTER TABLE "BodyMetricEntry" DROP COLUMN "externalId", DROP COLUMN "source";
