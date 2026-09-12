-- Links a Program back to the Notion template row it was imported from, so a
-- second import of the same template can offer to update the existing program
-- instead of silently creating a duplicate.
--
-- Nullable on purpose: programs created by hand, by the Excel importer or by the
-- AI generator have no Notion origin and must stay valid. Postgres treats NULLs
-- as distinct in a unique index, so any number of rows may leave it empty.

ALTER TABLE "Program" ADD COLUMN "notionSourceId" TEXT;
ALTER TABLE "Program" ADD COLUMN "notionSyncedAt" TIMESTAMP(3);

-- Scoped to the creator rather than globally unique: two coaches may each import
-- the same shared template and must each end up with their own program.
CREATE UNIQUE INDEX "Program_createdById_notionSourceId_key"
  ON "Program" ("createdById", "notionSourceId");

-- DOWN (manual rollback):
--   DROP INDEX "Program_createdById_notionSourceId_key";
--   ALTER TABLE "Program" DROP COLUMN "notionSyncedAt";
--   ALTER TABLE "Program" DROP COLUMN "notionSourceId";
