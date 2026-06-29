-- CreateEnum
CREATE TYPE "AIGenerationType" AS ENUM ('workout_program', 'meal_plan');

-- CreateEnum
CREATE TYPE "AIGenerationStatus" AS ENUM ('pending', 'completed', 'failed', 'accepted');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "isAIGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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
