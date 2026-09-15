-- AI meal plans: diet and allergy filters on the trainee, optional price and
-- prep-time data on foods, and coach review metadata on planned meals.
CREATE TYPE "DietType" AS ENUM ('vegetarian', 'pescatarian');
CREATE TYPE "FoodPriceTier" AS ENUM ('low', 'medium', 'high');

ALTER TABLE "User"
ADD COLUMN "foodAllergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "dietType" "DietType";

ALTER TABLE "Food"
ADD COLUMN "priceTier" "FoodPriceTier",
ADD COLUMN "prepMinutes" INTEGER;

ALTER TABLE "Meal"
ADD COLUMN "coachNote" TEXT,
ADD COLUMN "coachReviewedAt" TIMESTAMP(3);

-- DOWN
--   ALTER TABLE "Meal" DROP COLUMN "coachReviewedAt", DROP COLUMN "coachNote";
--   ALTER TABLE "Food" DROP COLUMN "prepMinutes", DROP COLUMN "priceTier";
--   ALTER TABLE "User" DROP COLUMN "dietType", DROP COLUMN "foodAllergies";
--   DROP TYPE "FoodPriceTier";
--   DROP TYPE "DietType";
