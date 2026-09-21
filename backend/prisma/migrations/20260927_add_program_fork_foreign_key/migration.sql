-- Give Program.forkedFromProgramId the foreign key it never had.
--
-- Without one, a coach deleting the program a copy was forked from left the
-- copy pointing at an id that no longer resolves. That copy is the only place
-- its trainee's plan and workout logs live, so the fix is not to cascade the
-- delete but to drop the pointer: SET NULL promotes the copy to a program in
-- its own right and touches nothing else.

-- Two kinds of pointer would fail the constraint or, worse, satisfy it while
-- being nonsense. Both are cleared first, which is the same promotion the
-- merge script performs — no rows are deleted and no logs are moved.

-- 1. Points at a program that has already been deleted.
UPDATE "Program" AS fork
SET "forkedFromProgramId" = NULL
WHERE fork."forkedFromProgramId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Program" AS root WHERE root."id" = fork."forkedFromProgramId"
  );

-- 2. Points at itself. This satisfies a foreign key perfectly well, but it
--    describes a program forked from itself and sends any walk up the fork
--    chain round in circles.
UPDATE "Program"
SET "forkedFromProgramId" = NULL
WHERE "forkedFromProgramId" = "id";

ALTER TABLE "Program"
    ADD CONSTRAINT "Program_forkedFromProgramId_fkey"
    FOREIGN KEY ("forkedFromProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
