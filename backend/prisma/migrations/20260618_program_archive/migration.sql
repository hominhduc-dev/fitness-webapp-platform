ALTER TABLE "Program" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Program_createdById_archivedAt_idx" ON "Program"("createdById", "archivedAt");
