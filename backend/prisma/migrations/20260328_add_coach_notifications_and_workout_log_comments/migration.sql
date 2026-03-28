ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'workout_logged';

CREATE TABLE "WorkoutLogComment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workoutLogId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutLogComment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkoutLogComment"
ADD CONSTRAINT "WorkoutLogComment_workoutLogId_fkey"
FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutLogComment"
ADD CONSTRAINT "WorkoutLogComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WorkoutLogComment_workoutLogId_createdAt_idx" ON "WorkoutLogComment"("workoutLogId", "createdAt");
CREATE INDEX "WorkoutLogComment_authorId_createdAt_idx" ON "WorkoutLogComment"("authorId", "createdAt");
