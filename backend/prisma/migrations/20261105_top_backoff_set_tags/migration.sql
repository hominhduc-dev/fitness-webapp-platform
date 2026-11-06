-- Per-set prescriptions use the existing ExerciseSet target columns.
-- Enum additions preserve all existing tags and rows.
ALTER TYPE "SetIntensityTag" ADD VALUE IF NOT EXISTS 'top_set';
ALTER TYPE "SetIntensityTag" ADD VALUE IF NOT EXISTS 'back_off';
