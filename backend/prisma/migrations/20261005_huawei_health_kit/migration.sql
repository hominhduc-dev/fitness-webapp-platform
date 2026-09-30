-- Huawei Health Kit: per-user OAuth grant and the daily wearable totals it syncs.
-- CreateEnum
CREATE TYPE "WearableSource" AS ENUM ('huawei');

-- CreateTable
CREATE TABLE "HuaweiConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuaweiConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WearableDailySummary" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "source" "WearableSource" NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "activeKcal" DOUBLE PRECISION,
    "avgHeartRate" DOUBLE PRECISION,
    "minHeartRate" DOUBLE PRECISION,
    "maxHeartRate" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WearableDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HuaweiConnection_userId_key" ON "HuaweiConnection"("userId");

-- CreateIndex
CREATE INDEX "HuaweiConnection_lastSyncedAt_idx" ON "HuaweiConnection"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "WearableDailySummary_userId_date_idx" ON "WearableDailySummary"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WearableDailySummary_userId_source_date_key" ON "WearableDailySummary"("userId", "source", "date");

-- AddForeignKey
ALTER TABLE "HuaweiConnection" ADD CONSTRAINT "HuaweiConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearableDailySummary" ADD CONSTRAINT "WearableDailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Both tables are read only by the backend (service role). Supabase exposes the
-- public schema over its Data API, so lock them to everyone else; the grant
-- table holds OAuth tokens.
ALTER TABLE "HuaweiConnection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "HuaweiConnection" FROM anon, authenticated;
ALTER TABLE "WearableDailySummary" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WearableDailySummary" FROM anon, authenticated;

-- DOWN (manual):
--   DROP TABLE "WearableDailySummary";
--   DROP TABLE "HuaweiConnection";
--   DROP TYPE "WearableSource";
