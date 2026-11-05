-- Runtime readers use this small projection rather than the raw import record.
-- Keep Storage identities alongside the legacy Cloudinary fallbacks so media
-- migrated to our bucket does not resolve back to the old Cloudinary URLs.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION "variation_display_metadata"(metadata JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'media', metadata -> 'media',
      'storage', metadata -> 'storage',
      'cdn', metadata -> 'cdn',
      'externalSource', jsonb_build_object('displayName', metadata #> '{externalSource,displayName}')
    )
  )
$$;

-- Replacing an immutable function does not recompute existing STORED generated
-- values. Touch only stale rows' source column to make Postgres regenerate the
-- projection; metadata contents and application updatedAt values stay intact.
UPDATE "Variation"
SET "metadata" = "metadata"
WHERE "displayMetadata" IS DISTINCT FROM "variation_display_metadata"("metadata");

COMMIT;
