-- CreateEnum
CREATE TYPE "WorkoutKind" AS ENUM ('push', 'pull', 'legs', 'full_body', 'cardio', 'other');

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "kind" "WorkoutKind";
