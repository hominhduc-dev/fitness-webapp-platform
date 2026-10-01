-- CreateEnum
CREATE TYPE "HealthProvider" AS ENUM ('huawei');

-- AlterTable
ALTER TABLE "RecoveryCheckIn"
ADD COLUMN "sleepSource" TEXT,
ADD COLUMN "stressSource" TEXT;

-- Recovery stress previously used a 1-5 scale. Preserve the old meaning while
-- moving the system to Huawei's 1-99 scale:
-- 1 -> 1, 2 -> 26, 3 -> 50, 4 -> 75, 5 -> 99.
UPDATE "RecoveryCheckIn"
SET "stress" = ROUND(1 + (("stress" - 1) * 98.0 / 4.0))
WHERE "stress" BETWEEN 1 AND 5;

ALTER TABLE "RecoveryCheckIn"
ADD CONSTRAINT "RecoveryCheckIn_stress_1_99_check"
CHECK ("stress" IS NULL OR ("stress" BETWEEN 1 AND 99));

-- CreateTable
CREATE TABLE "HealthConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "dataRegionBaseUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthDailySummary" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "activeCalories" DOUBLE PRECISION,
    "restingCalories" DOUBLE PRECISION,
    "sleepMinutes" INTEGER,
    "deepSleepMinutes" INTEGER,
    "lightSleepMinutes" INTEGER,
    "remSleepMinutes" INTEGER,
    "awakeMinutes" INTEGER,
    "restingHeartRate" DOUBLE PRECISION,
    "avgHeartRate" DOUBLE PRECISION,
    "minHeartRate" DOUBLE PRECISION,
    "maxHeartRate" DOUBLE PRECISION,
    "hrvRmssd" DOUBLE PRECISION,
    "stressAvg" DOUBLE PRECISION,
    "spo2Avg" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthWorkout" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "activityType" TEXT,
    "name" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER,
    "calories" DOUBLE PRECISION,
    "distanceMeters" DOUBLE PRECISION,
    "steps" INTEGER,
    "avgHeartRate" DOUBLE PRECISION,
    "minHeartRate" DOUBLE PRECISION,
    "maxHeartRate" DOUBLE PRECISION,
    "rawData" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthConnection_userId_provider_key" ON "HealthConnection"("userId", "provider");
CREATE INDEX "HealthConnection_provider_expiresAt_idx" ON "HealthConnection"("provider", "expiresAt");

CREATE UNIQUE INDEX "HealthDailySummary_userId_provider_date_key" ON "HealthDailySummary"("userId", "provider", "date");
CREATE INDEX "HealthDailySummary_userId_date_idx" ON "HealthDailySummary"("userId", "date");

CREATE UNIQUE INDEX "HealthWorkout_userId_provider_externalId_key" ON "HealthWorkout"("userId", "provider", "externalId");
CREATE INDEX "HealthWorkout_userId_startTime_idx" ON "HealthWorkout"("userId", "startTime");

-- AddForeignKey
ALTER TABLE "HealthConnection" ADD CONSTRAINT "HealthConnection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthDailySummary" ADD CONSTRAINT "HealthDailySummary_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthWorkout" ADD CONSTRAINT "HealthWorkout_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
