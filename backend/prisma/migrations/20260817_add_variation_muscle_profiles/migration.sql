-- CreateEnum
CREATE TYPE "ExerciseActivityType" AS ENUM ('strength', 'cardio', 'mobility', 'sport', 'other');

-- CreateEnum
CREATE TYPE "MuscleTargetRole" AS ENUM ('primary', 'secondary');

-- CreateEnum
CREATE TYPE "MuscleProfileStatus" AS ENUM ('pending', 'approved');

-- CreateEnum
CREATE TYPE "MuscleProfileSource" AS ENUM ('ai', 'manual');

-- AlterTable: all new classification fields are additive for the dual-read rollout.
ALTER TABLE "Variation" ADD COLUMN "activityType" "ExerciseActivityType",
ADD COLUMN "muscleProfileConfidence" DOUBLE PRECISION,
ADD COLUMN "muscleProfileRationale" TEXT,
ADD COLUMN "muscleProfileReviewedAt" TIMESTAMP(3),
ADD COLUMN "muscleProfileReviewedById" UUID,
ADD COLUMN "muscleProfileSource" "MuscleProfileSource",
ADD COLUMN "muscleProfileStatus" "MuscleProfileStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "MuscleRegion" (
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MuscleRegion_pkey" PRIMARY KEY ("slug")
);

-- Seed the exact taxonomy used by the front/back SVG artwork.
INSERT INTO "MuscleRegion" ("slug") VALUES
  ('abs'),
  ('adductors'),
  ('biceps'),
  ('calves'),
  ('chest'),
  ('deltoids'),
  ('forearm'),
  ('gluteal'),
  ('hamstring'),
  ('lower-back'),
  ('obliques'),
  ('quadriceps'),
  ('tibialis'),
  ('trapezius'),
  ('triceps'),
  ('upper-back');

-- CreateTable
CREATE TABLE "VariationMuscleTarget" (
    "variationId" UUID NOT NULL,
    "muscleSlug" TEXT NOT NULL,
    "role" "MuscleTargetRole" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariationMuscleTarget_pkey" PRIMARY KEY ("variationId", "muscleSlug"),
    CONSTRAINT "VariationMuscleTarget_position_check" CHECK ("position" >= 0)
);

-- Confidence is optional while a row is pending, but any stored score is normalized.
ALTER TABLE "Variation"
ADD CONSTRAINT "Variation_muscleProfileConfidence_check"
CHECK ("muscleProfileConfidence" IS NULL OR ("muscleProfileConfidence" >= 0 AND "muscleProfileConfidence" <= 1));

-- CreateIndex
CREATE INDEX "VariationMuscleTarget_muscleSlug_role_idx" ON "VariationMuscleTarget"("muscleSlug", "role");
CREATE INDEX "VariationMuscleTarget_variationId_role_position_idx" ON "VariationMuscleTarget"("variationId", "role", "position");
CREATE INDEX "Variation_activityType_muscleProfileStatus_idx" ON "Variation"("activityType", "muscleProfileStatus");
CREATE INDEX "Variation_muscleProfileReviewedById_idx" ON "Variation"("muscleProfileReviewedById");

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_muscleProfileReviewedById_fkey"
FOREIGN KEY ("muscleProfileReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VariationMuscleTarget" ADD CONSTRAINT "VariationMuscleTarget_variationId_fkey"
FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariationMuscleTarget" ADD CONSTRAINT "VariationMuscleTarget_muscleSlug_fkey"
FOREIGN KEY ("muscleSlug") REFERENCES "MuscleRegion"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These tables are server-only. Keep them inaccessible through Supabase Data API.
ALTER TABLE "MuscleRegion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VariationMuscleTarget" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "MuscleRegion", "VariationMuscleTarget" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "MuscleRegion", "VariationMuscleTarget" FROM authenticated;
  END IF;
END $$;
