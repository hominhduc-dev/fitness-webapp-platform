-- Repair drift from the original muscle profile migration. The migration was
-- recorded as applied while this additive column was absent in the database.
ALTER TABLE "Variation"
ADD COLUMN IF NOT EXISTS "muscleProfileConfidence" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Variation_muscleProfileConfidence_check'
      AND conrelid = '"Variation"'::regclass
  ) THEN
    ALTER TABLE "Variation"
    ADD CONSTRAINT "Variation_muscleProfileConfidence_check"
    CHECK ("muscleProfileConfidence" IS NULL OR ("muscleProfileConfidence" >= 0 AND "muscleProfileConfidence" <= 1));
  END IF;
END $$;
