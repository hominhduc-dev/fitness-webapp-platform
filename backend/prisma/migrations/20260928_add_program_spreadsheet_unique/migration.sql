-- One spreadsheet backs one program.
--
-- Export writes results straight into the sheet's cells, matching each logged
-- exercise to its planned row. Two programs pointing at the same spreadsheet
-- therefore write over each other, and nothing in the file records which
-- program a number came from. Until now that was caught after the fact, on the
-- export that failed; this makes the database refuse the state outright.
--
-- Postgres treats NULLs as distinct, so the many programs with no sheet at all
-- are untouched by the index.

-- Existing duplicates have to go first, and the choice of which program keeps
-- the link is not arbitrary: the one with real history attached is the one
-- whose numbers are already in the sheet. Ranked by assignments, then logs,
-- then still-active over archived, then most recently touched, with the id as
-- a final tiebreak so the result is the same on every run.
--
-- Losers keep their workouts, assignments and logs — only the pointer to the
-- spreadsheet is cleared, which is exactly what the "Gỡ liên kết spreadsheet"
-- button does. A coach who wanted the other program to own the sheet can
-- unlink the winner and re-import.
WITH linked_programs AS (
    SELECT
        program."id",
        program."googleSpreadsheetId",
        program."archivedAt",
        program."updatedAt",
        (
            SELECT COUNT(*)
            FROM "ProgramAssignment" AS assignment
            WHERE assignment."programId" = program."id"
        ) AS assignment_count,
        -- WorkoutLog."programId" has no foreign key, so this counts rows that
        -- point at the program whether or not its workouts still exist.
        (
            SELECT COUNT(*)
            FROM "WorkoutLog" AS workout_log
            WHERE workout_log."programId" = program."id"
        ) AS log_count
    FROM "Program" AS program
    WHERE program."googleSpreadsheetId" IS NOT NULL
),
ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "googleSpreadsheetId"
            ORDER BY
                assignment_count DESC,
                log_count DESC,
                ("archivedAt" IS NULL) DESC,
                "updatedAt" DESC,
                "id"
        ) AS rank_in_sheet
    FROM linked_programs
)
UPDATE "Program"
SET "googleSpreadsheetId" = NULL,
    "googleSheetName" = NULL
WHERE "id" IN (SELECT "id" FROM ranked WHERE rank_in_sheet > 1);

CREATE UNIQUE INDEX "Program_googleSpreadsheetId_key" ON "Program"("googleSpreadsheetId");
