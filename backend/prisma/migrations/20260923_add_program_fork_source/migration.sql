ALTER TABLE "Program" ADD COLUMN "forkedFromProgramId" UUID;

CREATE INDEX "Program_forkedFromProgramId_idx" ON "Program"("forkedFromProgramId");

UPDATE "Program" AS fork
SET "forkedFromProgramId" = (notification."metadata" ->> 'originalProgramId')::uuid
FROM "Notification" AS notification
WHERE notification."metadata" ->> 'kind' = 'trainee_swapped_exercise'
  AND notification."metadata" ->> 'forkedProgramId' = fork."id"::text
  AND notification."metadata" ->> 'originalProgramId' IS NOT NULL
  AND fork."forkedFromProgramId" IS NULL;
