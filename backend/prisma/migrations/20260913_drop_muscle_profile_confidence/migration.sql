ALTER TABLE "Variation" DROP CONSTRAINT IF EXISTS "Variation_muscleProfileConfidence_check";

ALTER TABLE "Variation" DROP COLUMN IF EXISTS "muscleProfileConfidence";
