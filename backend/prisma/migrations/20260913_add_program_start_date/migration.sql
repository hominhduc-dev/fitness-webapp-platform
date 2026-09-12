-- A coach can pin the day week 1 of a program begins. Null keeps the previous
-- behaviour, where each trainee's weeks are counted from their assignment, so
-- existing programs need no backfill.
ALTER TABLE "Program" ADD COLUMN "startDate" DATE;
