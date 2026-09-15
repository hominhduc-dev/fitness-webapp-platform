-- Keep existing meal rows as consumed logs while allowing an AI plan and an
-- actual meal of the same type to coexist on the same day.
CREATE TYPE "MealStatus" AS ENUM ('planned', 'consumed');

ALTER TABLE "Meal"
ADD COLUMN "status" "MealStatus" NOT NULL DEFAULT 'consumed';

DROP INDEX "Meal_userId_loggedDate_type_key";

CREATE UNIQUE INDEX "Meal_userId_loggedDate_type_status_key"
ON "Meal"("userId", "loggedDate", "type", "status");
