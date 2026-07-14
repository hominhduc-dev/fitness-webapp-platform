-- TDEE inputs: birth date, biological sex, and activity level. All optional
-- because they're PII and not required to use the app. Used to compute BMR
-- (Mifflin-St Jeor) and TDEE = BMR * activity multiplier for calorie guidance.

CREATE TYPE "UserSex" AS ENUM ('male', 'female');

CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');

ALTER TABLE "User" ADD COLUMN "birthDate" DATE;
ALTER TABLE "User" ADD COLUMN "sex" "UserSex";
ALTER TABLE "User" ADD COLUMN "activityLevel" "ActivityLevel";

-- DOWN (manual rollback):
--   ALTER TABLE "User" DROP COLUMN "activityLevel";
--   ALTER TABLE "User" DROP COLUMN "sex";
--   ALTER TABLE "User" DROP COLUMN "birthDate";
--   DROP TYPE "ActivityLevel";
--   DROP TYPE "UserSex";
