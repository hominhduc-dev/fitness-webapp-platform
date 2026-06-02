-- Remove MealFoodItem dependency on Recipe before dropping recipe tables.
ALTER TABLE "MealFoodItem" DROP CONSTRAINT IF EXISTS "MealFoodItem_sourceRecipeId_fkey";
ALTER TABLE "MealFoodItem" DROP COLUMN IF EXISTS "sourceRecipeId";

-- Drop RecipeFoodItem first (references Recipe and Food)
DROP TABLE IF EXISTS "RecipeFoodItem";

-- Drop Recipe
DROP TABLE IF EXISTS "Recipe";
