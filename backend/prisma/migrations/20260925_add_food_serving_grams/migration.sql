-- Nutrition is stored per serving, and a serving of a prepared dish is "1 tô"
-- or "1 dĩa" — a portion with no weight recorded anywhere. This column is what
-- lets those be shown and entered in grams.
ALTER TABLE "Food"
ADD COLUMN "servingGrams" DOUBLE PRECISION;

-- Foods already measured by weight describe their own serving, so their gram
-- weight is just the serving amount.
UPDATE "Food"
SET "servingGrams" = "servingAmount"
WHERE "servingUnit" IN ('g', 'ml');
