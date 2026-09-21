-- A trainee's substitute for one exercise slot in a coach's program.
--
-- Replaces the old behaviour where a swap forked the coach's whole program:
-- the slot stays the coach's, and only this trainee reads the substitution back.

CREATE TABLE "TraineeExerciseOverride" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workoutExerciseId" UUID NOT NULL,
    "variationId" UUID NOT NULL,
    "replacedVariationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraineeExerciseOverride_pkey" PRIMARY KEY ("id")
);

-- One substitution per trainee per slot; a later swap updates the row in place.
CREATE UNIQUE INDEX "TraineeExerciseOverride_userId_workoutExerciseId_key"
    ON "TraineeExerciseOverride"("userId", "workoutExerciseId");

CREATE INDEX "TraineeExerciseOverride_userId_idx" ON "TraineeExerciseOverride"("userId");
CREATE INDEX "TraineeExerciseOverride_workoutExerciseId_idx" ON "TraineeExerciseOverride"("workoutExerciseId");
CREATE INDEX "TraineeExerciseOverride_variationId_idx" ON "TraineeExerciseOverride"("variationId");

ALTER TABLE "TraineeExerciseOverride"
    ADD CONSTRAINT "TraineeExerciseOverride_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TraineeExerciseOverride"
    ADD CONSTRAINT "TraineeExerciseOverride_workoutExerciseId_fkey"
    FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a variation that a trainee is actively
-- substituting should fail loudly rather than silently restore the coach's slot.
ALTER TABLE "TraineeExerciseOverride"
    ADD CONSTRAINT "TraineeExerciseOverride_variationId_fkey"
    FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
