-- Snapshot the user's weight at the moment they set a target so goal progress
-- is anchored to a real starting point instead of drifting with the chart's
-- selected range (30/90/365d).
ALTER TABLE "User" ADD COLUMN "goalStartWeightKg" DOUBLE PRECISION;

-- Backfill for users who already have a target: use the OLDEST logged weight
-- as the starting anchor. It's a best-effort seed for existing accounts —
-- newly set targets from now on will snapshot the current weight instead.
UPDATE "User" u
SET "goalStartWeightKg" = seed."weightKg"
FROM (
  SELECT DISTINCT ON ("traineeId") "traineeId", "weightKg"
  FROM "BodyMetricEntry"
  WHERE "weightKg" IS NOT NULL
  ORDER BY "traineeId", "recordedAt" ASC
) seed
WHERE u."id" = seed."traineeId"
  AND u."targetWeightKg" IS NOT NULL
  AND u."goalStartWeightKg" IS NULL;

-- DOWN (manual rollback):
--   ALTER TABLE "User" DROP COLUMN "goalStartWeightKg";
