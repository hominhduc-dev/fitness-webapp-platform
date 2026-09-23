-- Micronutrients.
--
-- Macros (kcal, protein, carbs, fat) stay as columns: every daily total, the
-- AI meal planner and the dashboard read them. Everything else lives in a
-- nutrient catalog plus one row per food and nutrient, so adding the next
-- vitamin is an INSERT here rather than a column on three tables.
--
-- A logged item keeps its own snapshot in "MealFoodItem"."nutrients", the
-- same way it already snapshots macros: correcting a food later must not
-- rewrite what a trainee ate last month.
--
-- The old "fiber" / "sugar" / "sodium" columns were never filled (zero rows
-- carry a value) and are no longer read; a later migration can drop them.

-- CreateEnum
CREATE TYPE "NutrientKind" AS ENUM ('macro_detail', 'mineral', 'vitamin');

-- CreateEnum
CREATE TYPE "NutrientSource" AS ENUM ('usda', 'ai', 'manual');

-- AlterEnum
ALTER TYPE "AIGenerationType" ADD VALUE 'nutrition_insight';

-- CreateTable
CREATE TABLE "Nutrient" (
    "code" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "kind" "NutrientKind" NOT NULL,
    "isLimit" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Nutrient_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "FoodNutrient" (
    "foodId" UUID NOT NULL,
    "nutrientCode" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" "NutrientSource" NOT NULL,
    "sourceRef" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNutrient_pkey" PRIMARY KEY ("foodId","nutrientCode")
);

-- AlterTable
ALTER TABLE "MealFoodItem" ADD COLUMN "nutrients" JSONB;

-- CreateIndex
CREATE INDEX "FoodNutrient_nutrientCode_idx" ON "FoodNutrient"("nutrientCode");

-- AddForeignKey
ALTER TABLE "FoodNutrient" ADD CONSTRAINT "FoodNutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNutrient" ADD CONSTRAINT "FoodNutrient_nutrientCode_fkey" FOREIGN KEY ("nutrientCode") REFERENCES "Nutrient"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog. Units follow USDA FoodData Central: vitamin A as µg RAE, folate
-- as µg DFE.
INSERT INTO "Nutrient" ("code", "nameVi", "nameEn", "unit", "kind", "isLimit", "sortOrder") VALUES
  ('fiber',         'Chất xơ',          'Fiber',          'g',  'macro_detail', false, 10),
  ('sugar',         'Đường',            'Sugars',         'g',  'macro_detail', true,  20),
  ('saturated_fat', 'Chất béo bão hoà', 'Saturated fat',  'g',  'macro_detail', true,  30),
  ('cholesterol',   'Cholesterol',      'Cholesterol',    'mg', 'macro_detail', false, 40),
  ('sodium',        'Natri',            'Sodium',         'mg', 'mineral',      true,  50),
  ('potassium',     'Kali',             'Potassium',      'mg', 'mineral',      false, 60),
  ('calcium',       'Canxi',            'Calcium',        'mg', 'mineral',      false, 70),
  ('iron',          'Sắt',              'Iron',           'mg', 'mineral',      false, 80),
  ('magnesium',     'Magie',            'Magnesium',      'mg', 'mineral',      false, 90),
  ('zinc',          'Kẽm',              'Zinc',           'mg', 'mineral',      false, 100),
  ('vitamin_a',     'Vitamin A',        'Vitamin A',      'µg', 'vitamin',      false, 110),
  ('vitamin_c',     'Vitamin C',        'Vitamin C',      'mg', 'vitamin',      false, 120),
  ('vitamin_d',     'Vitamin D',        'Vitamin D',      'µg', 'vitamin',      false, 130),
  ('vitamin_b12',   'Vitamin B12',      'Vitamin B12',    'µg', 'vitamin',      false, 140),
  ('folate',        'Folate',           'Folate',         'µg', 'vitamin',      false, 150);

-- Server-only, like the other catalog tables: keep them off the Data API.
ALTER TABLE "Nutrient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FoodNutrient" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Nutrient", "FoodNutrient" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Nutrient", "FoodNutrient" FROM authenticated;
  END IF;
END $$;
