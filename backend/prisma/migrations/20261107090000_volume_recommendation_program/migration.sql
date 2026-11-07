-- A trainee's answer to a weekly volume recommendation now belongs to the
-- program it was computed in. Before this, rows were keyed by user, muscle and
-- week only, and were found with findFirst then created, so an answer given
-- under one program context was applied to another, and two quick taps could
-- create two rows.

-- AlterTable
ALTER TABLE "VolumeRecommendation" ADD COLUMN "programId" UUID;

-- Existing rows have no program, so they all share the NULL program below.
-- Keep the newest row per (user, week, muscle) before the unique key arrives;
-- older duplicates only ever came from the race being fixed here.
DELETE FROM "VolumeRecommendation" AS older
USING "VolumeRecommendation" AS newer
WHERE older."userId" = newer."userId"
  AND older."weekStart" = newer."weekStart"
  AND older."muscleSlug" IS NOT DISTINCT FROM newer."muscleSlug"
  AND (older."createdAt", older."id") < (newer."createdAt", newer."id");

-- CreateIndex
-- NULLS NOT DISTINCT (Postgres 15+) so rows without a program, or without a
-- muscle, still collide instead of every NULL counting as a new key.
CREATE UNIQUE INDEX "VolumeRecommendation_userId_programId_weekStart_muscleSlug_key"
  ON "VolumeRecommendation"("userId", "programId", "weekStart", "muscleSlug") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "VolumeRecommendation_programId_idx" ON "VolumeRecommendation"("programId");

-- AddForeignKey
ALTER TABLE "VolumeRecommendation" ADD CONSTRAINT "VolumeRecommendation_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DOWN (manual):
--   ALTER TABLE "VolumeRecommendation" DROP CONSTRAINT "VolumeRecommendation_programId_fkey";
--   DROP INDEX "VolumeRecommendation_programId_idx";
--   DROP INDEX "VolumeRecommendation_userId_programId_weekStart_muscleSlug_key";
--   ALTER TABLE "VolumeRecommendation" DROP COLUMN "programId";
--   (Rows deleted as duplicates above are not restored.)
