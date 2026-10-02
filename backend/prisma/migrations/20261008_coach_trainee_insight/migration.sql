-- AI analysis a coach runs on one trainee: adherence to the assigned program,
-- lift progression, weight, intake and recovery over 7/14/28 days. Stored as an
-- AIGeneration owned by the coach, so it can be read again without new tokens.
-- AlterEnum
ALTER TYPE "AIGenerationType" ADD VALUE 'coach_trainee_insight';


-- DOWN (manual):
--   Postgres cannot drop an enum value. Delete the rows, then recreate the type:
--   DELETE FROM "AIGeneration" WHERE "type" = 'coach_trainee_insight';
--   ALTER TYPE "AIGenerationType" RENAME TO "AIGenerationType_old";
--   CREATE TYPE "AIGenerationType" AS ENUM ('workout_program', 'meal_plan', 'nutrition_insight');
--   ALTER TABLE "AIGeneration" ALTER COLUMN "type" TYPE "AIGenerationType" USING "type"::text::"AIGenerationType";
--   DROP TYPE "AIGenerationType_old";
