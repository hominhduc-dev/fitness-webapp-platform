ALTER TABLE "Workout" ADD COLUMN "weekIndex" INTEGER;

CREATE INDEX "Workout_programId_weekIndex_idx" ON "Workout"("programId", "weekIndex");
