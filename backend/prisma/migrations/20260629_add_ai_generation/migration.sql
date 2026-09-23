-- Backfill migration: the AIGeneration table and its enums were originally
-- applied straight to the database (e.g. via `prisma db push`) without ever
-- generating a migration file, so migration history never recorded their
-- creation. This recreates that missing step so `prisma migrate dev` can
-- replay full history against the shadow database; it is marked as already
-- applied on the real database via `prisma migrate resolve --applied`,
-- since the table already exists there.

-- CreateEnum
CREATE TYPE "AIGenerationType" AS ENUM ('workout_program', 'meal_plan');

-- CreateEnum
CREATE TYPE "AIGenerationStatus" AS ENUM ('pending', 'completed', 'failed', 'accepted');

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AIGenerationType" NOT NULL,
    "status" "AIGenerationStatus" NOT NULL DEFAULT 'pending',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "programId" UUID,
    "tokenUsage" INTEGER,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIGeneration_userId_type_createdAt_idx" ON "AIGeneration"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
