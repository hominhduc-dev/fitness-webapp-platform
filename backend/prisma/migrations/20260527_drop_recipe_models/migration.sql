-- Drop RecipeFoodItem first (references Recipe and Food)
DROP TABLE IF EXISTS "RecipeFoodItem";

-- Drop Recipe
DROP TABLE IF EXISTS "Recipe";

-- Remove sourceRecipeId column from MealFoodItem
ALTER TABLE "MealFoodItem" DROP COLUMN IF EXISTS "sourceRecipeId";
