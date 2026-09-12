ALTER TABLE "Program" ADD COLUMN "googleSpreadsheetId" TEXT, ADD COLUMN "googleSheetName" TEXT;
ALTER TABLE "WorkoutExercise" ADD COLUMN "originalVariationId" UUID;
CREATE INDEX "Program_createdById_googleSpreadsheetId_googleSheetName_idx" ON "Program"("createdById", "googleSpreadsheetId", "googleSheetName");
-- OAuth grants are backend-only even if public tables are exposed through PostgREST.
ALTER TABLE "GoogleConnection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GoogleConnection" FROM anon, authenticated;
