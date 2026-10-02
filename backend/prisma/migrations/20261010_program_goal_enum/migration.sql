-- Program.goal was free text, mapped to a training goal at every read. It is
-- now an enum. Existing values are mapped with the same synonyms the backend's
-- normalizeTrainingGoal used (case-insensitive, spaces and hyphens read as
-- underscores); a value that maps to nothing becomes NULL, which reads exactly
-- as it did before: a program with no recognised goal.
CREATE TYPE "TrainingGoal" AS ENUM (
    'athletic_performance',
    'endurance',
    'fat_loss',
    'general_fitness',
    'hypertrophy',
    'powerbuilding',
    'rehab_corrective',
    'strength'
);

ALTER TABLE "Program" ALTER COLUMN "goal" TYPE "TrainingGoal" USING (
  CASE regexp_replace(lower(trim("goal")), '[\s-]+', '_', 'g')
    WHEN 'build_muscle' THEN 'hypertrophy'
    WHEN 'hypertrophy' THEN 'hypertrophy'
    WHEN 'muscle_gain' THEN 'hypertrophy'
    WHEN 'tang_co' THEN 'hypertrophy'
    WHEN 'tăng_cơ' THEN 'hypertrophy'
    WHEN 'strength' THEN 'strength'
    WHEN 'increase_strength' THEN 'strength'
    WHEN 'tang_suc_manh' THEN 'strength'
    WHEN 'tăng_sức_mạnh' THEN 'strength'
    WHEN 'powerbuilding' THEN 'powerbuilding'
    WHEN 'power_building' THEN 'powerbuilding'
    WHEN 'strength_hypertrophy' THEN 'powerbuilding'
    WHEN 'lose_weight' THEN 'fat_loss'
    WHEN 'fat_loss' THEN 'fat_loss'
    WHEN 'weight_loss' THEN 'fat_loss'
    WHEN 'recomposition' THEN 'fat_loss'
    WHEN 'body_recomposition' THEN 'fat_loss'
    WHEN 'giam_mo' THEN 'fat_loss'
    WHEN 'giảm_mỡ' THEN 'fat_loss'
    WHEN 'endurance' THEN 'endurance'
    WHEN 'improve_endurance' THEN 'endurance'
    WHEN 'suc_ben' THEN 'endurance'
    WHEN 'sức_bền' THEN 'endurance'
    WHEN 'general' THEN 'general_fitness'
    WHEN 'general_fitness' THEN 'general_fitness'
    WHEN 'fitness' THEN 'general_fitness'
    WHEN 'tong_hop' THEN 'general_fitness'
    WHEN 'tổng_hợp' THEN 'general_fitness'
    WHEN 'athletic' THEN 'athletic_performance'
    WHEN 'athletic_performance' THEN 'athletic_performance'
    WHEN 'sport' THEN 'athletic_performance'
    WHEN 'sports_performance' THEN 'athletic_performance'
    WHEN 'rehab' THEN 'rehab_corrective'
    WHEN 'corrective' THEN 'rehab_corrective'
    WHEN 'rehab_corrective' THEN 'rehab_corrective'
    WHEN 'rehabilitation' THEN 'rehab_corrective'
    WHEN 'prehab' THEN 'rehab_corrective'
    WHEN 'phuc_hoi' THEN 'rehab_corrective'
    WHEN 'phục_hồi' THEN 'rehab_corrective'
    ELSE NULL
  END
)::"TrainingGoal";

-- DOWN (manual):
--   ALTER TABLE "Program" ALTER COLUMN "goal" TYPE TEXT USING "goal"::TEXT;
--   DROP TYPE "TrainingGoal";
--   (Free-text goals that mapped to NULL are not recoverable.)
