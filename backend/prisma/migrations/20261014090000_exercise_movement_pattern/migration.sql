-- Additive: the movement an exercise trains (push/pull/squat/hinge...), set by
-- coaches/admins or backfilled by the classifier. Null means "not classified
-- yet", so existing rows and clients are unaffected.
CREATE TYPE "MovementPattern" AS ENUM (
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
    'squat',
    'hinge',
    'lunge',
    'carry',
    'core',
    'isolation',
    'cardio',
    'mobility',
    'other'
);

ALTER TABLE "Exercise" ADD COLUMN "movementPattern" "MovementPattern";

-- Library pages and substitution filter by pattern.
CREATE INDEX "Exercise_movementPattern_idx" ON "Exercise"("movementPattern");

-- DOWN (manual):
--   DROP INDEX "Exercise_movementPattern_idx";
--   ALTER TABLE "Exercise" DROP COLUMN "movementPattern";
--   DROP TYPE "MovementPattern";
