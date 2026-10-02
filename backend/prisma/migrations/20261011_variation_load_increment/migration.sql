-- The smallest load jump a variation allows, so progression suggestions land on
-- a weight the trainee can actually load (51.25 kg is not an option on most
-- barbells). Null keeps the default the equipment implies.
ALTER TABLE "Variation" ADD COLUMN "loadIncrementKg" DOUBLE PRECISION;
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_loadIncrementKg_positive"
    CHECK ("loadIncrementKg" IS NULL OR "loadIncrementKg" > 0);

-- DOWN (manual):
--   ALTER TABLE "Variation" DROP CONSTRAINT "Variation_loadIncrementKg_positive";
--   ALTER TABLE "Variation" DROP COLUMN "loadIncrementKg";
