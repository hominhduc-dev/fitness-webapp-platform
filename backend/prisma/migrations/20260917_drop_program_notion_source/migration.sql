-- Removes the Notion origin tracking added by 20260911_add_program_notion_source.
-- The Notion program importer was deleted, so nothing reads or writes these
-- columns any more. Dropping them discards the stored Notion page ids.

DROP INDEX IF EXISTS "Program_createdById_notionSourceId_key";
ALTER TABLE "Program" DROP COLUMN IF EXISTS "notionSyncedAt";
ALTER TABLE "Program" DROP COLUMN IF EXISTS "notionSourceId";

-- DOWN (manual rollback; restores the shape only, not the dropped values):
--   ALTER TABLE "Program" ADD COLUMN "notionSourceId" TEXT;
--   ALTER TABLE "Program" ADD COLUMN "notionSyncedAt" TIMESTAMP(3);
--   CREATE UNIQUE INDEX "Program_createdById_notionSourceId_key"
--     ON "Program" ("createdById", "notionSourceId");
