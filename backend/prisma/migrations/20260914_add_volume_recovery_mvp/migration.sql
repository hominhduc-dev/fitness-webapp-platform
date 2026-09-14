-- CreateEnum
CREATE TYPE "VolumeProfileSource" AS ENUM ('system', 'coach', 'learned');

-- CreateEnum
CREATE TYPE "VolumeRecommendationAction" AS ENUM ('increase', 'maintain', 'decrease', 'deload');

-- CreateEnum
CREATE TYPE "VolumeRecommendationStatus" AS ENUM ('pending', 'accepted', 'dismissed', 'applied');

-- CreateTable
CREATE TABLE "RecoveryCheckIn" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "checkInDate" DATE NOT NULL,
    "sleepMinutes" INTEGER,
    "sleepQuality" INTEGER,
    "fatigue" INTEGER NOT NULL,
    "stress" INTEGER,
    "readinessScore" DOUBLE PRECISION,
    "algorithmVersion" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCheckIn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecoveryCheckIn_sleepMinutes_check" CHECK ("sleepMinutes" IS NULL OR "sleepMinutes" BETWEEN 0 AND 1440),
    CONSTRAINT "RecoveryCheckIn_sleepQuality_check" CHECK ("sleepQuality" IS NULL OR "sleepQuality" BETWEEN 1 AND 5),
    CONSTRAINT "RecoveryCheckIn_fatigue_check" CHECK ("fatigue" BETWEEN 1 AND 5),
    CONSTRAINT "RecoveryCheckIn_stress_check" CHECK ("stress" IS NULL OR "stress" BETWEEN 1 AND 5),
    CONSTRAINT "RecoveryCheckIn_readinessScore_check" CHECK ("readinessScore" IS NULL OR "readinessScore" BETWEEN 0 AND 100)
);

-- CreateTable
CREATE TABLE "MuscleRecoveryRating" (
    "checkInId" UUID NOT NULL,
    "muscleSlug" TEXT NOT NULL,
    "soreness" INTEGER NOT NULL,
    "pain" INTEGER,

    CONSTRAINT "MuscleRecoveryRating_pkey" PRIMARY KEY ("checkInId", "muscleSlug"),
    CONSTRAINT "MuscleRecoveryRating_soreness_check" CHECK ("soreness" BETWEEN 0 AND 5),
    CONSTRAINT "MuscleRecoveryRating_pain_check" CHECK ("pain" IS NULL OR "pain" BETWEEN 0 AND 5)
);

-- CreateTable
CREATE TABLE "UserMuscleVolumeProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "muscleSlug" TEXT NOT NULL,
    "mevSets" DOUBLE PRECISION,
    "mavMinSets" DOUBLE PRECISION,
    "mavMaxSets" DOUBLE PRECISION,
    "mrvSets" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" "VolumeProfileSource" NOT NULL DEFAULT 'system',
    "weeksObserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMuscleVolumeProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserMuscleVolumeProfile_landmarks_check" CHECK (
      ("mevSets" IS NULL OR "mevSets" >= 0) AND
      ("mavMinSets" IS NULL OR "mavMinSets" >= 0) AND
      ("mavMaxSets" IS NULL OR "mavMaxSets" >= 0) AND
      ("mrvSets" IS NULL OR "mrvSets" >= 0) AND
      ("mevSets" IS NULL OR "mavMinSets" IS NULL OR "mevSets" <= "mavMinSets") AND
      ("mavMinSets" IS NULL OR "mavMaxSets" IS NULL OR "mavMinSets" <= "mavMaxSets") AND
      ("mavMaxSets" IS NULL OR "mrvSets" IS NULL OR "mavMaxSets" <= "mrvSets")
    ),
    CONSTRAINT "UserMuscleVolumeProfile_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
    CONSTRAINT "UserMuscleVolumeProfile_weeksObserved_check" CHECK ("weeksObserved" >= 0)
);

-- CreateTable
CREATE TABLE "VolumeRecommendation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "muscleSlug" TEXT,
    "weekStart" DATE NOT NULL,
    "action" "VolumeRecommendationAction" NOT NULL,
    "status" "VolumeRecommendationStatus" NOT NULL DEFAULT 'pending',
    "currentSets" DOUBLE PRECISION NOT NULL,
    "recommendedSets" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolumeRecommendation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VolumeRecommendation_sets_check" CHECK ("currentSets" >= 0 AND "recommendedSets" >= 0),
    CONSTRAINT "VolumeRecommendation_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1)
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCheckIn_userId_checkInDate_key" ON "RecoveryCheckIn"("userId", "checkInDate");
CREATE INDEX "MuscleRecoveryRating_muscleSlug_idx" ON "MuscleRecoveryRating"("muscleSlug");
CREATE UNIQUE INDEX "UserMuscleVolumeProfile_userId_muscleSlug_key" ON "UserMuscleVolumeProfile"("userId", "muscleSlug");
CREATE INDEX "UserMuscleVolumeProfile_muscleSlug_idx" ON "UserMuscleVolumeProfile"("muscleSlug");
CREATE INDEX "VolumeRecommendation_userId_weekStart_idx" ON "VolumeRecommendation"("userId", "weekStart");
CREATE INDEX "VolumeRecommendation_muscleSlug_idx" ON "VolumeRecommendation"("muscleSlug");

-- AddForeignKey
ALTER TABLE "RecoveryCheckIn" ADD CONSTRAINT "RecoveryCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MuscleRecoveryRating" ADD CONSTRAINT "MuscleRecoveryRating_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "RecoveryCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MuscleRecoveryRating" ADD CONSTRAINT "MuscleRecoveryRating_muscleSlug_fkey" FOREIGN KEY ("muscleSlug") REFERENCES "MuscleRegion"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserMuscleVolumeProfile" ADD CONSTRAINT "UserMuscleVolumeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMuscleVolumeProfile" ADD CONSTRAINT "UserMuscleVolumeProfile_muscleSlug_fkey" FOREIGN KEY ("muscleSlug") REFERENCES "MuscleRegion"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VolumeRecommendation" ADD CONSTRAINT "VolumeRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VolumeRecommendation" ADD CONSTRAINT "VolumeRecommendation_muscleSlug_fkey" FOREIGN KEY ("muscleSlug") REFERENCES "MuscleRegion"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
