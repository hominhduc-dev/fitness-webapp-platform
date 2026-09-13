-- Variations synced from the external exercise workbook kept their display
-- name, source id and media under a source-specific metadata key. Move that
-- object to the neutral "externalSource" key the backend now reads. Rows that
-- already carry "externalSource" are left alone.
UPDATE "Variation"
SET "metadata" = ("metadata" - 'hevy') || jsonb_build_object('externalSource', "metadata" -> 'hevy')
WHERE "metadata" ? 'hevy'
  AND NOT ("metadata" ? 'externalSource');
