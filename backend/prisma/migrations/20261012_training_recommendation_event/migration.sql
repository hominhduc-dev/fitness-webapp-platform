-- One row per engine recommendation for one exercise in one session: the
-- suggestion frozen when the session started (with its inputs and algorithm
-- version, as an audit trail), what the trainee then did, how closely that
-- followed each dimension of the suggestion, and how the next session of the
-- exercise went. Collected so the engine can be tuned on evidence.

-- CreateEnum
CREATE TYPE "TrainingRecommendationType" AS ENUM ('exercise_progression');

-- CreateEnum
CREATE TYPE "TrainingRecommendationAction" AS ENUM ('add_load', 'add_reps', 'maintain', 'reduce_load', 'establish_baseline');

-- CreateEnum
CREATE TYPE "TrainingRecommendationSource" AS ENUM ('session_start', 'log_snapshot');

-- CreateEnum
CREATE TYPE "RecommendationCompliance" AS ENUM ('followed', 'partial', 'modified', 'not_attempted');

-- CreateEnum
CREATE TYPE "RecommendationUserIntent" AS ENUM ('accepted', 'dismissed', 'no_explicit_action');

-- CreateEnum
CREATE TYPE "RecommendationOutcome" AS ENUM ('successful', 'maintained', 'regressed', 'rolled_back', 'insufficient_data');

-- CreateTable
CREATE TABLE "TrainingRecommendationEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "TrainingRecommendationType" NOT NULL DEFAULT 'exercise_progression',
    "source" "TrainingRecommendationSource" NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "programId" UUID,
    "workoutId" UUID NOT NULL,
    "workoutExerciseId" UUID NOT NULL,
    "variationId" UUID,
    "equipment" TEXT,
    "sessionStartedAt" TIMESTAMP(3) NOT NULL,
    "action" "TrainingRecommendationAction" NOT NULL,
    "engineAction" "TrainingRecommendationAction" NOT NULL,
    "heldBy" TEXT,
    "muscleSlug" TEXT,
    "muscleAction" TEXT,
    "muscleVolumeZone" TEXT,
    "setDelta" INTEGER NOT NULL DEFAULT 0,
    "loadIncrementKg" DOUBLE PRECISION,
    "previousWeight" DOUBLE PRECISION,
    "previousReps" INTEGER,
    "previousRir" DOUBLE PRECISION,
    "suggestedWeight" DOUBLE PRECISION,
    "suggestedReps" INTEGER,
    "suggestedRir" DOUBLE PRECISION,
    "suggestedSets" INTEGER NOT NULL,
    "readinessScore" DOUBLE PRECISION,
    "dayAction" TEXT,
    "phase" TEXT,
    "confidence" DOUBLE PRECISION,
    "inputs" JSONB NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandonedAt" TIMESTAMP(3),
    "workoutLogId" UUID,
    "completedAt" TIMESTAMP(3),
    "actualWeight" DOUBLE PRECISION,
    "actualReps" INTEGER,
    "actualRir" DOUBLE PRECISION,
    "actualSets" INTEGER,
    "swapped" BOOLEAN NOT NULL DEFAULT false,
    "loadCompliance" "RecommendationCompliance",
    "repCompliance" "RecommendationCompliance",
    "rirCompliance" "RecommendationCompliance",
    "setCompliance" "RecommendationCompliance",
    "overallCompliance" "RecommendationCompliance",
    "userIntent" "RecommendationUserIntent" NOT NULL DEFAULT 'no_explicit_action',
    "outcome" "RecommendationOutcome",
    "outcomeLogId" UUID,
    "outcomeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "TrainingRecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingRecommendationEvent_userId_workoutId_workoutLogId_idx" ON "TrainingRecommendationEvent"("userId", "workoutId", "workoutLogId");

-- CreateIndex
CREATE INDEX "TrainingRecommendationEvent_userId_variationId_completedAt_idx" ON "TrainingRecommendationEvent"("userId", "variationId", "completedAt");

-- CreateIndex
CREATE INDEX "TrainingRecommendationEvent_workoutLogId_idx" ON "TrainingRecommendationEvent"("workoutLogId");

-- CreateIndex
CREATE INDEX "TrainingRecommendationEvent_shownAt_idx" ON "TrainingRecommendationEvent"("shownAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecommendationEvent_userId_workoutId_sessionStarted_key" ON "TrainingRecommendationEvent"("userId", "workoutId", "sessionStartedAt", "workoutExerciseId");

-- AddForeignKey
ALTER TABLE "TrainingRecommendationEvent" ADD CONSTRAINT "TrainingRecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecommendationEvent" ADD CONSTRAINT "TrainingRecommendationEvent_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Read and written by the backend (service role) only; keep it off the Data API.
ALTER TABLE "TrainingRecommendationEvent" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "TrainingRecommendationEvent" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "TrainingRecommendationEvent" FROM authenticated;
  END IF;
END $$;

-- DOWN (manual):
--   DROP TABLE "TrainingRecommendationEvent";
--   DROP TYPE "RecommendationOutcome";
--   DROP TYPE "RecommendationUserIntent";
--   DROP TYPE "RecommendationCompliance";
--   DROP TYPE "TrainingRecommendationSource";
--   DROP TYPE "TrainingRecommendationAction";
--   DROP TYPE "TrainingRecommendationType";
