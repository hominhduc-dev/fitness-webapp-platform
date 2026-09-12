-- Coaches tag individual sets with the training method the trainee should use
-- (myo-rep match, drop set, rest-pause, cluster, to failure, warm-up). A set
-- with no tag is a normal straight set, so the column is nullable and no
-- backfill is needed.
CREATE TYPE "SetIntensityTag" AS ENUM ('mrm', 'drop_set', 'rest_pause', 'cluster', 'failure', 'warmup');

ALTER TABLE "ExerciseSet" ADD COLUMN "intensityTag" "SetIntensityTag";
