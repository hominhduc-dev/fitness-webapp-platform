-- A meal plan the trainee threw away is kept rather than deleted: the row is
-- what the daily generation budget counts, so removing it would hand back a
-- free generation on every discard.
ALTER TYPE "AIGenerationStatus" ADD VALUE 'discarded';
