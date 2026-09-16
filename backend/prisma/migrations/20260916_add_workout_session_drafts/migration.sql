CREATE TABLE "WorkoutSessionDraft" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "workoutName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "currentExerciseIndex" INTEGER NOT NULL DEFAULT 0,
    "exercises" JSONB NOT NULL,
    "deletedSetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "schemaVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSessionDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutSessionDraft_userId_workoutId_key" ON "WorkoutSessionDraft"("userId", "workoutId");
CREATE INDEX "WorkoutSessionDraft_userId_updatedAt_idx" ON "WorkoutSessionDraft"("userId", "updatedAt");
CREATE INDEX "WorkoutSessionDraft_workoutId_idx" ON "WorkoutSessionDraft"("workoutId");

ALTER TABLE "WorkoutSessionDraft"
ADD CONSTRAINT "WorkoutSessionDraft_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutSessionDraft"
ADD CONSTRAINT "WorkoutSessionDraft_workoutId_fkey"
FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollback:
--   DROP TABLE IF EXISTS "WorkoutSessionDraft";
