-- Remembers the spreadsheet a trainee exports one program's workout logs into.
-- The file lives in the trainee's own Google Drive; later exports rewrite the
-- same file instead of creating a new one each time.

ALTER TABLE "ProgramAssignment" ADD COLUMN IF NOT EXISTS "traineeGoogleSpreadsheetId" TEXT;

-- DOWN (manual rollback):
--   ALTER TABLE "ProgramAssignment" DROP COLUMN IF EXISTS "traineeGoogleSpreadsheetId";
