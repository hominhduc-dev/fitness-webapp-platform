CREATE TYPE "FoodReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "Food"
ADD COLUMN "reviewStatus" "FoodReviewStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "reviewedById" UUID;

UPDATE "Food"
SET "reviewStatus" = 'approved'
WHERE "source" = 'system';

CREATE INDEX "Food_reviewStatus_createdAt_idx" ON "Food"("reviewStatus", "createdAt");
CREATE INDEX "Food_reviewedById_idx" ON "Food"("reviewedById");

ALTER TABLE "Food"
ADD CONSTRAINT "Food_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
