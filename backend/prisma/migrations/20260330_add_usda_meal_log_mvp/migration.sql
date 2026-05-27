CREATE TYPE "FoodNutrientKey" AS ENUM ('calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium');

ALTER TABLE "Food"
ADD COLUMN "fdcId" TEXT,
ADD COLUMN "brandOwner" TEXT,
ADD COLUMN "dataType" TEXT,
ADD COLUMN "rawJson" JSONB;

ALTER TABLE "Meal"
ADD COLUMN "foodId" UUID,
ADD COLUMN "foodNameSnapshot" TEXT,
ADD COLUMN "weightGrams" DOUBLE PRECISION,
ADD COLUMN "fiber" DOUBLE PRECISION,
ADD COLUMN "sugar" DOUBLE PRECISION,
ADD COLUMN "sodium" DOUBLE PRECISION;

ALTER TABLE "Meal"
ALTER COLUMN "calories" TYPE DOUBLE PRECISION USING "calories"::DOUBLE PRECISION,
ALTER COLUMN "protein" TYPE DOUBLE PRECISION USING "protein"::DOUBLE PRECISION,
ALTER COLUMN "carbs" TYPE DOUBLE PRECISION USING "carbs"::DOUBLE PRECISION,
ALTER COLUMN "fat" TYPE DOUBLE PRECISION USING "fat"::DOUBLE PRECISION;

CREATE TABLE "FoodNutrient" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "nutrientKey" "FoodNutrientKey" NOT NULL,
    "nutrientName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "amountPer100g" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Food_fdcId_key" ON "Food"("fdcId");
CREATE INDEX "Meal_foodId_idx" ON "Meal"("foodId");
CREATE INDEX "FoodNutrient_nutrientKey_idx" ON "FoodNutrient"("nutrientKey");
CREATE UNIQUE INDEX "FoodNutrient_foodId_nutrientKey_key" ON "FoodNutrient"("foodId", "nutrientKey");

ALTER TABLE "Meal"
ADD CONSTRAINT "Meal_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FoodNutrient"
ADD CONSTRAINT "FoodNutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
