-- Nutrition v2 rebuild.
-- Destructive by design: the previous USDA/FDC-based nutrition data is removed.

TRUNCATE TABLE "MealFoodItem", "Meal", "FoodNutrient", "Food" RESTART IDENTITY CASCADE;

ALTER TABLE "Meal" DROP CONSTRAINT IF EXISTS "Meal_foodId_fkey";

DROP INDEX IF EXISTS "Food_fdcId_key";
DROP INDEX IF EXISTS "Meal_foodId_idx";
DROP INDEX IF EXISTS "FoodNutrient_nutrientKey_idx";
DROP INDEX IF EXISTS "FoodNutrient_foodId_nutrientKey_key";

DROP TABLE IF EXISTS "FoodNutrient";
DROP TYPE IF EXISTS "FoodNutrientKey";

CREATE TYPE "FoodCategory" AS ENUM ('staple', 'protein', 'veg', 'fruit', 'dish', 'drink', 'other');

ALTER TABLE "Food" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "Food" ALTER COLUMN "source" TYPE TEXT USING "source"::TEXT;
DROP TYPE IF EXISTS "FoodSource";
CREATE TYPE "FoodSource" AS ENUM ('system', 'user');
ALTER TABLE "Food" ALTER COLUMN "source" TYPE "FoodSource" USING (
  CASE WHEN "source" = 'user' THEN 'user' ELSE 'system' END
)::"FoodSource";
ALTER TABLE "Food" ALTER COLUMN "source" SET DEFAULT 'system';

ALTER TABLE "Food"
DROP COLUMN IF EXISTS "fdcId",
DROP COLUMN IF EXISTS "brandOwner",
DROP COLUMN IF EXISTS "dataType",
DROP COLUMN IF EXISTS "rawJson",
ADD COLUMN "slug" TEXT,
ADD COLUMN "category" "FoodCategory",
ADD COLUMN "servingLabel" TEXT;

ALTER TABLE "Food"
ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "servingLabel" SET NOT NULL;

CREATE UNIQUE INDEX "Food_slug_key" ON "Food"("slug");
CREATE INDEX "Food_category_idx" ON "Food"("category");

ALTER TABLE "Meal"
DROP COLUMN IF EXISTS "foodId",
DROP COLUMN IF EXISTS "foodNameSnapshot",
DROP COLUMN IF EXISTS "weightGrams",
ADD COLUMN "loggedDate" DATE;

ALTER TABLE "Meal"
ALTER COLUMN "loggedDate" SET NOT NULL;

CREATE UNIQUE INDEX "Meal_userId_loggedDate_type_key" ON "Meal"("userId", "loggedDate", "type");
CREATE INDEX "Meal_userId_loggedDate_idx" ON "Meal"("userId", "loggedDate");

ALTER TABLE "MealFoodItem"
ADD COLUMN "amountValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN "amountUnit" TEXT NOT NULL DEFAULT 'serving',
ADD COLUMN "amountLabel" TEXT,
ADD COLUMN "weightGrams" DOUBLE PRECISION,
ALTER COLUMN "calories" SET DEFAULT 0,
ALTER COLUMN "calories" SET NOT NULL;

ALTER TABLE "User"
ADD COLUMN "dailyProteinGoal" INTEGER NOT NULL DEFAULT 140,
ADD COLUMN "dailyCarbsGoal" INTEGER NOT NULL DEFAULT 280,
ADD COLUMN "dailyFatGoal" INTEGER NOT NULL DEFAULT 70;
