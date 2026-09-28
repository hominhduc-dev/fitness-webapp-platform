-- A coach's own exercise is private until an admin shares it with everyone.
CREATE TYPE "ExerciseShareStatus" AS ENUM ('private', 'pending', 'shared', 'rejected');

ALTER TABLE "Exercise"
    ADD COLUMN "shareStatus" "ExerciseShareStatus" NOT NULL DEFAULT 'private',
    ADD COLUMN "shareRequestedAt" TIMESTAMP(3),
    ADD COLUMN "shareReviewedAt" TIMESTAMP(3),
    ADD COLUMN "shareReviewedById" UUID,
    ADD COLUMN "shareReviewNote" TEXT;

CREATE INDEX "Exercise_shareStatus_shareRequestedAt_idx" ON "Exercise"("shareStatus", "shareRequestedAt");
CREATE INDEX "Exercise_shareReviewedById_idx" ON "Exercise"("shareReviewedById");

ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_shareReviewedById_fkey"
    FOREIGN KEY ("shareReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Exercises an admin created or imported were library exercises all along;
-- they keep their creator but become shared so the new rule doesn't hide them.
UPDATE "Exercise" AS e
SET "shareStatus" = 'shared', "shareReviewedAt" = e."createdAt", "shareReviewedById" = e."createdById"
FROM "User" AS u
WHERE e."createdById" = u."id" AND u."role" = 'admin';

-- DOWN (manual):
--   ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_shareReviewedById_fkey";
--   DROP INDEX "Exercise_shareReviewedById_idx";
--   DROP INDEX "Exercise_shareStatus_shareRequestedAt_idx";
--   ALTER TABLE "Exercise" DROP COLUMN "shareReviewNote", DROP COLUMN "shareReviewedById",
--     DROP COLUMN "shareReviewedAt", DROP COLUMN "shareRequestedAt", DROP COLUMN "shareStatus";
--   DROP TYPE "ExerciseShareStatus";
