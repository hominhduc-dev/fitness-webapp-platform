CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Variation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exerciseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "equipment" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Variation" ("exerciseId", "name", "equipment", "isDefault", "sortOrder", "createdAt", "updatedAt")
SELECT
    "id",
    'Default',
    "equipment",
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Exercise";

ALTER TABLE "WorkoutExercise"
ADD COLUMN "variationId" UUID;

UPDATE "WorkoutExercise" AS we
SET "variationId" = v."id"
FROM "Variation" AS v
WHERE v."exerciseId" = we."exerciseId"
  AND v."isDefault" = true;

ALTER TABLE "WorkoutExercise"
ALTER COLUMN "variationId" SET NOT NULL;

ALTER TABLE "Variation"
ADD CONSTRAINT "Variation_exerciseId_fkey"
FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutExercise"
ADD CONSTRAINT "WorkoutExercise_variationId_fkey"
FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Variation_exerciseId_name_key" ON "Variation"("exerciseId", "name");
CREATE INDEX "Variation_equipment_idx" ON "Variation"("equipment");
CREATE INDEX "Variation_exerciseId_sortOrder_idx" ON "Variation"("exerciseId", "sortOrder");
CREATE INDEX "WorkoutExercise_variationId_idx" ON "WorkoutExercise"("variationId");

DROP INDEX IF EXISTS "WorkoutExercise_exerciseId_idx";

ALTER TABLE "WorkoutExercise"
DROP CONSTRAINT "WorkoutExercise_exerciseId_fkey";

ALTER TABLE "WorkoutExercise"
DROP COLUMN "exerciseId";

ALTER TABLE "Exercise"
DROP COLUMN "equipment";
