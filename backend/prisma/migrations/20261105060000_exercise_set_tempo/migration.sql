-- Rep cadence per set: "eccentric-pause-concentric-pause", e.g. "3-1-1-0".
-- Held for every rep of the set, but free to differ between the sets of one
-- exercise, which is how a heavy top set and a slower back-off are prescribed.
-- Text rather than four integers because a slot may be "X" (explosive), and the
-- whole cadence is read and written as one token everywhere it appears.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "ExerciseSet" ADD COLUMN IF NOT EXISTS "tempo" TEXT;

COMMIT;
