-- CreateEnum
CREATE TYPE "ExerciseImportRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ExerciseImportRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submittedById" UUID NOT NULL,
    "reviewedById" UUID,
    "status" "ExerciseImportRequestStatus" NOT NULL DEFAULT 'pending',
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "rows" JSONB NOT NULL,
    "reviewNote" TEXT,
    "result" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseImportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseImportRequest_status_createdAt_idx" ON "ExerciseImportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExerciseImportRequest_submittedById_idx" ON "ExerciseImportRequest"("submittedById");

-- CreateIndex
CREATE INDEX "ExerciseImportRequest_reviewedById_idx" ON "ExerciseImportRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "ExerciseImportRequest" ADD CONSTRAINT "ExerciseImportRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseImportRequest" ADD CONSTRAINT "ExerciseImportRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
